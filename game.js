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
  const clearKicker = document.getElementById("clearKicker");
  const clearTitle = document.getElementById("clearTitle");
  const clearStats = document.getElementById("clearStats");
  const nextBtn = document.getElementById("nextBtn");

  const selectOverlay = document.getElementById("selectOverlay");
  const levelGrid = document.getElementById("levelGrid");
  const selectBackBtn = document.getElementById("selectBackBtn");

  const skinsBtn = document.getElementById("skinsBtn");
  const skinOverlay = document.getElementById("skinOverlay");
  const skinGrid = document.getElementById("skinGrid");
  const skinBackBtn = document.getElementById("skinBackBtn");

  const progressFill = document.getElementById("progressFill");
  const progressDino = document.getElementById("progressDino");

  // ---- Levels ----
  const TOTAL_LEVELS = 50;

  // Per-level speed envelope. Pattern spacing is normalised against maxSpeed
  // (see buildSchedule), so a given pattern feels the same at any level.
  function levelConfig(n) {
    return {
      startSpeed: 5.5 + (n - 1) * 0.09,            // L1 5.5  -> L50 ~9.9
      maxSpeed: Math.min(16, 8.8 + (n - 1) * 0.145), // L1 8.8 -> capped 16
      accel: 0.0024 + (n - 1) * 0.00002,
    };
  }

  // Hand-authored obstacle scores. One string per level, read left to right.
  // Obstacles:  c small cactus  C big cactus  2 double  3 triple  b bird (duck/jump)
  // Spacers:    .  small gap   -  medium gap   ~  large gap   (space is ignored)
  // Spacing is expressed in "jump units" relative to the level's top speed, so
  // every level stays passable regardless of its speed. See buildSchedule().
  const LEVEL_PATTERNS = [
    // World 1 — Egg (L1-5): learn to jump, very wide gaps, birds introduced L4
    "c ~~ c ~~ c ~~ c",
    "c ~ c ~~ C ~ c ~~ c",
    "c ~ 2 ~ c ~ C ~ 2 ~ c",
    "c ~ b ~ c ~ b ~ c ~ c",
    "c ~ C ~ b ~ 2 ~ b ~ c",
    // World 2 — Cracked egg (L6-10): big cacti + birds settle in
    "C ~ c - C ~ b ~ 2 ~ C",
    "2 ~ b ~ C - c ~ b ~ 2 ~ C",
    "c - c ~ b ~ 2 - C ~ b ~ 3",
    "C ~ 2 - b ~ C - 2 ~ b ~ C",
    "b ~ C - 2 - b ~ 3 ~ b ~ C",
    // World 3 — Legged egg (L11-15): clusters & rhythm, a cactus gauntlet
    "2 - 2 ~ b ~ 3 - C ~ b ~ 2",
    "c - c - c ~ b - b ~ 2 - C",
    "2 - 3 - 2 - C - 3 ~ 2 - 3",
    "b - C - b - 2 ~ b - C - b",
    "3 ~ 2 - b - C - 2 - b ~ 3",
    // World 4 — Hatchling (L16-20): bird-heavy interludes
    "C - b - 2 - b - 3 ~ b - C - b",
    "b - b ~ b - C ~ b - b - 2 ~ b",
    "2 - C - 3 - b - 2 - C ~ 3 - b",
    "c - b - c - b - c - b - 2 - C",
    "3 - C - b - 3 ~ 2 - b - C - 3",
    // World 5 — Small dino (L21-25): denser, a bird swarm finale
    "3 - 3 ~ b - C - 3 - b ~ 3 - 2",
    "C - b - C - b - C - b ~ 3 - 3",
    "2 - 3 - 2 - 3 ~ b - b - C - 3",
    "b - 3 - b - 3 - b - C ~ 3 - b",
    "b - b - b ~ b - b - C ~ b - b - b",
    // World 6 — Runner (L26-30)
    "3 - C - b - 3 - C - b ~ 3 - 3",
    "C - 3 - b - C - 3 - b - C - 3",
    "3 . 2 ~ b - b - 3 - C - 3 - b",
    "2 - 3 - C - b - 3 - b - C - 3",
    "3 - b - 3 - b - 3 - b - 3 - C",
    // World 7 — Crested (L31-35): tighter clusters appear
    "3 . 3 - b - C - 3 . 2 - b - 3",
    "C - b - 3 . 3 - b - C - 3 - b",
    "3 . 3 . 3 ~ b - b - 3 - C - 3",
    "b - 3 . 2 - b - 3 . C - b - 3",
    "3 . 3 - b - 3 . 3 - b - C - 3",
    // World 8 — Horned (L36-40)
    "3 . C - b - 3 . 3 - b - C . 3",
    "C . 3 - b - b - 3 . C - 3 - b",
    "3 . 3 . 3 - b - C . 3 - b - 3",
    "b - 3 . 3 - b - 3 . C . 3 - b",
    "3 . C . 3 - b - b - 3 . 3 - C",
    // World 9 — Alpha (L41-45): tight gaps everywhere
    "3 . 3 . b - C . 3 . 3 - b - C",
    "C . 3 . b - b - 3 . C . 3 - b",
    "3 . 3 . 3 . b - 3 . C . 3 - b",
    "b . 3 . 3 - b . 3 . C . 3 . b",
    "3 . C . 3 . b . 3 . 3 . b . C",
    // World 10 — Super dino (L46-50): the gauntlet, L50 is a long finale
    "3 . 3 . b . C . 3 . b . 3 . 3",
    "C . 3 . b . b . 3 . C . 3 . b",
    "3 . 3 . 3 . b . C . 3 . b . 3",
    "b . 3 . C . 3 . b . 3 . C . b",
    "3 . C . 3 . b . 3 . C . 3 . b . 3 . C",
  ];

  // Footprint (world width) of each obstacle, used to advance the cursor.
  function obstacleFootprint(type) {
    if (type === "3") return 57;
    if (type === "2") return 38;
    if (type === "C") return 20;
    if (type === "b") return 40;
    return 14; // c
  }

  // Expand a pattern string into an ordered schedule of {at, ...} entries plus
  // the level goal distance. `u` is one "jump unit" — the world distance the
  // dino covers during a held jump at this level's top speed — so spacing is
  // speed-invariant and always clearable.
  function buildSchedule(pattern, maxSpeed) {
    const u = 40 * maxSpeed;        // ~ max airtime (frames) * speed
    const BASE_GAP = 1.0 * u;       // implicit land-and-rejump gap
    let cursor = 360;               // lead-in before first obstacle
    const items = [];
    for (const ch of pattern) {
      if (ch === " ") continue;
      else if (ch === ".") cursor += 0.28 * u;
      else if (ch === "-") cursor += 0.6 * u;
      else if (ch === "~") cursor += 1.2 * u;
      else {
        items.push(makeScheduleItem(ch, cursor));
        cursor += obstacleFootprint(ch) + BASE_GAP;
      }
    }
    return { items, goal: cursor + 360 };
  }

  function makeScheduleItem(ch, at) {
    if (ch === "b") return { at, type: "bird" };
    if (ch === "C") return { at, type: "cactus", big: true, cluster: 1 };
    if (ch === "2") return { at, type: "cactus", big: false, cluster: 2 };
    if (ch === "3") return { at, type: "cactus", big: false, cluster: 3 };
    return { at, type: "cactus", big: false, cluster: 1 }; // c
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
  let goal = 2200, schedule = [], schedIdx = 0;
  let state = "ready";
  let legTick = 0, finishSpawned = false, midPlayed = false;

  // Honour the OS "reduce motion" preference: fewer particles, no strobe.
  const reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = reduceMotionMQ.matches;

  // ---- Persistence ----
  let unlocked = 1, bestByLevel = {}, chosenSkin = null; // chosenSkin null = always newest
  try {
    unlocked = parseInt(localStorage.getItem("dino_unlocked") || "1", 10) || 1;
    bestByLevel = JSON.parse(localStorage.getItem("dino_best") || "{}") || {};
    const sk = localStorage.getItem("dino_skin");
    if (sk != null && sk !== "auto") chosenSkin = parseInt(sk, 10);
  } catch (e) {}
  function saveProgress() {
    try {
      localStorage.setItem("dino_unlocked", String(unlocked));
      localStorage.setItem("dino_best", JSON.stringify(bestByLevel));
      localStorage.setItem("dino_skin", chosenSkin == null ? "auto" : String(chosenSkin));
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
    const built = buildSchedule(LEVEL_PATTERNS[n - 1] || "c ~ c ~ c", cfg.maxSpeed);
    schedule = built.items; goal = built.goal; schedIdx = 0;
    obstacles = []; clouds = []; particles = [];
    speed = cfg.startSpeed; dist = 0; score = 0;
    night = false; flashT = 0; finishSpawned = false; midPlayed = false;
    dino.ducking = false; placeDinoGround();
    for (let i = 0; i < 3; i++) clouds.push({ x: Math.random() * BASE_W, y: 24 + Math.random() * 60, s: 0.3 + Math.random() * 0.5 });
    levelEl.textContent = String(n);
    updateProgress();
    refreshSkinUI();
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
    const stageBefore = maxUnlockedStage();
    if (level + 1 <= TOTAL_LEVELS && level + 1 > unlocked) unlocked = level + 1;
    const stageAfter = maxUnlockedStage();
    saveProgress();
    refreshSkinUI(); // newest form follows progress when on auto
    clearKicker.textContent = stageAfter > stageBefore
      ? "New form — " + EVOLUTIONS[stageAfter].emoji + " " + EVOLUTIONS[stageAfter].name
      : "Level cleared";
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
    flashT = reduceMotion ? 0 : 8;
    blip(150, 0.2, "sawtooth");
  }

  // ---- Overlay helpers ----
  function hideAllOverlays() { [overlay, clearOverlay, selectOverlay, skinOverlay].forEach(o => o.classList.add("hidden")); }
  function showOverlay(el) { hideAllOverlays(); el.classList.remove("hidden"); }

  // ---- Input ----
  function jump() {
    if (state === "ready" || state === "over") { startLevel(level); return; }
    if (state === "clear" || state === "select" || state === "skins") return;
    if (dino.onGround) { dino.vy = JUMP_V; dino.onGround = false; holdingJump = true; blip(660, 0.06); }
  }
  function releaseJump() { holdingJump = false; }
  function setDuck(v) { if (state === "play") dino.ducking = v; }

  // ---- Spawning ----
  // Pull scheduled obstacles onto the stage as their world position reaches the
  // right edge. Coordinates are world-distance based, so spacing is exact and
  // independent of frame rate.
  function spawnDue() {
    const ahead = BASE_W - dino.x + 8;
    while (schedIdx < schedule.length && schedule[schedIdx].at - dist <= ahead) {
      const it = schedule[schedIdx++];
      const x = dino.x + (it.at - dist);
      if (it.type === "bird") {
        // One duck-height lane: clears a ducking dino, blocks a standing one,
        // and can also be jumped over.
        obstacles.push({ type: "bird", x, y: GROUND - 30, w: 40, h: 22, wing: 0 });
      } else {
        const big = it.big, cluster = it.cluster;
        obstacles.push({ type: "cactus", x, y: GROUND, big, cluster,
          w: (big ? 18 : 13) * cluster + (cluster - 1) * 8, h: big ? 46 : 32 });
      }
    }
  }

  // ---- Update ----
  function update() {
    dist += speed;
    score += speed * 0.08;
    if (speed < cfg.maxSpeed) speed += cfg.accel;

    const wasNight = night;
    night = Math.floor(dist / (goal / 2)) % 2 === 1;
    if (night && !wasNight && !midPlayed) { midPlayed = true; blip(392, 0.1, "sine"); }

    const remaining = goal - dist;
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

    if (!finishSpawned) spawnDue();

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

    if (dist >= goal) { clearLevel(); return; }

    legTick += speed * 0.06;
    if (flashT > 0) flashT--;
    updateProgress();
  }

  function updateProgress() {
    const pct = Math.max(0, Math.min(100, (dist / goal) * 100));
    progressFill.style.width = pct + "%";
    progressDino.style.left = pct + "%";
  }

  function puff() {
    if (reduceMotion) return;
    for (let i = 0; i < 5; i++)
      particles.push({ x: dino.x + 8, y: GROUND, vx: -Math.random() * 2 - 0.5, vy: -Math.random() * 1.5, life: 14 + Math.random() * 8 });
  }

  // ---- Draw: evolution ladder ----
  // Each level milestone (every 5 levels) unlocks a fancier form. All forms are
  // drawn from fillRect primitives in the current theme colours, so dark mode
  // and the in-level night inversion still "just work". Cosmetic only — the
  // collision box (set in update) never changes with skin, to keep play fair.

  function eggBody(c, cx, bottomY, w, h) {
    ctx.fillStyle = c.fg;
    const x = cx - w / 2;
    ctx.fillRect(x + w * 0.18, bottomY - h, w * 0.64, h);            // top column
    ctx.fillRect(x + w * 0.06, bottomY - h * 0.78, w * 0.88, h * 0.74);
    ctx.fillRect(x, bottomY - h * 0.5, w, h * 0.5);                  // wide base
  }
  function eye(c, ex, ey, sz, color) { ctx.fillStyle = color || c.bg; ctx.fillRect(ex, ey, sz, sz); }
  function eggCrack(c, cx, bottomY, w, h) {
    ctx.fillStyle = c.bg;
    const x = cx - w / 2, my = bottomY - h * 0.55;
    ctx.fillRect(x + w * 0.20, my, w * 0.14, 3);
    ctx.fillRect(x + w * 0.33, my - 4, w * 0.14, 3);
    ctx.fillRect(x + w * 0.47, my, w * 0.14, 3);
    ctx.fillRect(x + w * 0.61, my - 4, w * 0.16, 3);
  }
  function stubbyLegs(c, cx, bottomY, step) {
    ctx.fillStyle = c.fg;
    ctx.fillRect(cx - 8, bottomY - (step ? 7 : 4), 5, step ? 7 : 4);
    ctx.fillRect(cx + 3, bottomY - (step ? 4 : 7), 5, step ? 4 : 7);
  }

  // The bipedal dino silhouette, parameterised for the grown-up stages.
  function dinoForm(c, opt) {
    const x = dino.x, baseY = dino.y;
    const duck = dino.ducking && dino.onGround;
    const step = Math.floor(legTick) % 2 === 0;
    const s = opt.scale || 1;
    ctx.fillStyle = c.fg;
    if (duck) {
      ctx.fillRect(x, baseY - 22, 48, 18);
      ctx.fillRect(x + 42, baseY - 28, 18, 15);
      eye(c, x + 51, baseY - 25, 4);
      ctx.fillStyle = c.fg;
      ctx.fillRect(x + 8, baseY - 5, 6, 5);
      ctx.fillRect(x + 26, baseY - 5, 6, step ? 5 : 3);
      if (opt.spikes) for (let i = 0; i < opt.spikes; i++) ctx.fillRect(x + 6 + i * 8, baseY - 26, 5, 5);
      return;
    }
    const top = baseY - 48 * s;
    ctx.fillRect(x, top, 26 * s, 30 * s);            // body
    ctx.fillRect(x + 20 * s, top - 6 * s, 24 * s, 22 * s); // head
    ctx.fillRect(x - 7 * s, baseY - 30 * s, 9 * s, 6 * s); // tail
    if (dino.onGround) {
      ctx.fillRect(x + 4 * s, baseY - 18 * s, 8 * s, (step ? 18 : 13) * s);
      ctx.fillRect(x + 16 * s, baseY - 18 * s, 8 * s, (step ? 13 : 18) * s);
    } else {
      ctx.fillRect(x + 4 * s, baseY - 18 * s, 8 * s, 13 * s);
      ctx.fillRect(x + 16 * s, baseY - 14 * s, 8 * s, 13 * s);
    }
    if (opt.spikes) {
      ctx.fillStyle = c.fg;
      for (let i = 0; i < opt.spikes; i++) ctx.fillRect(x + 2 * s + i * 7 * s, top - 5 * s - (i % 2) * 2, 5 * s, 6 * s);
    }
    if (opt.horn) { ctx.fillStyle = c.fg; ctx.fillRect(x + 40 * s, top - 13 * s, 5 * s, 9 * s); }
    eye(c, x + 35 * s, top, 5 * s, opt.accent ? c.accent : c.bg);
  }

  const EVOLUTIONS = [
    { name: "Egg",         from: 1,  emoji: "🥚", draw(c) {
        const x = dino.x, b = dino.y, duck = dino.ducking && dino.onGround;
        if (duck) { eggBody(c, x + 17, b, 46, 26); eye(c, x + 30, b - 16, 4); return; }
        eggBody(c, x + 17, b, 32, 42); eye(c, x + 24, b - 30, 4);
      } },
    { name: "Cracked Egg", from: 6,  emoji: "🥚", draw(c) {
        const x = dino.x, b = dino.y, duck = dino.ducking && dino.onGround;
        if (duck) { eggBody(c, x + 17, b, 46, 26); eggCrack(c, x + 17, b, 46, 26); eye(c, x + 30, b - 16, 4); return; }
        eggBody(c, x + 17, b, 32, 42); eggCrack(c, x + 17, b, 32, 42); eye(c, x + 24, b - 30, 4);
      } },
    { name: "Legged Egg",  from: 11, emoji: "🐣", draw(c) {
        const x = dino.x, b = dino.y, duck = dino.ducking && dino.onGround;
        const step = Math.floor(legTick) % 2 === 0;
        if (duck) { eggBody(c, x + 17, b, 46, 24); eye(c, x + 30, b - 15, 4); return; }
        const lift = 7;
        eggBody(c, x + 17, b - lift, 32, 38); eye(c, x + 24, b - lift - 26, 4);
        stubbyLegs(c, x + 17, b, step);
      } },
    { name: "Hatchling",   from: 16, emoji: "🐣", draw(c) {
        const x = dino.x, b = dino.y, duck = dino.ducking && dino.onGround;
        const step = Math.floor(legTick) % 2 === 0;
        if (duck) { eggBody(c, x + 17, b, 48, 24); eye(c, x + 32, b - 15, 4); return; }
        const lift = 8;
        eggBody(c, x + 15, b - lift, 30, 34);
        ctx.fillStyle = c.fg; ctx.fillRect(x + 24, b - lift - 34, 16, 14); // head poking out
        ctx.fillRect(x - 3, b - lift - 8, 7, 5);                            // tail nub
        eye(c, x + 33, b - lift - 30, 4);
        stubbyLegs(c, x + 16, b, step);
      } },
    { name: "Lil' Dino",   from: 21, emoji: "🦎", draw(c) { dinoForm(c, { scale: 0.9 }); } },
    { name: "Runner",      from: 26, emoji: "🦖", draw(c) { dinoForm(c, { scale: 1 }); } },
    { name: "Crested",     from: 31, emoji: "🦕", draw(c) { dinoForm(c, { scale: 1.03, spikes: 3 }); } },
    { name: "Horned",      from: 36, emoji: "🦖", draw(c) { dinoForm(c, { scale: 1.07, spikes: 3, horn: true }); } },
    { name: "Alpha",       from: 41, emoji: "🦕", draw(c) { dinoForm(c, { scale: 1.12, spikes: 4, horn: true }); } },
    { name: "Super Dino",  from: 46, emoji: "🐲", draw(c) { dinoForm(c, { scale: 1.18, spikes: 5, horn: true, accent: true }); } },
  ];

  function maxUnlockedStage() {
    let m = 0;
    for (let i = 0; i < EVOLUTIONS.length; i++) if (EVOLUTIONS[i].from <= unlocked) m = i;
    return m;
  }
  function effectiveStage() {
    const max = maxUnlockedStage();
    return Math.max(0, Math.min(chosenSkin == null ? max : chosenSkin, max));
  }
  function drawDino(c) { EVOLUTIONS[effectiveStage()].draw(c); }
  function refreshSkinUI() { progressDino.textContent = EVOLUTIONS[effectiveStage()].emoji; }

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

  // ---- Skin / evolution grid ----
  function buildSkinGrid() {
    skinGrid.innerHTML = "";
    const max = maxUnlockedStage();
    const active = effectiveStage();
    EVOLUTIONS.forEach((evo, i) => {
      const locked = i > max;
      const cell = document.createElement("button");
      cell.className = "skin-cell" + (locked ? " locked" : "") + (!locked && i === active ? " active" : "");
      const glyph = locked ? "🔒" : evo.emoji;
      cell.innerHTML = '<span class="skin-emoji">' + glyph + '</span>' +
        '<span class="skin-name">' + (locked ? "Level " + evo.from : evo.name) + '</span>';
      if (!locked) cell.addEventListener("click", () => {
        chosenSkin = (i === max) ? null : i; // picking the newest returns to auto
        saveProgress(); refreshSkinUI(); buildSkinGrid(); blip(560, 0.06);
      });
      skinGrid.appendChild(cell);
    });
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
    // Overlays live inside the stage; let taps on their buttons through to the
    // button's own handler instead of triggering a jump/start underneath.
    if (e.target.closest && e.target.closest("button")) return;
    if (state === "clear" || state === "select" || state === "skins") return;
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

  skinsBtn.addEventListener("click", () => { state = "skins"; buildSkinGrid(); showOverlay(skinOverlay); });
  skinBackBtn.addEventListener("click", () => {
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
  reduceMotionMQ.addEventListener("change", e => { reduceMotion = e.matches; });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") { state = "over"; ovTitle.textContent = "Paused"; ovSub.textContent = "Tap or space to resume"; showOverlay(overlay); }
  });

  // ---- Boot ----
  loadLevel(1);
  resize();
  render();
  loop();

  // Read-only test hook for automated playtesting. Inert unless the page is
  // opened with ?bot in the query string — adds nothing to normal play.
  if (location.search.indexOf("bot") >= 0) {
    window.__dino = {
      get state() { return state; }, get level() { return level; },
      get dino() { return dino; }, get obstacles() { return obstacles; },
      get speed() { return speed; }, get ground() { return GROUND; },
      get goal() { return goal; }, get dist() { return dist; },
      jump, releaseJump, setDuck, next: () => nextBtn.click(),
    };
  }
})();
