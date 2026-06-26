(function () {
  "use strict";

  // ---- DOM ----
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const stage = document.getElementById("stage");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const soundBtn = document.getElementById("soundBtn");

  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovSub = document.getElementById("ovSub");
  const levelSelectBtn = document.getElementById("levelSelectBtn");

  const clearOverlay = document.getElementById("clearOverlay");
  const clearTitle = document.getElementById("clearTitle");
  const clearStats = document.getElementById("clearStats");
  const nextBtn = document.getElementById("nextBtn");

  const selectOverlay = document.getElementById("selectOverlay");
  const levelGrid = document.getElementById("levelGrid");
  const selectBackBtn = document.getElementById("selectBackBtn");

  const progressFill = document.getElementById("progressFill");
  const progressDino = document.getElementById("progressDino");

  // ---- Levels ----
  const TOTAL_LEVELS = 8;
  function levelConfig(n) {
    return {
      goal: 2200 + (n - 1) * 900,
      startSpeed: 6 + (n - 1) * 0.5,
      maxSpeed: 12 + (n - 1) * 0.6,
      birdFrom: Math.max(0, 0.55 - (n - 1) * 0.06),
    };
  }

  // ---- Logical resolution ----
  const BASE_W = 720;
  let BASE_H = 240;
  const GROUND_OFFSET = 40;
  let GROUND = BASE_H - GROUND_OFFSET;
  let scale = 1, dpr = 1;

  // ---- Theme ----
  function theme() {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const light = { fg: "#2c2c2a", bg: "#f7f6f1", mid: "#888780", line: "#d3d1c7", accent: "#534ab7" };
    const dk = { fg: "#f1efe8", bg: "#1f1f1d", mid: "#888780", line: "#444441", accent: "#afa9ec" };
    const base = dark ? dk : light;
    if (!night) return base;
    return dark
      ? { fg: "#1f1f1d", bg: "#f1efe8", mid: "#888780", line: "#d3d1c7", accent: "#534ab7" }
      : { fg: "#f7f6f1", bg: "#2c2c2a", mid: "#888780", line: "#5f5e5a", accent: "#afa9ec" };
  }

  // ---- State ----
  const GRAV = 0.62, JUMP_V = -11.5, MAX_FALL = 16;
  const dino = { x: 64, y: 0, vy: 0, ducking: false, onGround: true };
  let obstacles = [], clouds = [], particles = [];
  let speed, dist, score, night = false, flashT = 0, holdingJump = false;
  let level = 1, cfg = levelConfig(1);
  let state = "ready";
  let legTick = 0, nextGap = 80, finishSpawned = false;

  // ---- Persistence ----
  let unlocked = 1, bestByLevel = {};
  try {
    unlocked = parseInt(localStorage.getItem("dino_unlocked") || "1", 10) || 1;
    bestByLevel = JSON.parse(localStorage.getItem("dino_best") || "{}") || {};
  } catch (e) {}
  function saveProgress() {
    try {
      localStorage.setItem("dino_unlocked", String(unlocked));
      localStorage.setItem("dino_best", JSON.stringify(bestByLevel));
    } catch (e) {}
  }

  // ---- Sound ----
  let audioCtx = null, soundOn = true;
  try { soundOn = localStorage.getItem("dino_sound") !== "off"; } catch (e) {}
  function blip(freq, dur, type) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function fanfare() {
    if (!soundOn) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.12), i * 90));
  }
  function updateSoundUI() { soundBtn.classList.toggle("muted", !soundOn); }
  updateSoundUI();

  // ---- Resize ----
  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    BASE_H = Math.max(180, Math.round((BASE_W * rect.height) / rect.width));
    GROUND = BASE_H - GROUND_OFFSET;
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    scale = (rect.width * dpr) / BASE_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (state !== "play") { placeDinoGround(); render(); }
  }
  function placeDinoGround() { dino.y = GROUND; dino.vy = 0; dino.onGround = true; }

  // ---- Level lifecycle ----
  function loadLevel(n) {
    level = n; cfg = levelConfig(n);
    obstacles = []; clouds = []; particles = [];
    speed = cfg.startSpeed; dist = 0; score = 0; nextGap = 80;
    night = false; flashT = 0; finishSpawned = false;
    dino.ducking = false; placeDinoGround();
    for (let i = 0; i < 3; i++) clouds.push({ x: Math.random() * BASE_W, y: 24 + Math.random() * 60, s: 0.3 + Math.random() * 0.5 });
    levelEl.textContent = String(n);
    updateProgress();
  }
  function startLevel(n) {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    loadLevel(n);
    state = "play";
    hideAllOverlays();
    blip(440, 0.08);
  }
  function clearLevel() {
    state = "clear";
    const prevBest = bestByLevel[level] || 0;
    const s = Math.floor(score);
    if (s > prevBest) bestByLevel[level] = s;
    if (level + 1 <= TOTAL_LEVELS && level + 1 > unlocked) unlocked = level + 1;
    saveProgress();
    clearTitle.textContent = level >= TOTAL_LEVELS ? "All levels cleared!" : "Level " + level;
    clearStats.textContent = "Score " + String(s).padStart(5, "0") + " · Best " + String(bestByLevel[level] || s).padStart(5, "0");
    nextBtn.textContent = level >= TOTAL_LEVELS ? "Play again" : "Next level \u2192";
    showOverlay(clearOverlay);
    fanfare();
  }
  function failLevel() {
    state = "over";
    ovTitle.textContent = "Level " + level + " \u2014 try again";
    ovSub.textContent = "Tap or space to retry";
    showOverlay(overlay);
    flashT = 8;
    blip(150, 0.2, "sawtooth");
  }

  // ---- Overlay helpers ----
  function hideAllOverlays() { [overlay, clearOverlay, selectOverlay].forEach(o => o.classList.add("hidden")); }
  function showOverlay(el) { hideAllOverlays(); el.classList.remove("hidden"); }

  // ---- Input ----
  function jump() {
    if (state === "ready" || state === "over") { startLevel(level); return; }
    if (state === "clear" || state === "select") return;
    if (dino.onGround) { dino.vy = JUMP_V; dino.onGround = false; holdingJump = true; blip(660, 0.06); }
  }
  function releaseJump() { holdingJump = false; }
  function setDuck(v) { if (state === "play") dino.ducking = v; }

  // ---- Spawning ----
  function spawn() {
    const progress = dist / cfg.goal;
    const canFly = progress > cfg.birdFrom && Math.random() < 0.3;
    if (canFly) {
      const lanes = [GROUND - 64, GROUND - 38, GROUND - 12];
      obstacles.push({ type: "bird", x: BASE_W + 24, y: lanes[(Math.random() * lanes.length) | 0], w: 40, h: 26, wing: 0 });
    } else {
      const cluster = Math.random() < 0.28 ? 2 : 1;
      const big = Math.random() < 0.4;
      obstacles.push({ type: "cactus", x: BASE_W + 24, y: GROUND, big, cluster,
        w: (big ? 18 : 13) * cluster + (cluster - 1) * 8, h: big ? 46 : 32 });
    }
  }

  // ---- Update ----
  function update() {
    dist += speed;
    score += speed * 0.08;
    if (speed < cfg.maxSpeed) speed += 0.0026;
    night = Math.floor(dist / (cfg.goal / 2)) % 2 === 1;

    const remaining = cfg.goal - dist;
    if (!finishSpawned && remaining <= BASE_W + 200) {
      finishSpawned = true;
      obstacles.push({ type: "finish", x: BASE_W + 24, y: GROUND, w: 8, h: 80 });
    }

    let g = GRAV;
    if (holdingJump && dino.vy < 0) g = GRAV * 0.5;
    dino.vy = Math.min(dino.vy + g, MAX_FALL);
    dino.y += dino.vy;
    if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; if (!dino.onGround) { dino.onGround = true; puff(); } }

    const duck = dino.ducking && dino.onGround;
    dino.w = duck ? 58 : 44;
    dino.h = duck ? 26 : 48;

    if (!finishSpawned) {
      nextGap -= speed;
      if (nextGap <= 0) { spawn(); nextGap = Math.random() * 50 + 70 + 3600 / speed; }
    }

    for (const o of obstacles) { o.x -= speed; if (o.type === "bird") o.wing = (o.wing + 0.18) % 2; }
    obstacles = obstacles.filter(o => o.x + o.w > -10);

    for (const c of clouds) { c.x -= c.s * 1.1; if (c.x < -60) { c.x = BASE_W + 30; c.y = 24 + Math.random() * 60; } }
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--; }
    particles = particles.filter(p => p.life > 0);

    const box = { x: dino.x, y: dino.y, w: dino.w, h: dino.h };
    for (const o of obstacles) {
      if (o.type === "finish") {
        if (dino.x + dino.w > o.x + o.w / 2) { clearLevel(); return; }
        continue;
      }
      const pad = 4;
      const ob = { x: o.x + pad, y: o.y, w: o.w - pad * 2, h: o.h - pad };
      if (box.x < ob.x + ob.w && box.x + box.w > ob.x && box.y - box.h < ob.y && box.y > ob.y - ob.h) { failLevel(); return; }
    }

    if (dist >= cfg.goal) { clearLevel(); return; }

    legTick += speed * 0.06;
    if (flashT > 0) flashT--;
    updateProgress();
  }

  function updateProgress() {
    const pct = Math.max(0, Math.min(100, (dist / cfg.goal) * 100));
    progressFill.style.width = pct + "%";
    progressDino.style.left = pct + "%";
  }

  function puff() {
    for (let i = 0; i < 5; i++)
      particles.push({ x: dino.x + 8, y: GROUND, vx: -Math.random() * 2 - 0.5, vy: -Math.random() * 1.5, life: 14 + Math.random() * 8 });
  }

  // ---- Draw ----
  function drawDino(c) {
    ctx.fillStyle = c.fg;
    const x = dino.x, baseY = dino.y;
    const duck = dino.ducking && dino.onGround;
    if (duck) {
      ctx.fillRect(x, baseY - 22, 48, 18);
      ctx.fillRect(x + 42, baseY - 28, 18, 15);
      ctx.fillStyle = c.bg; ctx.fillRect(x + 51, baseY - 25, 4, 4);
      ctx.fillStyle = c.fg;
      const s = Math.floor(legTick) % 2 === 0;
      ctx.fillRect(x + 8, baseY - 5, 6, 5); ctx.fillRect(x + 26, baseY - 5, 6, s ? 5 : 3);
    } else {
      ctx.fillRect(x, baseY - 48, 26, 30);
      ctx.fillRect(x + 20, baseY - 54, 24, 22);
      ctx.fillStyle = c.bg; ctx.fillRect(x + 35, baseY - 48, 5, 5);
      ctx.fillStyle = c.fg;
      ctx.fillRect(x - 7, baseY - 30, 9, 6);
      const s = Math.floor(legTick) % 2 === 0;
      if (dino.onGround) {
        ctx.fillRect(x + 4, baseY - 18, 8, s ? 18 : 13);
        ctx.fillRect(x + 16, baseY - 18, 8, s ? 13 : 18);
      } else {
        ctx.fillRect(x + 4, baseY - 18, 8, 13);
        ctx.fillRect(x + 16, baseY - 14, 8, 13);
      }
    }
  }

  function drawObstacle(o, c) {
    if (o.type === "finish") {
      ctx.fillStyle = c.fg;
      ctx.fillRect(o.x, o.y - o.h, 4, o.h);
      const fw = 30, fh = 20, sq = 5;
      for (let r = 0; r < fh / sq; r++)
        for (let col = 0; col < fw / sq; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? c.fg : c.bg;
          ctx.fillRect(o.x + 4 + col * sq, o.y - o.h + r * sq, sq, sq);
        }
      return;
    }
    ctx.fillStyle = c.fg;
    if (o.type === "cactus") {
      for (let i = 0; i < (o.cluster || 1); i++) {
        const ox = o.x + i * (o.big ? 24 : 19);
        const w = o.big ? 14 : 10, h = o.h;
        ctx.fillRect(ox, o.y - h, w, h);
        ctx.fillRect(ox - 5, o.y - h * 0.6, 5, 4);
        ctx.fillRect(ox - 5, o.y - h * 0.6, 4, h * 0.32);
        ctx.fillRect(ox + w, o.y - h * 0.72, 5, 4);
        ctx.fillRect(ox + w + 1, o.y - h * 0.72, 4, h * 0.38);
      }
    } else {
      const up = o.wing < 1;
      ctx.fillRect(o.x + 10, o.y - 6, 24, 8);
      ctx.fillRect(o.x + 30, o.y - 9, 8, 6);
      ctx.fillRect(o.x, up ? o.y - 16 : o.y, 18, 8);
    }
  }

  function render() {
    const c = theme();
    ctx.fillStyle = flashT > 0 && Math.floor(flashT) % 2 === 0 ? c.fg : c.bg;
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    stage.style.background = c.bg;
    progressFill.style.background = c.accent;

    if (night) {
      ctx.fillStyle = c.fg;
      ctx.beginPath(); ctx.arc(BASE_W - 70, 46, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(BASE_W - 64, 42, 11, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = c.line;
    for (const cl of clouds) { ctx.fillRect(cl.x, cl.y, 26, 7); ctx.fillRect(cl.x + 6, cl.y - 5, 16, 6); }

    ctx.strokeStyle = c.mid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 2); ctx.lineTo(BASE_W, GROUND + 2); ctx.stroke();
    ctx.fillStyle = c.mid;
    for (let i = 0; i < BASE_W; i += 42) {
      const px = (((i - dist) % BASE_W) + BASE_W) % BASE_W;
      ctx.fillRect(px, GROUND + 7, 7, 2); ctx.fillRect(px + 20, GROUND + 10, 3, 2);
    }

    for (const o of obstacles) drawObstacle(o, c);

    ctx.globalAlpha = 0.5;
    for (const p of particles) { ctx.fillStyle = c.mid; ctx.fillRect(p.x, p.y - 4, 3, 3); }
    ctx.globalAlpha = 1;

    if (flashT === 0 || Math.floor(flashT) % 2 === 1) drawDino(c);

    scoreEl.textContent = String(Math.floor(score)).padStart(5, "0");
  }

  function loop() {
    if (state === "play") update();
    render();
    requestAnimationFrame(loop);
  }

  // ---- Level select grid ----
  function buildGrid() {
    levelGrid.innerHTML = "";
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const cell = document.createElement("button");
      cell.className = "level-cell";
      cell.textContent = n;
      if (n > unlocked) { cell.classList.add("locked"); cell.textContent = "\uD83D\uDD12"; }
      else if (bestByLevel[n]) cell.classList.add("cleared");
      if (n <= unlocked) cell.addEventListener("click", () => startLevel(n));
      levelGrid.appendChild(cell);
    }
  }

  // ---- Events ----
  function isJumpKey(e) { return e.code === "Space" || e.code === "ArrowUp"; }
  window.addEventListener("keydown", e => {
    if (isJumpKey(e)) { e.preventDefault(); jump(); }
    else if (e.code === "ArrowDown") { e.preventDefault(); setDuck(true); }
  }, { passive: false });
  window.addEventListener("keyup", e => {
    if (isJumpKey(e)) releaseJump();
    else if (e.code === "ArrowDown") setDuck(false);
  });

  stage.addEventListener("pointerdown", e => {
    if (state === "clear" || state === "select") return;
    e.preventDefault(); jump();
  }, { passive: false });
  stage.addEventListener("pointerup", () => releaseJump());
  stage.addEventListener("pointercancel", () => releaseJump());

  const jb = document.getElementById("jumpBtn");
  jb.addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  jb.addEventListener("pointerup", () => releaseJump());
  jb.addEventListener("pointerleave", () => releaseJump());

  const dbn = document.getElementById("duckBtn");
  dbn.addEventListener("pointerdown", e => { e.preventDefault(); setDuck(true); });
  dbn.addEventListener("pointerup", () => setDuck(false));
  dbn.addEventListener("pointerleave", () => setDuck(false));

  nextBtn.addEventListener("click", () => {
    const next = level >= TOTAL_LEVELS ? 1 : level + 1;
    startLevel(next);
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    state = "ready"; loadLevel(level);
    ovTitle.textContent = "Level " + level;
    ovSub.textContent = "Tap or press space to start";
    showOverlay(overlay);
    render();
  });

  levelSelectBtn.addEventListener("click", () => { state = "select"; buildGrid(); showOverlay(selectOverlay); });
  selectBackBtn.addEventListener("click", () => {
    state = "ready";
    ovTitle.textContent = "Dino Runner";
    ovSub.textContent = "Tap or press space to start";
    showOverlay(overlay);
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem("dino_sound", soundOn ? "on" : "off"); } catch (e) {}
    updateSoundUI();
    if (soundOn) blip(520, 0.08);
  });

  window.addEventListener("resize", resize);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") { state = "over"; ovTitle.textContent = "Paused"; ovSub.textContent = "Tap or space to resume"; showOverlay(overlay); }
  });

  // ---- Boot ----
  loadLevel(1);
  resize();
  render();
  loop();
})();
