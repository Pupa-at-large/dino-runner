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
  const hiScore = document.getElementById("hiScore");
  const levelSelectBtn = document.getElementById("levelSelectBtn");

  const howOverlay = document.getElementById("howOverlay");
  const overOverlay = document.getElementById("overOverlay");
  const overStats = document.getElementById("overStats");

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

  const pauseBtn = document.getElementById("pauseBtn");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const pauseStats = document.getElementById("pauseStats");
  const settingsOverlay = document.getElementById("settingsOverlay");

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
    if (type === "3") return 78;
    if (type === "2") return 52;
    if (type === "C") return 30;  // tall cactus (needs a double jump)
    if (type === "b") return 52;
    return 26; // c
  }

  // Expand a pattern string into an ordered schedule of {at, ...} entries plus
  // the level goal distance. `u` is one "jump unit" — the world distance the
  // dino covers during a held jump at this level's top speed — so spacing is
  // speed-invariant and always clearable.
  function buildSchedule(pattern, maxSpeed) {
    const u = 44 * maxSpeed;        // ~ airtime (frames) * speed, sized for jumps
    const BASE_GAP = 1.0 * u;       // implicit land-and-rejump gap
    let cursor = 360;               // lead-in before first obstacle
    const items = [];
    for (const ch of pattern) {
      if (ch === " ") continue;
      else if (ch === ".") cursor += 0.30 * u;
      else if (ch === "-") cursor += 0.62 * u;
      else if (ch === "~") cursor += 1.2 * u;
      else {
        // Tall cacti need a double jump: isolate them so the player always has
        // room to set it up (before) and recover from its long airtime (after),
        // regardless of the spacer the pattern authored around them.
        if (ch === "C") cursor += 0.7 * u;
        items.push(makeScheduleItem(ch, cursor));
        cursor += obstacleFootprint(ch) + BASE_GAP + (ch === "C" ? 0.9 * u : 0);
      }
    }
    return { items, goal: cursor + 360 };
  }

  function makeScheduleItem(ch, at) {
    if (ch === "b") return { at, type: "bird" };
    if (ch === "C") return { at, type: "cactus", variant: "tall", cluster: 1 };
    if (ch === "2") return { at, type: "cactus", variant: "cluster", cluster: 2 };
    if (ch === "3") return { at, type: "cactus", variant: "cluster", cluster: 3 };
    return { at, type: "cactus", variant: "small", cluster: 1 }; // c
  }

  // ---- Logical resolution ----
  const BASE_W = 720;
  let BASE_H = 240;
  const GROUND_OFFSET = 40;
  let GROUND = BASE_H - GROUND_OFFSET;
  let scale = 1, dpr = 1;

  // ---- Theme (DESIGN_SPEC §1) ----
  // Only bg and ink flip between day/night; accent + secondary are constant.
  // The OS dark-mode setting chooses the *starting* phase; `night` flips it.
  const C_LIGHT_BG = "#F4F3F0", C_DARK_BG = "#16161A";
  const C_LIGHT_INK = "#1A1A1A", C_DARK_INK = "#F1EFE9";
  const C_LIGHT_SEC = "#B8B5AD", C_DARK_SEC = "#4A4A52";
  const C_ACCENT = "#E8552D";
  function theme() {
    const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const startLight = !osDark;
    const isLight = night ? !startLight : startLight;
    const bg = isLight ? C_LIGHT_BG : C_DARK_BG;
    const ink = isLight ? C_LIGHT_INK : C_DARK_INK;
    const sec = isLight ? C_LIGHT_SEC : C_DARK_SEC;
    // fg/bg/mid/line kept for existing draw code; hot=accent ornaments, eye=bg.
    return { fg: ink, bg, mid: sec, line: sec, accent: C_ACCENT, hot: C_ACCENT, eye: bg, ink, secondary: sec };
  }

  // ---- State ----
  // Double-jump model (DESIGN_SPEC §6): first tap jumps, a second mid-air tap
  // adds height. Tall cacti require the double jump; small ones don't.
  const GRAV = 0.62, JUMP_V = -11.5, JUMP_V2 = -10.6, MAX_FALL = 16;
  const MILESTONE = 1200;   // world distance between day/night flips
  const dino = { x: 64, y: 0, vy: 0, ducking: false, onGround: true, crashed: false, jumps: 0 };
  let obstacles = [], clouds = [], particles = [], pops = [], confetti = [];
  let speed, dist, score, night = false, flashT = 0;
  let invertT = 0, pulseT = 0, toastT = 0, toastText = "", lastMilestone = 0;
  let coachJumped = false, coachDucked = false; // first-level tutorial prompts
  let level = 1, cfg = levelConfig(1);
  let goal = 2200, schedule = [], schedIdx = 0;
  let state = "ready";
  let legTick = 0, finishSpawned = false, midPlayed = false;

  // Honour the OS "reduce motion" preference (overridable in Settings): fewer
  // particles, no strobe.
  const reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = reduceMotionMQ.matches;
  try { const m = localStorage.getItem("dino_motion"); if (m === "reduce") reduceMotion = true; else if (m === "full") reduceMotion = false; } catch (e) {}

  // ---- Persistence ----
  let unlocked = 1, bestByLevel = {}, chosenSkin = null, tutorialSeen = false; // chosenSkin null = always newest
  try {
    unlocked = parseInt(localStorage.getItem("dino_unlocked") || "1", 10) || 1;
    bestByLevel = JSON.parse(localStorage.getItem("dino_best") || "{}") || {};
    const sk = localStorage.getItem("dino_skin");
    if (sk != null && sk !== "auto") chosenSkin = parseInt(sk, 10);
    tutorialSeen = localStorage.getItem("dino_seen") === "1";
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
    speed = cfg.startSpeed; dist = 0; score = 0; pops = []; confetti = [];
    night = false; flashT = 0; finishSpawned = false; midPlayed = false;
    invertT = 0; pulseT = 0; toastT = 0; lastMilestone = 0;
    coachJumped = false; coachDucked = false;
    dino.ducking = false; dino.crashed = false; dino.jumps = 0; placeDinoGround();
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
    refreshHi();
    spawnConfetti();
    showOverlay(clearOverlay);
    fanfare();
    if (stageAfter > stageBefore) setTimeout(() => fanfare(), 260); // extra flourish on new form
  }
  function failLevel() {
    state = "over";
    dino.crashed = true;
    overStats.textContent = "Level " + level + " \u00b7 Score " + String(Math.floor(score)).padStart(5, "0");
    showOverlay(overOverlay);
    flashT = reduceMotion ? 0 : 8;
    blip(150, 0.2, "sawtooth");
  }
  function refreshHi() {
    let m = 0; for (const k in bestByLevel) if (bestByLevel[k] > m) m = bestByLevel[k];
    hiScore.textContent = "HI " + String(m).padStart(5, "0");
  }
  function showTitle() { state = "ready"; refreshHi(); showOverlay(overlay); render(); }
  function pauseGame() {
    if (state !== "play") return;
    state = "paused";
    pauseStats.textContent = "Score " + String(Math.floor(score)).padStart(5, "0");
    showOverlay(pauseOverlay);
  }
  function resumeGame() {
    if (state !== "paused") return;
    state = "play";
    hideAllOverlays();
  }
  function goHome() { loadLevel(level); showTitle(); }

  // ---- Overlay helpers ----
  function hideAllOverlays() { [overlay, howOverlay, clearOverlay, overOverlay, selectOverlay, skinOverlay, pauseOverlay, settingsOverlay].forEach(o => o.classList.add("hidden")); }
  function showOverlay(el) { hideAllOverlays(); el.classList.remove("hidden"); }

  // ---- Input ----
  function jump() {
    if (state === "ready" || state === "over") { startLevel(level); return; }
    if (state === "paused") { resumeGame(); return; }
    if (state !== "play") return; // howto / clear / select / skins / settings
    if (dino.onGround) {
      dino.vy = JUMP_V; dino.onGround = false; dino.jumps = 1; dino.ducking = false;
      coachJumped = true;
      blip(660, 0.06); puff();
    } else if (dino.jumps === 1) {
      dino.vy = JUMP_V2; dino.jumps = 2;           // double jump — extra height
      blip(880, 0.06); jumpArc();
    }
  }
  function releaseJump() { /* no-op: height now comes from the double jump */ }
  function setDuck(v) { if (state === "play" && dino.onGround) { dino.ducking = v; if (v) coachDucked = true; } }

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
        // One duck-height band: clears a ducking dino, blocks a standing one,
        // and can also be jumped over.
        obstacles.push({ type: "bird", x, y: GROUND - 30, w: 52, h: 34, wing: 0 });
      } else if (it.variant === "tall") {
        obstacles.push({ type: "cactus", variant: "tall", cluster: 1, x, y: GROUND, w: 30, h: 132 });
      } else if (it.variant === "cluster") {
        const n = it.cluster;
        obstacles.push({ type: "cactus", variant: "cluster", cluster: n, x, y: GROUND, w: n * 26, h: 48 });
      } else {
        // small — occasionally drawn as the bushier variant for variety
        obstacles.push({ type: "cactus", variant: "small", cluster: 1, x, y: GROUND, w: 28, h: 48, bush: Math.random() < 0.3 });
      }
    }
  }

  // ---- Update ----
  function update() {
    dist += speed;
    score += speed * 0.08;
    if (speed < cfg.maxSpeed) speed += cfg.accel;

    // Day/night every MILESTONE units: invert + accent pulse + speed surge
    // (capped at the level's maxSpeed so authored spacing stays passable).
    const ms = Math.floor(dist / MILESTONE);
    if (ms > lastMilestone) {
      lastMilestone = ms;
      night = ms % 2 === 1;
      speed = Math.min(speed + 0.8, cfg.maxSpeed);
      invertT = reduceMotion ? 0 : 9;
      pulseT = reduceMotion ? 0 : 26;
      toastText = night ? "☾ NIGHT" : "☀ DAY";
      toastT = 80;
      blip(523, 0.12, "sine"); blip(784, 0.12, "sine");
    } else {
      night = ms % 2 === 1;
    }

    const remaining = goal - dist;
    if (!finishSpawned && remaining <= BASE_W + 200) {
      finishSpawned = true;
      obstacles.push({ type: "finish", x: BASE_W + 24, y: GROUND, w: 8, h: 80 });
    }

    dino.vy = Math.min(dino.vy + GRAV, MAX_FALL);
    dino.y += dino.vy;
    if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; if (!dino.onGround) { dino.onGround = true; dino.jumps = 0; puff(); } }

    // Hitbox scales with the active form (DESIGN_SPEC §8).
    const duck = dino.ducking && dino.onGround;
    const unit = PXU * formScale(), bw = 96 * unit, bh = 100 * unit;
    dino.w = duck ? bw * 0.70 : bw * 0.60;
    dino.h = duck ? bh * 0.32 : bh * 0.66;

    if (!finishSpawned) spawnDue();

    for (const o of obstacles) {
      o.x -= speed;
      if (o.type === "bird") o.wing = (o.wing + 0.18) % 2;
      // +score pop when an obstacle is cleared (passes behind the dino)
      if (!o.scored && o.type !== "finish" && o.x + o.w < dino.x) { o.scored = true; scorePop(); }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -10);

    // Jump-arc trail (DESIGN_SPEC §4): accent dots along the parabola.
    if (!dino.onGround && !reduceMotion) particles.push({ kind: "dot", x: dino.x + dino.w * 0.5, y: dino.y - dino.h * 0.5, vx: -speed * 0.4, vy: 0, r: 3, life: 16, max: 16 });

    for (const c of clouds) { c.x -= c.s * 1.1; if (c.x < -60) { c.x = BASE_W + 30; c.y = 24 + Math.random() * 60; } }
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === "dust") { p.vy += 0.18; p.r += p.vr || 0; }
    }
    particles = particles.filter(p => p.life > 0);
    for (const sp of pops) { sp.y += sp.vy; sp.life--; }
    pops = pops.filter(sp => sp.life > 0);

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
    if (invertT > 0) invertT--;
    if (pulseT > 0) pulseT--;
    if (toastT > 0) toastT--;
    updateProgress();
  }

  function updateProgress() {
    const pct = Math.max(0, Math.min(100, (dist / goal) * 100));
    progressFill.style.width = pct + "%";
    progressDino.style.left = pct + "%";
  }

  // Dust: 3 fading secondary circles at the takeoff/landing foot (DESIGN_SPEC §4).
  function puff() {
    if (reduceMotion) return;
    for (let i = 0; i < 3; i++)
      particles.push({ kind: "dust", x: dino.x + 6 + i * 5, y: GROUND - 2, r: 5 - i, vr: 0.35, vx: -1 - Math.random(), vy: -0.5, life: 16 + i * 3, max: 16 + i * 3 });
  }
  // A small accent burst on the double jump; the continuous trail is in update().
  function jumpArc() {
    if (reduceMotion) return;
    for (let i = 0; i < 4; i++)
      particles.push({ kind: "dot", x: dino.x + dino.w * 0.5, y: dino.y - dino.h * 0.6 - i * 4, vx: -speed * 0.3, vy: 0, r: 3, life: 18, max: 18 });
  }
  // "+N" score pop floating up in accent (DESIGN_SPEC §4).
  function scorePop() {
    if (reduceMotion) return;
    pops.push({ x: dino.x + dino.w + 6, y: dino.y - dino.h - 6, vy: -0.9, life: 36, max: 36 });
  }

  // Confetti burst on level clear (DESIGN_SPEC §6): accent + ink squares /
  // circles / diamonds. Ticked every frame (even while paused on the clear
  // screen) so the celebration animates over the overlay.
  function spawnConfetti() {
    confetti = [];
    if (reduceMotion) return;
    for (let i = 0; i < 70; i++) {
      const fromLeft = i % 2 === 0;
      confetti.push({
        x: fromLeft ? BASE_W * 0.2 : BASE_W * 0.8,
        y: GROUND * 0.5,
        vx: (fromLeft ? 1 : -1) * (1 + Math.random() * 4),
        vy: -(5 + Math.random() * 7),
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        size: 5 + Math.random() * 6,
        shape: i % 3, hot: i % 2 === 0,
        life: 70 + Math.random() * 40,
      });
    }
  }
  function tickConfetti() {
    if (!confetti.length) return;
    for (const p of confetti) { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.99; p.rot += p.vr; p.life--; }
    confetti = confetti.filter(p => p.life > 0 && p.y < BASE_H + 30);
  }
  function drawConfetti(c) {
    for (const p of confetti) {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.hot ? c.accent : c.ink;
      const s = p.size;
      if (p.shape === 0) ctx.fillRect(-s / 2, -s / 2, s, s);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }

  // ---- Draw: evolution ladder (DESIGN_SPEC §8) ----
  // Each milestone (every 5 levels) unlocks a fancier form, drawn from flat
  // geometry (rounded rects + triangles) in a 96×100 coordinate box. Body =
  // currentColor (ink), accent parts = --hot, eye = bg — so dark mode + the
  // day/night invert "just work". Scale ramps .58→1.18 and the HITBOX scales
  // with it (per the spec / chosen mechanics).
  const PXU = 0.78; // px per box-unit at scale 1

  // 10 forms. kind: egg | hatch | dino. orn flags for the dino base.
  const EVOLUTIONS = [
    { name: "角蛋",   from: 1,  emoji: "🥚", scale: 0.58, kind: "egg" },
    { name: "破壳",   from: 6,  emoji: "🥚", scale: 0.66, kind: "hatch" },
    { name: "幼龙",   from: 11, emoji: "🐣", scale: 0.74, kind: "dino", orn: {} },
    { name: "少年龙", from: 16, emoji: "🦎", scale: 0.82, kind: "dino", orn: { spikes: 1 } },
    { name: "角龙",   from: 21, emoji: "🦎", scale: 0.90, kind: "dino", orn: { horns: 1 } },
    { name: "背鳍龙", from: 26, emoji: "🦖", scale: 0.97, kind: "dino", orn: { plates: 1 } },
    { name: "双角龙", from: 31, emoji: "🦖", scale: 1.04, kind: "dino", orn: { spikes: 1, horns: 2 } },
    { name: "烈焰龙", from: 36, emoji: "🐉", scale: 1.09, kind: "dino", orn: { crest: 1, tailFlame: 1, belly: 1, accentEye: 1 } },
    { name: "王者龙", from: 41, emoji: "🐉", scale: 1.13, kind: "dino", orn: { crown: 1, horns: 1, belly: 1, accentEye: 1 } },
    { name: "巨龙",   from: 46, emoji: "🐲", scale: 1.18, kind: "dino", orn: { plates: 1, crest: 1, horns: 2, wing: 1, belly: 1, accentEye: 1 } },
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
  function formScale() { return EVOLUTIONS[effectiveStage()].scale; }

  // The 96×100 form box anchored to the dino: body-left at dino.x, feet at dino.y.
  function formBox() {
    const unit = PXU * formScale();
    const boxW = 96 * unit, boxH = 100 * unit;
    return { unit, boxW, boxH, boxLeft: dino.x - (20 / 96) * boxW, boxTop: dino.y - (91 / 100) * boxH };
  }
  function crashColors(c) { return Object.assign({}, c, { fg: c.accent, hot: c.accent, eye: c.bg }); }

  function dinoBase(c, B, accentEye) {
    const fx = L => B.boxLeft + (L / 96) * B.boxW, fy = T => B.boxTop + (T / 100) * B.boxH;
    const fw = w => (w / 96) * B.boxW, fh = h => (h / 100) * B.boxH, fr = r => (r / 96) * B.boxW;
    const step = Math.floor(legTick) % 2 === 0;
    ctx.fillStyle = c.fg;
    rrect(fx(6), fy(46), fw(22), fh(13), fr(4));   // tail
    rrect(fx(20), fy(42), fw(46), fh(28), fr(9));  // body
    rrect(fx(58), fy(18), fw(30), fh(28), fr(7));  // head
    rrect(fx(80), fy(32), fw(12), fh(11), fr(3));  // snout
    rrect(fx(60), fy(50), fw(10), fh(7), fr(2));   // jaw
    if (dino.onGround) {
      rrect(fx(28), fy(64), fw(11), fh(step ? 24 : 18), fr(3));
      rrect(fx(48), fy(66), fw(11), fh(step ? 18 : 22), fr(3));
    } else {
      rrect(fx(28), fy(62), fw(11), fh(18), fr(3));
      rrect(fx(48), fy(68), fw(11), fh(16), fr(3));
    }
    rrect(fx(25), fy(85), fw(16), fh(6), fr(2));    // back foot
    rrect(fx(47), fy(85), fw(16), fh(6), fr(2));    // front foot
    ctx.fillStyle = accentEye ? c.hot : c.eye;
    rrect(fx(64), fy(25), fw(7), fh(7), fr(2));     // eye
  }

  function drawWing(c, B) {
    const fx = L => B.boxLeft + (L / 96) * B.boxW, fy = T => B.boxTop + (T / 100) * B.boxH;
    const fw = w => (w / 96) * B.boxW, fh = h => (h / 100) * B.boxH;
    ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = c.fg;
    triBox(fx(28), fy(20), fw(32), fh(28), [[0, 1], [1, 1], [0.28, 0]]);
    ctx.restore();
  }

  function drawDinoOrnaments(c, B, o) {
    const fx = L => B.boxLeft + (L / 96) * B.boxW, fy = T => B.boxTop + (T / 100) * B.boxH;
    const fw = w => (w / 96) * B.boxW, fh = h => (h / 100) * B.boxH, fr = r => (r / 96) * B.boxW;
    const up = (x, y, w, h) => triBox(x, y, w, h, [[0.5, 0], [1, 1], [0, 1]]);
    // structural — body color
    if (o.spikes) { ctx.fillStyle = c.fg; up(fx(30), fy(30), fw(12), fh(14)); up(fx(44), fy(28), fw(12), fh(16)); }
    if (o.plates) { ctx.fillStyle = c.fg; up(fx(24), fy(30), fw(12), fh(14)); up(fx(37), fy(26), fw(13), fh(18)); up(fx(51), fy(29), fw(12), fh(15)); }
    if (o.horns >= 1) { ctx.fillStyle = c.fg; up(fx(65), fy(4), fw(12), fh(18)); }
    if (o.horns >= 2) { ctx.fillStyle = c.fg; up(fx(76), fy(8), fw(10), fh(15)); }
    // accent — hot (only on Lv36+ forms)
    if (o.crest) { ctx.fillStyle = c.hot; up(fx(24), fy(24), fw(11), fh(20)); up(fx(36), fy(18), fw(11), fh(26)); up(fx(48), fy(22), fw(11), fh(22)); }
    if (o.tailFlame) { ctx.fillStyle = c.hot; triBox(fx(-2), fy(44), fw(16), fh(17), [[1, 0], [1, 1], [0, 0.5]]); }
    if (o.crown) { ctx.fillStyle = c.hot; up(fx(59), fy(2), fw(9), fh(16)); up(fx(68), fy(-1), fw(9), fh(19)); up(fx(77), fy(3), fw(9), fh(15)); }
    if (o.belly) { ctx.fillStyle = c.hot; rrect(fx(24), fy(60), fw(36), fh(6), fr(3)); }
  }

  function drawEgg(c, B, duck) {
    const fx = L => B.boxLeft + (L / 96) * B.boxW, fy = T => B.boxTop + (T / 100) * B.boxH;
    const fw = w => (w / 96) * B.boxW, fh = h => (h / 100) * B.boxH, fr = r => (r / 96) * B.boxW;
    const step = Math.floor(legTick) % 2 === 0;
    ctx.fillStyle = c.fg;
    if (duck) rrect(fx(16), fy(58), fw(64), fh(32), fr(15));
    else rrect(fx(26), fy(32), fw(44), fh(60), fr(18));     // egg body
    ctx.fillStyle = c.hot; triBox(fx(41), fy(12), fw(14), fh(24), [[0.5, 0], [1, 1], [0, 1]]); // horn
    ctx.fillStyle = c.eye;                                   // 3 face dots
    rrect(fx(36), fy(52), fw(4), fh(4), fr(2)); rrect(fx(44), fy(50), fw(4), fh(4), fr(2)); rrect(fx(52), fy(52), fw(4), fh(4), fr(2));
    if (!duck) { // two thin feet
      ctx.fillStyle = c.fg;
      rrect(fx(38), fy(86), fw(4), fh(step ? 8 : 6), fr(1)); rrect(fx(35), fy(90), fw(11), fh(4), fr(1));
      rrect(fx(55), fy(86), fw(4), fh(step ? 6 : 8), fr(1)); rrect(fx(54), fy(90), fw(11), fh(4), fr(1));
    }
  }

  function drawHatch(c, B, duck) {
    const fx = L => B.boxLeft + (L / 96) * B.boxW, fy = T => B.boxTop + (T / 100) * B.boxH;
    const fw = w => (w / 96) * B.boxW, fh = h => (h / 100) * B.boxH, fr = r => (r / 96) * B.boxW;
    const step = Math.floor(legTick) % 2 === 0;
    if (duck) { drawEgg(c, B, true); return; }
    ctx.fillStyle = c.fg;
    rrect(fx(24), fy(58), fw(48), fh(36), fr(8));            // eggshell base
    ctx.fillStyle = c.bg;                                    // cracked rim notches
    for (let i = 0; i < 5; i++) triBox(fx(24 + i * 10), fy(54), fw(10), fh(8), [[0, 1], [0.5, 0], [1, 1]]);
    ctx.fillStyle = c.fg;
    rrect(fx(34), fy(30), fw(30), fh(30), fr(12));           // head
    rrect(fx(60), fy(40), fw(12), fh(11), fr(3));            // snout
    ctx.fillStyle = c.hot; triBox(fx(42), fy(10), fw(13), fh(22), [[0.5, 0], [1, 1], [0, 1]]); // horn
    ctx.fillStyle = c.eye; rrect(fx(46), fy(38), fw(6), fh(6), fr(2)); // eye
    ctx.fillStyle = c.fg;
    rrect(fx(36), fy(90), fw(4), fh(step ? 8 : 6), fr(1)); rrect(fx(33), fy(94), fw(11), fh(4), fr(1));
    rrect(fx(56), fy(90), fw(4), fh(step ? 6 : 8), fr(1)); rrect(fx(55), fy(94), fw(11), fh(4), fr(1));
  }

  // Low duck pose for the dino-base forms (DESIGN_SPEC §3 duck, in box units).
  function drawDuckForm(c, B) {
    const u = B.unit, x = dino.x, gy = dino.y, step = Math.floor(legTick) % 2 === 0;
    ctx.fillStyle = c.fg;
    rrect(x, gy - 30 * u, 60 * u, 18 * u, 7 * u);        // body
    rrect(x + 50 * u, gy - 34 * u, 22 * u, 18 * u, 6 * u); // head
    rrect(x + 70 * u, gy - 28 * u, 10 * u, 9 * u, 3 * u);  // snout
    rrect(x + 12 * u, gy - 8 * u, 9 * u, 8 * u, 2 * u);
    rrect(x + 34 * u, gy - 8 * u, 9 * u, (step ? 8 : 5) * u, 2 * u);
    ctx.fillStyle = c.eye; rrect(x + 60 * u, gy - 30 * u, 5 * u, 5 * u, 2 * u);
  }

  function crashEye(c, B) {
    const ex = B.boxLeft + 0.70 * B.boxW, ey = B.boxTop + 0.28 * B.boxH, r = 4 * B.unit;
    ctx.strokeStyle = c.eye; ctx.lineWidth = Math.max(1.5, 2 * B.unit);
    ctx.beginPath();
    ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
    ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
    ctx.stroke();
  }

  function drawDino(baseC) {
    const evo = EVOLUTIONS[effectiveStage()];
    const crash = dino.crashed;
    const c = crash ? crashColors(baseC) : baseC;
    const B = formBox();
    const duck = dino.ducking && dino.onGround;
    if (evo.kind === "egg") { drawEgg(c, B, duck); }
    else if (evo.kind === "hatch") { drawHatch(c, B, duck); }
    else if (duck) { drawDuckForm(c, B); }
    else {
      const o = evo.orn || {};
      if (o.wing) drawWing(c, B);
      dinoBase(c, B, !!o.accentEye);
      drawDinoOrnaments(c, B, o);
    }
    if (crash) crashEye(c, B);
  }
  function refreshSkinUI() { progressDino.textContent = EVOLUTIONS[effectiveStage()].emoji; }

  // ---- Flat-geometry primitives (DESIGN_SPEC §3) ----
  function rrect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
  }
  // Triangle from 3 fractional points [0..1] inside a box.
  function triBox(L, T, W, H, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const X = L + pts[i][0] * W, Y = T + pts[i][1] * H;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.closePath(); ctx.fill();
  }

  // Cactus into box (left x, ground gy, width W, height H). Ratios from the
  // spec's 72×68 cactus box; `bush` adds the second trunk.
  function drawCactus(c, x, gy, W, H, bush) {
    const top = gy - H;
    const px = L => x + (L / 72) * W, py = T => top + (T / 68) * H;
    const pw = w => (w / 72) * W, ph = h => (h / 68) * H, pr = r => (r / 72) * W;
    ctx.fillStyle = c.fg;
    rrect(px(30), py(6), pw(13), ph(58), pr(5));
    rrect(px(18), py(30), pw(15), ph(9), pr(4));
    rrect(px(18), py(18), pw(9), ph(18), pr(4));
    rrect(px(40), py(38), pw(15), ph(9), pr(4));
    rrect(px(46), py(26), pw(9), ph(18), pr(4));
    if (bush) { rrect(px(52), py(28), pw(10), ph(36), pr(4)); rrect(px(58), py(40), pw(11), ph(7), pr(3)); }
  }

  // Ptero into box (left x, top yTop, width W, height H). Two-frame wing.
  function drawPtero(c, x, yTop, W, H, wingUp) {
    const px = L => x + (L / 72) * W, py = T => yTop + (T / 68) * H;
    const pw = w => (w / 72) * W, ph = h => (h / 68) * H, pr = r => (r / 72) * W;
    ctx.fillStyle = c.fg;
    if (wingUp) triBox(px(2), py(4), pw(40), ph(24), [[0, 0], [1, 0.35], [1, 0.85]]);
    else triBox(px(2), py(24), pw(40), ph(24), [[0, 1], [1, 0.15], [1, 0.65]]);
    rrect(px(30), py(24), pw(18), ph(10), pr(4));      // neck/body
    rrect(px(44), py(17), pw(16), ph(14), pr(5));      // head
    triBox(px(40), py(6), pw(18), ph(15), [[0, 0], [1, 0.55], [1, 1]]);  // crest
    triBox(px(58), py(22), pw(13), ph(7), [[0, 0], [1, 0.5], [0, 1]]);   // beak
    ctx.fillStyle = c.eye; rrect(px(48), py(21), pw(5), ph(5), pr(1));    // eye
  }

  // Dashed ground line in ink (DESIGN_SPEC §3).
  function drawGround(c) {
    ctx.fillStyle = c.ink;
    for (let i = 0; i < BASE_W + 14; i += 14) {
      const gx = ((i - (dist % 14)) % (BASE_W + 14));
      ctx.fillRect(gx, GROUND + 2, 8, 2);
    }
  }

  function drawCloud(c, cl) {
    const W = 64, x = cl.x, y = cl.y;
    ctx.fillStyle = c.secondary;
    rrect(x + (4 / 72) * W, y + 8, (34 / 72) * W, 14, 7);
    rrect(x + (22 / 72) * W, y, (32 / 72) * W, 18, 9);
    rrect(x + (40 / 72) * W, y + 8, (26 / 72) * W, 13, 7);
  }

  function drawObstacle(o, c) {
    if (o.type === "finish") {
      ctx.fillStyle = c.fg; rrect(o.x, o.y - o.h, 4, o.h, 2);
      const fw = 30, fh = 20, sq = 5;
      for (let r = 0; r < fh / sq; r++)
        for (let col = 0; col < fw / sq; col++) {
          ctx.fillStyle = (r + col) % 2 === 0 ? c.fg : c.bg;
          ctx.fillRect(o.x + 4 + col * sq, o.y - o.h + r * sq, sq, sq);
        }
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(o.x + 2, o.y - o.h, 4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (o.type === "cactus") {
      if (o.cluster > 1) {
        const cw = o.w / o.cluster;
        for (let i = 0; i < o.cluster; i++) drawCactus(c, o.x + i * cw, o.y, cw, o.h, false);
      } else {
        drawCactus(c, o.x, o.y, o.w, o.h, o.bush);
      }
    } else {
      drawPtero(c, o.x, o.y - o.h, o.w, o.h, o.wing < 1);
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

    for (const cl of clouds) drawCloud(c, cl);
    drawGround(c);
    if (state === "ready") drawCactus(c, BASE_W * 0.62, GROUND, 38, 66, false); // title scene

    for (const o of obstacles) drawObstacle(o, c);

    // particles: dust (secondary circles) + jump-arc dots (accent)
    for (const p of particles) {
      const a = Math.max(0, p.life / (p.max || 16));
      ctx.globalAlpha = p.kind === "dot" ? Math.max(0.3, a) : 0.5 * a;
      ctx.fillStyle = p.kind === "dot" ? c.accent : c.secondary;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (flashT === 0 || Math.floor(flashT) % 2 === 1) drawDino(c);

    // score pops (+N) floating up in accent
    if (pops.length) {
      ctx.fillStyle = c.accent;
      ctx.font = "700 22px " + "'Space Mono', monospace";
      ctx.textBaseline = "middle";
      for (const sp of pops) { ctx.globalAlpha = Math.max(0, sp.life / sp.max); ctx.fillText("+10", sp.x, sp.y); }
      ctx.globalAlpha = 1;
    }

    // milestone accent pulse: an inner ring around the play area
    if (pulseT > 0) {
      ctx.globalAlpha = Math.min(1, pulseT / 26);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, BASE_W - 4, BASE_H - 4);
      ctx.globalAlpha = 1;
    }
    // day/night invert flash: brief full-screen wipe
    if (invertT > 0) {
      ctx.globalAlpha = Math.min(1, invertT / 9) * 0.85;
      ctx.fillStyle = c.fg; ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.globalAlpha = 1;
    }
    // DAY/NIGHT toast pill
    if (toastT > 0) {
      ctx.globalAlpha = Math.min(1, toastT / 18);
      ctx.font = "700 20px 'Space Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(toastText).width + 36;
      ctx.fillStyle = c.accent; rrect(BASE_W / 2 - tw / 2, 22, tw, 34, 17);
      ctx.fillStyle = "#fff"; ctx.fillText(toastText, BASE_W / 2, 40);
      ctx.textAlign = "left"; ctx.globalAlpha = 1;
    }

    drawConfetti(c);
    drawCoach(c);

    scoreEl.textContent = String(Math.floor(score)).padStart(5, "0");
  }

  // First-level coach prompts — point at the first cactus/bird until the
  // player has performed the matching action. Foolproof onboarding.
  function coachLabel(c, text, cx, y) {
    ctx.font = "700 20px 'Space Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 26;
    ctx.fillStyle = c.accent; rrect(cx - w / 2, y - 16, w, 30, 15);
    ctx.fillStyle = "#fff"; ctx.fillText(text, cx, y);
    ctx.fillStyle = c.accent; triBox(cx - 6, y + 14, 12, 8, [[0, 0], [1, 0], [0.5, 1]]);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
  function drawCoach(c) {
    if (state !== "play" || level !== 1) return;
    let cactus = null, bird = null;
    for (const o of obstacles) {
      if (o.x + o.w < dino.x) continue;
      if (o.type === "cactus" && !cactus) cactus = o;
      else if (o.type === "bird" && !bird) bird = o;
    }
    if (!coachJumped && cactus && cactus.x > dino.x && cactus.x - dino.x < 380)
      coachLabel(c, "点一下 跳！", cactus.x + cactus.w / 2, cactus.y - cactus.h - 26);
    if (!coachDucked && bird && bird.x > dino.x && bird.x - dino.x < 380)
      coachLabel(c, "↓ 下滑 蹲！", bird.x + bird.w / 2, bird.y - bird.h - 26);
  }

  function loop() {
    if (state === "play") update();
    tickConfetti();   // animates over the clear overlay (state !== play)
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
    else if (e.code === "Escape" || e.code === "KeyP") { if (state === "play") pauseGame(); else if (state === "paused") resumeGame(); }
  }, { passive: false });
  window.addEventListener("keyup", e => {
    if (isJumpKey(e)) releaseJump();
    else if (e.code === "ArrowDown") setDuck(false);
  });

  // Whole-screen input (DESIGN_SPEC §6): tap = jump, swipe-down / long-press =
  // duck (held stays ducked). No on-screen game buttons.
  let touch = null;
  stage.addEventListener("pointerdown", e => {
    if (e.target.closest && e.target.closest("button")) return; // overlay buttons
    e.preventDefault();
    if (state !== "play") { jump(); return; }                   // start / retry / resume
    touch = { y: e.clientY, duck: false };
    touch.timer = setTimeout(() => { if (touch) { touch.duck = true; setDuck(true); } }, 200);
  }, { passive: false });
  stage.addEventListener("pointermove", e => {
    if (!touch || state !== "play") return;
    if (e.clientY - touch.y > 24) { touch.duck = true; setDuck(true); clearTimeout(touch.timer); }
  });
  function endTouch() {
    if (!touch) return;
    clearTimeout(touch.timer);
    if (touch.duck) setDuck(false); else jump();                // tap → jump
    touch = null;
  }
  stage.addEventListener("pointerup", endTouch);
  stage.addEventListener("pointercancel", () => { if (touch) { clearTimeout(touch.timer); setDuck(false); touch = null; } });

  // Shared navigation helpers
  let howFrom = "title";
  function showSelect() { confetti = []; state = "select"; buildGrid(); showOverlay(selectOverlay); }
  function showHowTo(from) { howFrom = from; state = "howto"; showOverlay(howOverlay); }
  function markTutorialSeen() { tutorialSeen = true; try { localStorage.setItem("dino_seen", "1"); } catch (e) {} }

  // Title screen
  document.getElementById("startBtn").addEventListener("click", () => startLevel(level));
  document.getElementById("howToBtn").addEventListener("click", () => showHowTo("title"));
  document.getElementById("howStartBtn").addEventListener("click", () => {
    markTutorialSeen();
    if (howFrom === "boot") startLevel(1); else showTitle();
  });

  // Level clear
  nextBtn.addEventListener("click", () => startLevel(level >= TOTAL_LEVELS ? 1 : level + 1));
  document.getElementById("clearLevelsBtn").addEventListener("click", showSelect);
  document.getElementById("clearHomeBtn").addEventListener("click", goHome);

  // Game over
  document.getElementById("retryBtn").addEventListener("click", () => startLevel(level));
  document.getElementById("overLevelsBtn").addEventListener("click", showSelect);
  document.getElementById("overHomeBtn").addEventListener("click", goHome);

  // Footer "重玩本关" → replay current level immediately
  document.getElementById("resetBtn").addEventListener("click", () => startLevel(level));

  levelSelectBtn.addEventListener("click", showSelect);
  selectBackBtn.addEventListener("click", showTitle);

  skinsBtn.addEventListener("click", () => { state = "skins"; buildSkinGrid(); showOverlay(skinOverlay); });
  skinBackBtn.addEventListener("click", showTitle);

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem("dino_sound", soundOn ? "on" : "off"); } catch (e) {}
    updateSoundUI(); refreshSettings();
    if (soundOn) blip(520, 0.08);
  });

  // ---- Pause + Settings ----
  pauseBtn.addEventListener("click", () => { if (state === "play") pauseGame(); else if (state === "paused") resumeGame(); });
  document.getElementById("resumeBtn").addEventListener("click", resumeGame);
  document.getElementById("pauseRestartBtn").addEventListener("click", () => startLevel(level));
  document.getElementById("pauseLevelsBtn").addEventListener("click", showSelect);
  document.getElementById("pauseHomeBtn").addEventListener("click", goHome);

  function refreshSettings() {
    document.getElementById("setSoundVal").textContent = soundOn ? "On" : "Off";
    document.getElementById("setMotionVal").textContent = reduceMotion ? "On" : "Off";
  }
  function openSettings(from) { settingsFrom = from; refreshSettings(); state = "settings"; showOverlay(settingsOverlay); }
  let settingsFrom = "ready";
  document.getElementById("pauseSettingsBtn").addEventListener("click", () => openSettings("paused"));
  document.getElementById("titleSettingsBtn").addEventListener("click", () => openSettings("ready"));
  document.getElementById("setSoundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem("dino_sound", soundOn ? "on" : "off"); } catch (e) {}
    updateSoundUI(); refreshSettings(); if (soundOn) blip(520, 0.08);
  });
  document.getElementById("setMotionBtn").addEventListener("click", () => {
    reduceMotion = !reduceMotion;
    try { localStorage.setItem("dino_motion", reduceMotion ? "reduce" : "full"); } catch (e) {}
    refreshSettings();
  });
  document.getElementById("setResetBtn").addEventListener("click", () => {
    unlocked = 1; bestByLevel = {}; chosenSkin = null; saveProgress();
    try { localStorage.removeItem("dino_motion"); } catch (e) {}
    refreshSkinUI(); blip(330, 0.12, "sawtooth");
    goHome();
  });
  document.getElementById("settingsBackBtn").addEventListener("click", () => {
    if (settingsFrom === "paused") { state = "paused"; showOverlay(pauseOverlay); }
    else goHome();
  });

  window.addEventListener("resize", resize);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  reduceMotionMQ.addEventListener("change", e => { reduceMotion = e.matches; });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") pauseGame();
  });

  // ---- Boot ----
  loadLevel(1);
  resize();
  refreshHi();
  // First-time players see the tutorial card before anything else.
  if (!tutorialSeen) showHowTo("boot");
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
