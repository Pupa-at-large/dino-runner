(function () {
  "use strict";

  // ---- DOM ----
  const cv = document.getElementById("game");
  let ctx = cv.getContext("2d");   // reassignable so form thumbnails can draw into their own canvas
  const mainCtx = ctx;
  const stage = document.getElementById("stage");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const soundBtn = document.getElementById("soundBtn");

  const overlay = document.getElementById("overlay");
  const hiScore = document.getElementById("hiScore");
  const levelSelectBtn = document.getElementById("levelSelectBtn");

  const overOverlay = document.getElementById("overOverlay");
  const overStats = document.getElementById("overStats");

  const clearOverlay = document.getElementById("clearOverlay");
  const clearKicker = document.getElementById("clearKicker");
  const clearTitle = document.getElementById("clearTitle");
  const clearStats = document.getElementById("clearStats");
  const clearForm = document.getElementById("clearForm");
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
  const TOTAL_LEVELS = 30;

  // Per-level speed envelope. Pattern spacing is normalised against maxSpeed
  // (see buildSchedule), so a given pattern feels the same at any level.
  // Tuned so 30 levels ramp to the same top difficulty the old 50 did.
  function levelConfig(n) {
    return {
      startSpeed: 5.5 + (n - 1) * 0.15,            // L1 5.5  -> L30 ~9.9
      maxSpeed: Math.min(16, 8.8 + (n - 1) * 0.245), // L1 8.8 -> capped 16
      accel: 0.0024 + (n - 1) * 0.00003,
    };
  }

  // Hand-authored obstacle scores. One string per level, read left to right.
  // Obstacles:  c small cactus  C big cactus  2 double  3 triple  b bird (duck/jump)
  // Spacers:    .  small gap   -  medium gap   ~  large gap   (space is ignored)
  // Spacing is expressed in "jump units" relative to the level's top speed, so
  // every level stays passable regardless of its speed. See buildSchedule().
  // Tokens: c small cactus · C tall (double-jump) · 2/3 clusters · b bird ·
  //   _ ground gap (jump across) · ^ wall/step (jump onto the top, then off) ·
  //   = floating platform · spacers . - ~ (small/medium/large).
  // 30 levels, 10 Worlds of 3. Each World unlocks a new dino form, and the
  // mechanics ramp with it: W1 jump+gap · W2 walls+tall · W3 short duck-bar
  //  W4 birds+clusters · W5 dense combos · W6 LONG duck-bar (sustained)
  //  W7-W10 full gauntlet, escalating to the L30 finale.
  // Tokens: c/2/3 cacti · C tall(double-jump) · b bird(jump OR duck) · _ gap
  //  ^ wall(jump onto) · v short bar(duck under) · V long bar(hold duck)
  const LEVEL_PATTERNS = [
    // World 1 — Egg (L1-3): learn to jump; first gaps
    "c ~ c ~ _ ~ c",
    "c ~ 2 ~ _ ~ c ~ _",
    "2 ~ _ ~ c ~ _ ~ 2",
    // World 2 — Cracked egg (L4-6): walls + the tall (double-jump) cactus
    "c ~ ^ ~ _ ~ C",
    "C ~ _ ~ ^ ~ 2 ~ _",
    "2 ~ ^ ~ _ ~ C ~ ^",
    // World 3 — Legged egg (L7-9): the short duck-bar appears (slide under!)
    "c ~ v ~ _ ~ ^ ~ c",
    "2 ~ v ~ _ ~ C ~ v",
    "v ~ _ ~ ^ ~ v ~ 2 ~ _",
    // World 4 — Hatchling (L10-12): birds + clusters join the mix
    "3 ~ b ~ v ~ _ ~ ^",
    "b ~ ^ ~ v ~ _ ~ b ~ 3",
    "3 ~ _ ~ b ~ v ~ ^ ~ C",
    // World 5 — Young dino (L13-15): denser combos
    "3 - _ ~ ^ ~ v ~ 3 - _",
    "C - b ~ ^ ~ v ~ _ ~ C",
    "2 - 3 ~ _ ~ v ~ ^ ~ C ~ b",
    // World 6 — Horned (L16-18): the LONG bar — hold the duck through a tunnel
    "3 - ^ ~ V ~ _ ~ C - b",
    "C ~ _ ~ V ~ ^ ~ 3 ~ b",
    "2 - _ ~ V ~ b ~ ^ ~ 3 ~ v",
    // World 7 — Finback (L19-21): full mix
    "3 . _ ~ ^ ~ V ~ C . _ ~ b",
    "C - ^ ~ V ~ 3 . _ ~ b ~ v",
    "3 . _ ~ v ~ ^ ~ V ~ b - C",
    // World 8 — Twin-horn (L22-24): harder
    "3 . C - ^ ~ V ~ _ ~ 3 ~ b",
    "C . _ ~ v ~ b - ^ ~ V ~ C",
    "3 . v ~ _ ~ b - 3 . V ~ ^ ~ C",
    // World 9 — Blaze (L25-27): gauntlet
    "3 . _ ~ ^ ~ V ~ C . _ ~ b . v",
    "C . v ~ b - _ ~ 3 . ^ ~ V ~ C",
    "3 . _ ~ 3 . V ~ b - ^ ~ C ~ v",
    // World 10 — King → Super dino (L28-30): hardest; L30 a long finale
    "b . v ~ ^ ~ V ~ C . 3 ~ _ ~ b",
    "3 . _ ~ ^ ~ V ~ C . v ~ b . _ ~ C",
    "3 . _ ~ ^ ~ V ~ C . _ ~ b . v ~ _ ~ C ~ V",
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
  function buildSchedule(pattern, cfg) {
    const u = 44 * cfg.maxSpeed;    // ~ airtime (frames) * speed, sized for jumps
    // A ground gap's WIDTH must be crossable at the SLOWEST the dino ever moves
    // in this level (startSpeed) — jump reach scales with current speed, and the
    // dino hits early gaps before it has ramped up. Sizing by maxSpeed (as the
    // spacing is) would make those gaps wider than the low-speed jump can clear.
    const gapU = 44 * cfg.startSpeed;
    const BASE_GAP = 1.0 * u;       // implicit land-and-rejump gap
    let cursor = 360;               // lead-in before first obstacle
    const items = [];
    for (const ch of pattern) {
      if (ch === " ") continue;
      else if (ch === ".") cursor += 0.30 * u;
      else if (ch === "-") cursor += 0.62 * u;
      else if (ch === "~") cursor += 1.2 * u;
      // ---- platforming elements (Plan B) ----
      else if (ch === "_") {                 // ground gap — jump across (fall = death)
        cursor += 0.45 * u;                  // run-up to the edge
        const w = 0.50 * gapU;               // crossable at the level's min speed
        items.push({ at: cursor, type: "gap", w });
        const gc = cursor + w / 2;           // reward arc of coins over the gap
        items.push({ at: gc - 26, type: "coin", h: 66 });
        items.push({ at: gc,      type: "coin", h: 82 });
        items.push({ at: gc + 26, type: "coin", h: 66 });
        cursor += w + 0.9 * u;               // land + recover past the far edge
      } else if (ch === "=") {               // floating platform — jump onto, run, drop
        cursor += 0.5 * u;
        const w = 1.4 * u;
        items.push({ at: cursor, type: "platform", w, h: 92 });
        cursor += w + 0.8 * u;
      } else if (ch === "^") {               // wall/step — jump onto the top, then off
        cursor += 0.7 * u;
        const w = 0.6 * u;                   // a step-sized plateau, not a long mesa
        items.push({ at: cursor, type: "wall", w, h: 62 });
        items.push({ at: cursor + w / 2 - 16, type: "coin", h: 98 }); // coins to grab up top
        items.push({ at: cursor + w / 2 + 16, type: "coin", h: 98 });
        cursor += w + 1.0 * u;
      } else if (ch === "v" || ch === "V") {   // overhead bar — must DUCK under (can't jump over)
        const long = ch === "V";
        cursor += 0.75 * u;                  // run-up: land & start the duck in time
        const w = (long ? 1.7 : 0.55) * u;   // long = a tunnel you hold the duck through
        items.push({ at: cursor, type: "bar", w, clear: 50 });
        cursor += w + 0.95 * u;              // stand back up & recover
      } else {
        // Tall cacti need a double jump: isolate them so the player always has
        // room to set it up (before) and recover from its long airtime (after),
        // regardless of the spacer the pattern authored around them.
        if (ch === "C") cursor += 0.7 * u;
        items.push(makeScheduleItem(ch, cursor));
        cursor += obstacleFootprint(ch) + BASE_GAP + (ch === "C" ? 0.9 * u : 0);
      }
    }
    // Guarantee at least one coin per level (so every level can power up once).
    // If the pattern had no gap/wall to hang coins on, drop one at running height
    // in an open early stretch — the dino sweeps it up just by passing through.
    if (!items.some(it => it.type === "coin")) items.push({ at: 640, type: "coin", h: 44 });
    items.sort((a, b) => a.at - b.at);     // spawnDue expects ascending order
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
  const GROUND_OFFSET = 54;   // raised a little to leave room for pit spikes
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
  const MILESTONE = 5200;   // world distance between day/night flips (calm cadence)
  const dino = { x: 64, y: 0, vy: 0, ducking: false, onGround: true, crashed: false, jumps: 0 };
  let obstacles = [], clouds = [], particles = [], pops = [], confetti = [], gaps = [], coins = [];
  // Mario-mushroom power-up: a collected coin makes the dino BIG, which absorbs
  // one otherwise-lethal hit (then it shrinks back, briefly invincible).
  const POWER_SCALE = 1.3, COIN_SCORE = 50, MERCY_FRAMES = 72;
  let powered = false, mercyT = 0;
  let speed, dist, score, night = false, flashT = 0;
  let invertT = 0, pulseT = 0, toastT = 0, toastText = "", lastMilestone = 0;
  // Learn-by-doing tutorial (level 1, first run): freeze the world at the moment
  // a new move is needed, show an animated gesture prompt, resume on input.
  let tutorialMode = false;                       // level 1 && !tutorialSeen
  let teach = null;                               // null | "jump" | "double" | "duck"
  let teachTaps = 0, duckHold = 0;
  const taught = { jump: false, double: false, duck: false };
  let uiTick = 0;                                 // frame counter for UI pulses
  let dyingT = 0;                                 // death-animation countdown
  let revealStage = null;                          // form index to showcase on the clear screen
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
  let unlocked = 1, bestByLevel = {}, chosenSkin = null, tutorialSeen = false, championUnlocked = false; // chosenSkin null = always newest
  let tipsSeen = new Set();   // one-time "first-encounter" lessons already shown
  try {
    unlocked = parseInt(localStorage.getItem("dino_unlocked") || "1", 10) || 1;
    bestByLevel = JSON.parse(localStorage.getItem("dino_best") || "{}") || {};
    const sk = localStorage.getItem("dino_skin");
    if (sk != null && sk !== "auto") chosenSkin = parseInt(sk, 10);
    tutorialSeen = localStorage.getItem("dino_seen") === "1";
    championUnlocked = localStorage.getItem("dino_champion") === "1";
    const tips = localStorage.getItem("dino_tips");
    if (tips) tipsSeen = new Set(tips.split(",").filter(Boolean));
  } catch (e) {}
  function saveProgress() {
    try {
      localStorage.setItem("dino_unlocked", String(unlocked));
      localStorage.setItem("dino_best", JSON.stringify(bestByLevel));
      localStorage.setItem("dino_skin", chosenSkin == null ? "auto" : String(chosenSkin));
      localStorage.setItem("dino_champion", championUnlocked ? "1" : "0");
      localStorage.setItem("dino_tips", Array.from(tipsSeen).join(","));
    } catch (e) {}
  }
  function markTip(key) { tipsSeen.add(key); saveProgress(); }

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
    const rect = cv.getBoundingClientRect();
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
  // First-run level 1 is a guided lane that teaches the three moves in order
  // (jump → double jump → duck) with generous spacing; the freeze logic lives
  // in update(). Returning players get the gentle normal level 1.
  const TUTORIAL_PATTERN = "c ~~~ C ~~~ b ~~~";

  function loadLevel(n) {
    level = n; cfg = levelConfig(n);
    tutorialMode = (n === 1 && !tutorialSeen);
    const pattern = tutorialMode ? TUTORIAL_PATTERN : (LEVEL_PATTERNS[n - 1] || "c ~ c ~ c");
    const built = buildSchedule(pattern, cfg);
    schedule = built.items; goal = built.goal; schedIdx = 0;
    obstacles = []; clouds = []; particles = []; gaps = []; coins = [];
    powered = false; mercyT = 0;
    speed = cfg.startSpeed; dist = 0; score = 0; pops = []; confetti = [];
    night = false; flashT = 0; finishSpawned = false; midPlayed = false;
    invertT = 0; pulseT = 0; toastT = 0; lastMilestone = 0;
    teach = null; teachTaps = 0; duckHold = 0;
    taught.jump = taught.double = taught.duck = false;
    revealStage = null; clearOverlay.classList.remove("reveal"); clearForm.classList.add("hidden");
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
    pauseBtn.textContent = "❚❚";
    hideAllOverlays();
    blip(440, 0.08);
  }
  function clearLevel() {
    state = "clear";
    if (tutorialMode) markTutorialSeen();   // guided level 1 done — don't teach again
    const prevBest = bestByLevel[level] || 0;
    const s = Math.floor(score);
    if (s > prevBest) bestByLevel[level] = s;
    const stageBefore = maxUnlockedStage();
    if (level + 1 <= TOTAL_LEVELS && level + 1 > unlocked) unlocked = level + 1;
    if (level >= TOTAL_LEVELS) championUnlocked = true;   // beating the final level awakens the ultimate form
    const stageAfter = maxUnlockedStage();
    saveProgress();
    refreshSkinUI(); // newest form follows progress when on auto
    const newForm = stageAfter > stageBefore;
    revealStage = null;
    clearOverlay.classList.toggle("reveal", newForm);
    clearForm.classList.toggle("hidden", !newForm);
    if (newForm) renderFormThumb(clearForm, stageAfter, 132, 124);  // real art, in the overlay flow (no overlap)
    if (newForm) {
      const evo = EVOLUTIONS[stageAfter];
      if (evo.ultimate) {
        clearKicker.textContent = "🏆 通关 · CHAMPION";
        clearTitle.textContent = evo.emoji + " " + evo.name;
        clearStats.textContent = "征服全部 30 关 · 觉醒终极形态!";
      } else {
        clearKicker.textContent = "✨ 新形态解锁 · NEW FORM";
        clearTitle.textContent = evo.emoji + " " + evo.name;
        clearStats.textContent = "你进化啦! · 在「形态」里随时换装";
      }
    } else {
      clearKicker.textContent = "Level cleared";
      clearTitle.textContent = level >= TOTAL_LEVELS ? "All levels cleared!" : "Level " + level;
      clearStats.textContent = "Score " + String(s).padStart(5, "0") + " · Best " + String(bestByLevel[level] || s).padStart(5, "0");
    }
    nextBtn.textContent = level >= TOTAL_LEVELS ? "Play again" : "Next level \u2192";
    refreshHi();
    spawnConfetti();
    showOverlay(clearOverlay);
    fanfare();
    if (newForm) setTimeout(() => fanfare(), 260); // extra flourish on new form
  }
  // Collecting a coin grows the dino BIG. Being big absorbs one lethal hit.
  function gainPower(cn) {
    blip(740, 0.1, "triangle"); blip(990, 0.1, "triangle");
    if (cn && !reduceMotion)
      for (let i = 0; i < 7; i++)
        particles.push({ kind: "dot", x: cn.x, y: cn.y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3, r: 3, life: 18, max: 18 });
    if (!powered) {
      powered = true;
      pulseT = reduceMotion ? 0 : 18;
      if (!tipsSeen.has("coin")) { toastText = "\u2726 \u91d1\u5e01 \u00b7 \u53d8\u5927,\u53ef\u6321\u4e00\u6b21\u649e\u51fb"; toastT = 150; markTip("coin"); }
      else { toastText = "\u2726 \u53d8\u5927\u4e86 BIG"; toastT = 72; }
    }
  }
  // A lethal touch: if big, shrink + plow through + brief mercy (survives);
  // if already mid-mercy, ignore; otherwise it's a real crash. Returns true on death.
  function hitObstacle(o) {
    if (mercyT > 0) return false;
    if (powered) {
      powered = false; mercyT = MERCY_FRAMES;
      if (o) o.smashed = true;
      flashT = reduceMotion ? 0 : 6;
      blip(200, 0.14, "square");
      if (!tipsSeen.has("shield")) { toastText = "护盾抵挡!变回原形"; toastT = 130; markTip("shield"); }
      if (!reduceMotion)
        for (let i = 0; i < 8; i++)
          particles.push({ kind: "dust", x: dino.x + dino.w / 2, y: dino.y - dino.h / 2, r: 3 + Math.random() * 3, vr: 0, vx: (Math.random() - 0.5) * 5, vy: -1 - Math.random() * 3, life: 22, max: 22 });
      return false;
    }
    crash(); return true;
  }
  // Crash \u2192 a brief "death" beat on the playfield (frozen scene, crashed dino
  // pops and topples) before the Game over screen slides in.
  function crash() {
    state = "dying";
    dino.crashed = true;
    dino.ducking = false;
    dino.vy = -7;                      // little death hop
    dyingT = reduceMotion ? 1 : 44;    // ~0.7s (skipped under reduced motion)
    flashT = reduceMotion ? 0 : 8;
    blip(150, 0.2, "sawtooth");
    if (!reduceMotion)
      for (let i = 0; i < 9; i++)
        particles.push({ kind: "dust", x: dino.x + dino.w / 2, y: dino.y - dino.h / 2, r: 3 + Math.random() * 3, vr: 0, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, life: 26, max: 26 });
  }
  function tickDying() {
    // Scene stays frozen (update() doesn't run); only the dead dino + debris move.
    dino.vy = Math.min(dino.vy + GRAV, MAX_FALL);
    dino.y += dino.vy;
    if (dino.y > GROUND + 36) { dino.y = GROUND + 36; dino.vy = 0; }
    for (const p of particles) { p.x += p.vx; p.y += p.vy; if (p.kind === "dust") p.vy += 0.18; p.life--; }
    particles = particles.filter(p => p.life > 0);
    if (flashT > 0) flashT--;
    if (--dyingT <= 0) showGameOver();
  }
  function showGameOver() {
    state = "over";
    overStats.textContent = "Level " + level + " \u00b7 Score " + String(Math.floor(score)).padStart(5, "0");
    showOverlay(overOverlay);
  }
  function refreshHi() {
    let m = 0; for (const k in bestByLevel) if (bestByLevel[k] > m) m = bestByLevel[k];
    hiScore.textContent = "HI " + String(m).padStart(5, "0");
  }
  function showTitle() { state = "ready"; refreshHi(); showOverlay(overlay); render(); }
  function pauseGame() {
    if (state !== "play") return;
    state = "paused";
    pauseBtn.textContent = "▶";          // now tapping it resumes
    pauseStats.textContent = "Score " + String(Math.floor(score)).padStart(5, "0");
    showOverlay(pauseOverlay);
  }
  function resumeGame() {
    if (state !== "paused") return;
    state = "play";
    pauseBtn.textContent = "❚❚";         // back to a pause control
    hideAllOverlays();
  }
  function goHome() { loadLevel(level); showTitle(); }

  // ---- Overlay helpers ----
  function hideAllOverlays() { [overlay, clearOverlay, overOverlay, selectOverlay, skinOverlay, pauseOverlay, settingsOverlay].forEach(o => o.classList.add("hidden")); }
  function showOverlay(el) { hideAllOverlays(); el.classList.remove("hidden"); }

  // ---- Input ----
  function doJump(v, jumps) { dino.vy = v; dino.onGround = false; dino.jumps = jumps; dino.ducking = false; puff(); }
  // Resolve a tutorial lesson when the world is frozen waiting for the move.
  function teachInput(kind) {
    if (teach === "jump" && kind === "tap") { taught.jump = true; teach = null; doJump(JUMP_V, 1); blip(660, 0.06); }
    else if (teach === "double" && kind === "tap") {
      if (++teachTaps >= 2) { taught.double = true; teach = null; teachTaps = 0; doJump(-14, 2); blip(880, 0.06); }
      else blip(660, 0.06);
    } else if (teach === "duck" && kind === "duck") { taught.duck = true; teach = null; duckHold = 42; blip(523, 0.06); }
  }
  function jump() {
    if (state === "ready" || state === "over") { startLevel(level); return; }
    if (state === "paused") { resumeGame(); return; }
    if (state !== "play") return; // howto / clear / select / skins / settings
    if (teach) { if (isTipLesson(teach)) dismissTip(); else teachInput("tap"); return; }
    if (dino.onGround) {
      dino.vy = JUMP_V; dino.onGround = false; dino.jumps = 1; dino.ducking = false;
      if (tutorialMode) taught.jump = true;        // self-taught before the freeze
      blip(660, 0.06); puff();
    } else if (dino.jumps === 1) {
      dino.vy = JUMP_V2; dino.jumps = 2;           // double jump — extra height
      if (tutorialMode) taught.double = true;
      blip(880, 0.06); jumpArc();
    }
  }
  function releaseJump() { /* no-op: height now comes from the double jump */ }
  function setDuck(v) {
    if (teach) { if (v) { if (isTipLesson(teach)) dismissTip(); else teachInput("duck"); } return; }
    if (state === "play" && dino.onGround) { dino.ducking = v; if (v && tutorialMode) taught.duck = true; }
  }
  // Dismiss a first-encounter tip (any tap/key) — mark it seen and resume play.
  function dismissTip() { if (teach) { markTip(teach); teach = null; blip(620, 0.06); } }

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
      } else if (it.type === "coin") {
        coins.push({ x, y: GROUND - it.h, r: 11, taken: false, t: 0 });
      } else if (it.type === "gap") {
        gaps.push({ x, w: it.w });
      } else if (it.type === "platform") {
        obstacles.push({ type: "platform", x, y: GROUND - it.h, w: it.w });
      } else if (it.type === "bar") {
        obstacles.push({ type: "bar", x, y: GROUND - it.clear, w: it.w });
      } else if (it.type === "wall") {
        obstacles.push({ type: "wall", x, y: GROUND - it.h, w: it.w, h: it.h });
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

  // Which move the nearest oncoming obstacle needs, if it's at teaching range
  // and not yet taught (tutorial only).
  function pendingLesson() {
    let near = null;
    for (const o of obstacles) {
      if (o.type === "finish" || o.x + o.w <= dino.x) continue;
      if (!near || o.x < near.x) near = o;
    }
    if (!near || near.x - dino.x > 150) return null;
    const move = near.type === "bird" ? "duck" : (near.variant === "tall" ? "double" : "jump");
    return taught[move] ? null : move;
  }

  // First-encounter tips (any level, once ever): if the NEAREST oncoming thing
  // is a new mechanic the player hasn't been shown yet, freeze and explain it.
  function isTipLesson(t) { return t === "gap" || t === "wall" || t === "bar"; }
  function pendingTip() {
    let nearX = Infinity, key = null;
    for (const o of obstacles) {
      if (o.type === "finish" || o.x + o.w <= dino.x) continue;
      if (o.x < nearX) { nearX = o.x; key = o.type === "wall" ? "wall" : o.type === "bar" ? "bar" : null; }
    }
    for (const g of gaps) {
      if (g.x + g.w <= dino.x) continue;
      if (g.x < nearX) { nearX = g.x; key = "gap"; }
    }
    if (!key || tipsSeen.has(key) || !dino.onGround) return null;
    const d = nearX - dino.x;
    return (d > 40 && d <= 220) ? key : null;
  }

  // Is there solid ground at this screen-x? (false inside a pit)
  function groundUnder(px) {
    for (const g of gaps) if (px > g.x + 4 && px < g.x + g.w - 4) return false;
    return true;
  }

  // ---- Update ----
  function update() {
    // Learn-by-doing: freeze the world at the moment a new move is needed, and
    // (any level) the first time a new mechanic — gap / wall / bar — appears.
    if (!teach) {
      let m = tutorialMode ? pendingLesson() : null;
      if (!m) m = pendingTip();
      if (m) { teach = m; teachTaps = 0; }
    }
    if (teach) {
      dino.vy = Math.min(dino.vy + GRAV, MAX_FALL); // only the dino animates while frozen
      dino.y += dino.vy;
      if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; dino.onGround = true; dino.jumps = 0; }
      return;
    }
    if (duckHold > 0) { duckHold--; if (dino.onGround) dino.ducking = true; }

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

    const prevFeet = dino.y;
    dino.vy = Math.min(dino.vy + GRAV, MAX_FALL);
    dino.y += dino.vy;
    // Support: land one-way on the highest platform/wall top under the dino's
    // centre, else on the ground (unless over a gap). Falling past the ground
    // with no support = a pit death.
    const cxp = dino.x + dino.w * 0.5;
    let surfTop = null;
    for (const o of obstacles) {
      if (o.type !== "platform" && o.type !== "wall") continue;
      if (cxp > o.x && cxp < o.x + o.w && dino.vy >= 0 && prevFeet <= o.y + 1 && dino.y >= o.y) {
        if (surfTop === null || o.y < surfTop) surfTop = o.y;
      }
    }
    if (surfTop !== null) {
      dino.y = surfTop; dino.vy = 0;
      if (!dino.onGround) { dino.onGround = true; dino.jumps = 0; puff(); }
    } else if (dino.y >= GROUND && groundUnder(cxp)) {
      dino.y = GROUND; dino.vy = 0;
      if (!dino.onGround) { dino.onGround = true; dino.jumps = 0; puff(); }
    } else {
      dino.onGround = false;
      if (dino.y > GROUND + 40) { crash(); return; } // fell onto the pit spikes
    }

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
    for (const g of gaps) g.x -= speed;
    gaps = gaps.filter(g => g.x + g.w > -10);
    // Coins: scroll, bob, and auto-collect on overlap → grow big (power-up).
    for (const cn of coins) {
      cn.x -= speed; cn.t++;
      if (!cn.taken && cn.x > dino.x - cn.r && cn.x < dino.x + dino.w + cn.r &&
          cn.y > dino.y - dino.h - cn.r && cn.y < dino.y + cn.r) {
        cn.taken = true; score += COIN_SCORE; gainPower(cn);
      }
    }
    coins = coins.filter(cn => !cn.taken && cn.x + cn.r > -10);

    // Jump-arc trail (DESIGN_SPEC §4): accent dots along the parabola — richer
    // and sparklier as the dino evolves (stage 0..10).
    if (!dino.onGround && !reduceMotion) {
      const s = effectiveStage(), cx = dino.x + dino.w * 0.5, cy = dino.y - dino.h * 0.5;
      particles.push({ kind: "dot", x: cx, y: cy, vx: -speed * 0.4, vy: 0, r: 3 + s * 0.18, life: 16, max: 16 });
      if (s >= 5 && Math.random() < 0.55)
        particles.push({ kind: "star", x: cx + (Math.random() - 0.5) * 12, y: cy + (Math.random() - 0.5) * 12, vx: -speed * 0.5, vy: (Math.random() - 0.5) * 1.4, r: 2.4 + s * 0.12, life: 18 + s, max: 18 + s, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3 });
    }

    for (const c of clouds) { c.x -= c.s * 1.1; if (c.x < -60) { c.x = BASE_W + 30; c.y = 24 + Math.random() * 60; } }
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === "dust") { p.vy += 0.18; p.r += p.vr || 0; }
      if (p.rot != null) p.rot += p.vr || 0;
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
      if (o.type === "platform") continue;          // one-way; landing handled above, never kills
      if (o.type === "bar") {                        // overhead bar — only a duck passes under
        const ducked = dino.ducking && dino.onGround;
        if (!ducked && dino.x + dino.w > o.x + 4 && dino.x < o.x + o.w - 4) { if (hitObstacle(o)) return; }
        continue;
      }
      if (o.type === "wall") {                       // smashing into the front face kills
        if (dino.x + dino.w > o.x + 2 && dino.x < o.x + 2 && dino.y > o.y + 6) { if (hitObstacle(o)) return; }
        continue;                                    // top is landable (handled above)
      }
      const pad = 4;
      const ob = { x: o.x + pad, y: o.y, w: o.w - pad * 2, h: o.h - pad };
      if (box.x < ob.x + ob.w && box.x + box.w > ob.x && box.y - box.h < ob.y && box.y > ob.y - ob.h) { if (hitObstacle(o)) return; }
    }
    obstacles = obstacles.filter(o => !o.smashed);

    if (dist >= goal) { clearLevel(); return; }

    legTick += speed * 0.06;
    if (mercyT > 0) mercyT--;
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

  // Dust at the takeoff/landing foot — more & bigger as the dino evolves.
  function puff() {
    if (reduceMotion) return;
    const s = effectiveStage(), n = 3 + Math.floor(s / 3);   // 3..6
    for (let i = 0; i < n; i++)
      particles.push({ kind: "dust", x: dino.x + 6 + i * 5, y: GROUND - 2, r: (5 - i * 0.6) + s * 0.1, vr: 0.35, vx: -1 - Math.random(), vy: -0.5, life: 16 + i * 3, max: 16 + i * 3 });
  }
  // Accent burst on the double jump — grows into a starry pop at high stages.
  function jumpArc() {
    if (reduceMotion) return;
    const s = effectiveStage(), n = 4 + Math.floor(s / 2);
    for (let i = 0; i < n; i++)
      particles.push({ kind: "dot", x: dino.x + dino.w * 0.5, y: dino.y - dino.h * 0.6 - i * 4, vx: -speed * 0.3, vy: 0, r: 3, life: 18, max: 18 });
    if (s >= 5)
      for (let i = 0; i < Math.floor(s / 2); i++)
        particles.push({ kind: "star", x: dino.x + dino.w * 0.5 + (Math.random() - 0.5) * 26, y: dino.y - dino.h * 0.6 + (Math.random() - 0.5) * 22, vx: -speed * 0.3 + (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, r: 3 + s * 0.12, life: 22, max: 22, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4 });
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
    { name: "破壳",   from: 4,  emoji: "🥚", scale: 0.66, kind: "hatch" },
    { name: "幼龙",   from: 7,  emoji: "🐣", scale: 0.74, kind: "dino", orn: {} },
    { name: "少年龙", from: 10, emoji: "🦎", scale: 0.82, kind: "dino", orn: { spikes: 1 } },
    { name: "角龙",   from: 13, emoji: "🦎", scale: 0.90, kind: "dino", orn: { horns: 1 } },
    { name: "背鳍龙", from: 16, emoji: "🦖", scale: 0.97, kind: "dino", orn: { plates: 1 } },
    { name: "双角龙", from: 19, emoji: "🦖", scale: 1.04, kind: "dino", orn: { spikes: 1, horns: 2 } },
    { name: "烈焰龙", from: 22, emoji: "🐉", scale: 1.09, kind: "dino", orn: { crest: 1, tailFlame: 1, belly: 1, accentEye: 1 } },
    { name: "王者龙", from: 25, emoji: "🐉", scale: 1.13, kind: "dino", orn: { crown: 1, horns: 1, belly: 1, accentEye: 1 } },
    { name: "巨龙",   from: 28, emoji: "🐲", scale: 1.18, kind: "dino", orn: { plates: 1, crest: 1, horns: 2, wing: 1, belly: 1, accentEye: 1 } },
    // Ultimate: only unlocked by CLEARING the final level (gated by
    // championUnlocked, not `unlocked`). Biggest form, crowned & fully ornamented.
    { name: "神龙", from: 99, emoji: "👑", scale: 1.25, kind: "dino", ultimate: true, orn: { plates: 1, crest: 1, crown: 1, wing: 1, belly: 1, accentEye: 1, tailFlame: 1 } },
  ];

  function maxUnlockedStage() {
    let m = 0;
    for (let i = 0; i < EVOLUTIONS.length; i++) {
      const e = EVOLUTIONS[i];
      if (e.ultimate) { if (championUnlocked) m = i; }   // earned by clearing L50
      else if (e.from <= unlocked) m = i;
    }
    return m;
  }
  function effectiveStage() {
    const max = maxUnlockedStage();
    return Math.max(0, Math.min(chosenSkin == null ? max : chosenSkin, max));
  }
  function formScale() { return EVOLUTIONS[effectiveStage()].scale * (powered ? POWER_SCALE : 1); }

  // The 96×100 form box anchored to the dino: body-left at dino.x, feet at dino.y.
  // DINO_DRAW is a VISUAL-only enlargement (the hitbox in update() is unchanged),
  // so the dino reads bigger on small screens without making the game harder.
  const DINO_DRAW = 1.3;
  function formBox() {
    const unit = PXU * formScale() * DINO_DRAW;
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
      // running stride — the FEET clearly alternate planted (at ground) and
      // lifted, so the run reads at every form scale.
      const backDown = step;
      const backFt = backDown ? 85 : 77, frontFt = backDown ? 77 : 85;
      rrect(fx(28), fy(63), fw(11), fh(backFt - 63), fr(3));   // back leg
      rrect(fx(25), fy(backFt), fw(16), fh(6), fr(2));          // back foot
      rrect(fx(48), fy(63), fw(11), fh(frontFt - 63), fr(3));   // front leg
      rrect(fx(47), fy(frontFt), fw(16), fh(6), fr(2));         // front foot
    } else {
      // airborne — legs tucked together
      rrect(fx(28), fy(62), fw(11), fh(18), fr(3)); rrect(fx(25), fy(80), fw(16), fh(6), fr(2));
      rrect(fx(48), fy(66), fw(11), fh(14), fr(3)); rrect(fx(47), fy(80), fw(16), fh(6), fr(2));
    }
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
    else rrect(fx(26), fy(24), fw(44), fh(52), fr(18));     // egg body (raised onto legs)
    ctx.fillStyle = c.hot; triBox(fx(41), fy(6), fw(14), fh(22), [[0.5, 0], [1, 1], [0, 1]]); // horn
    ctx.fillStyle = c.eye;                                   // 3 face dots
    rrect(fx(36), fy(46), fw(4), fh(4), fr(2)); rrect(fx(44), fy(44), fw(4), fh(4), fr(2)); rrect(fx(52), fy(46), fw(4), fh(4), fr(2));
    if (!duck) { // two thin running legs — feet alternate planted / lifted
      ctx.fillStyle = c.fg;
      const lFt = step ? 87 : 79, rFt = step ? 79 : 87;
      rrect(fx(40), fy(74), fw(5), fh(lFt - 74), fr(2)); rrect(fx(36), fy(lFt), fw(12), fh(4), fr(2));
      rrect(fx(53), fy(74), fw(5), fh(rFt - 74), fr(2)); rrect(fx(52), fy(rFt), fw(12), fh(4), fr(2));
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
    ctx.fillStyle = c.fg;                                    // two feet, alternating
    const lFt = step ? 94 : 90, rFt = step ? 90 : 94;
    rrect(fx(37), fy(86), fw(4), fh(lFt - 86), fr(2)); rrect(fx(34), fy(lFt), fw(11), fh(4), fr(2));
    rrect(fx(55), fy(86), fw(4), fh(rFt - 86), fr(2)); rrect(fx(54), fy(rFt), fw(11), fh(4), fr(2));
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

  // Draw an arbitrary standing form into a given box (used by the live dino and
  // the new-form showcase on the clear screen).
  function drawFormAt(c, evo, B) {
    if (evo.kind === "egg") { drawEgg(c, B, false); return; }
    if (evo.kind === "hatch") { drawHatch(c, B, false); return; }
    const o = evo.orn || {};
    if (o.wing) drawWing(c, B);
    dinoBase(c, B, !!o.accentEye);
    drawDinoOrnaments(c, B, o);
  }
  // Render a form's ACTUAL drawn art into a small canvas, so the Forms picker
  // shows the real character (not an Apple emoji). Temporarily swaps the global
  // ctx to the thumbnail's context and forces a clean standing pose.
  function renderFormThumb(canvas, idx, W, H) {
    W = W || 46; H = H || 44;
    const d = dpr || Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * d; canvas.height = H * d;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const c2 = canvas.getContext("2d");
    c2.setTransform(d, 0, 0, d, 0, 0);
    c2.clearRect(0, 0, W, H);
    const evo = EVOLUTIONS[idx];
    const theme = { fg: "#1A1A1A", ink: "#1A1A1A", hot: C_ACCENT, accent: C_ACCENT, eye: "#fff", bg: "#fff", mid: "#B8B5AD", line: "#B8B5AD", secondary: "#B8B5AD" };
    const boxW = W * 0.82, boxH = boxW * 100 / 96;
    const B = { unit: boxW / 96, boxW, boxH, boxLeft: (W - boxW) / 2, boxTop: H - 0.86 * boxH };
    const savedOn = dino.onGround, savedLeg = legTick, savedCrash = dino.crashed;
    dino.onGround = true; legTick = 0; dino.crashed = false;
    const prev = ctx; ctx = c2;
    try { drawFormAt(theme, evo, B); } finally { ctx = prev; }
    dino.onGround = savedOn; legTick = savedLeg; dino.crashed = savedCrash;
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
    else { drawFormAt(c, evo, B); }
    if (crash) crashEye(c, B);
  }
  // Big centred showcase of a newly-unlocked form, with a gentle bob.
  function drawFormShowcase(c, idx) {
    const evo = EVOLUTIONS[idx];
    const unit = PXU * evo.scale * 2.6;
    const boxW = 96 * unit, boxH = 100 * unit;
    const bob = Math.sin(uiTick * 0.12) * 6;
    const B = { unit, boxW, boxH, boxLeft: BASE_W / 2 - boxW / 2, boxTop: BASE_H * 0.46 - 0.91 * boxH + bob };
    drawFormAt(c, evo, B);
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
  // 4-point sparkle (concave star), for the high-stage jump trail.
  function drawSparkle(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4, rr = i % 2 === 0 ? r : r * 0.4;
      const X = Math.cos(ang) * rr, Y = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
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
  // Ground hazards re-skin every 2 worlds, matching the dino's evolution:
  //  0 cactus · 1 rock · 2 crystal · 3 bone · 4 obsidian.
  function terrainTier() { return Math.min(4, Math.floor((level - 1) / 6)); }
  function drawCactus(c, x, gy, W, H, bush) {
    const top = gy - H;
    const px = L => x + (L / 72) * W, py = T => top + (T / 68) * H;
    const pw = w => (w / 72) * W, ph = h => (h / 68) * H, pr = r => (r / 72) * W;
    const tri = pts => triBox(x, top, W, H, pts);
    const tier = terrainTier();
    if (tier === 1) {                       // ROCK — chunky boulder with peaks
      ctx.fillStyle = c.fg;
      rrect(px(6), py(32), pw(60), ph(36), pr(9));
      tri([[0.06, 0.56], [0.34, 0.02], [0.52, 0.56]]);
      tri([[0.46, 0.56], [0.74, 0.16], [0.96, 0.56]]);
      return;
    }
    if (tier === 2) {                       // CRYSTAL — sharp shards, accent tip
      ctx.fillStyle = c.fg;
      tri([[0.02, 1], [0.2, 0.18], [0.36, 1]]);
      tri([[0.3, 1], [0.5, 0.0], [0.72, 1]]);
      tri([[0.64, 1], [0.82, 0.26], [0.98, 1]]);
      ctx.fillStyle = c.accent;
      tri([[0.42, 0.4], [0.5, 0.0], [0.58, 0.4]]);
      return;
    }
    if (tier === 3) {                       // BONE — totem shaft with knobs
      ctx.fillStyle = c.fg;
      rrect(px(29), py(8), pw(14), ph(54), pr(5));
      rrect(px(22), py(3), pw(12), ph(13), pr(6)); rrect(px(38), py(3), pw(12), ph(13), pr(6));
      rrect(px(22), py(52), pw(12), ph(13), pr(6)); rrect(px(38), py(52), pw(12), ph(13), pr(6));
      ctx.fillStyle = c.accent; rrect(px(27), py(31), pw(18), ph(4), pr(2));
      return;
    }
    if (tier === 4) {                       // OBSIDIAN — jagged shard, accent glint
      ctx.fillStyle = c.fg;
      tri([[0.5, 0.0], [0.96, 0.62], [0.5, 1]]);
      tri([[0.5, 0.0], [0.04, 0.62], [0.5, 1]]);
      ctx.fillStyle = c.accent;
      tri([[0.5, 0.06], [0.84, 0.56], [0.62, 0.56]]);
      return;
    }
    // tier 0 — classic cactus
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
      if (!groundUnder(gx + 4)) continue;           // leave a hole over gaps
      ctx.fillRect(gx, GROUND + 2, 8, 2);
    }
    // Pits read as an obvious hazard: bold ink lips on each broken edge plus a
    // row of accent spikes at the bottom, visible well before the dino arrives.
    const lipH = 11, top = GROUND + 13, baseY = GROUND + 31, sw = 15;
    for (const g of gaps) {
      const left = g.x, right = g.x + g.w;
      ctx.fillStyle = c.ink;
      ctx.fillRect(left - 4, GROUND, 4, lipH);
      ctx.fillRect(right, GROUND, 4, lipH);
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      for (let sx = left + 2; sx + sw <= right - 2; sx += sw) {
        ctx.moveTo(sx, baseY);
        ctx.lineTo(sx + sw / 2, top);
        ctx.lineTo(sx + sw, baseY);
      }
      ctx.fill();
    }
  }

  function drawCloud(c, cl) {
    const W = 64, x = cl.x, y = cl.y;
    ctx.fillStyle = c.secondary;
    rrect(x + (4 / 72) * W, y + 8, (34 / 72) * W, 14, 7);
    rrect(x + (22 / 72) * W, y, (32 / 72) * W, 18, 9);
    rrect(x + (40 / 72) * W, y + 8, (26 / 72) * W, 13, 7);
  }

  // Floating coins: an accent ring with a centre pip, gently bobbing.
  function drawCoins(c) {
    for (const cn of coins) {
      if (cn.taken) continue;
      const by = cn.y + (reduceMotion ? 0 : Math.sin(cn.t * 0.15) * 3);
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(cn.x, by, cn.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.bg;
      ctx.beginPath(); ctx.arc(cn.x, by, cn.r * 0.54, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(cn.x, by, cn.r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Parallax background that EVOLVES with the dino (terrainTier 0..4): the world
  // grows upward — plains → hills → mountains → towering peaks → the sky itself —
  // so each stage feels like ascending. Drawn in the muted secondary colour
  // (day/night aware), behind the action, with ambient life (embers / stars).
  function drawHills(c) {
    const tier = terrainTier();
    ctx.fillStyle = c.secondary;
    const band = (gap, par, a, drawOne) => {
      ctx.globalAlpha = a;
      const off = ((dist * par) % gap + gap) % gap;
      for (let x = -off; x < BASE_W + gap; x += gap) drawOne(x + gap / 2);
    };
    const dome = (base, r) => cx => { ctx.beginPath(); ctx.arc(cx, base, r, Math.PI, 2 * Math.PI); ctx.fill(); };
    const peak = (base, h, halfW) => cx => { ctx.beginPath(); ctx.moveTo(cx - halfW, base); ctx.lineTo(cx, base - h); ctx.lineTo(cx + halfW, base); ctx.closePath(); ctx.fill(); };
    const isle = (base, w, h) => cx => { rrect(cx - w / 2, base - h, w, h, h * 0.5); };
    if (tier === 0) {                                   // plains — humble start
      band(300, 0.18, 0.16, dome(GROUND + 10, 86));
      band(200, 0.34, 0.26, dome(GROUND + 20, 58));
    } else if (tier === 1) {                            // rolling hills
      band(360, 0.16, 0.15, dome(GROUND + 26, 128));
      band(230, 0.32, 0.24, dome(GROUND + 28, 84));
    } else if (tier === 2) {                            // mountains rising
      band(320, 0.15, 0.15, peak(GROUND + 8, 168, 140));
      band(200, 0.33, 0.24, peak(GROUND + 12, 104, 88));
    } else if (tier === 3) {                            // towering volcanic peaks
      band(340, 0.14, 0.17, peak(GROUND + 8, 232, 128));
      band(210, 0.31, 0.25, peak(GROUND + 12, 150, 82));
      drawEmbers(c);
    } else {                                            // the heavens — ascended
      band(380, 0.13, 0.13, peak(GROUND + 24, 96, 160));  // a distant cloud-sea of summits
      band(320, 0.22, 0.16, isle(GROUND - 150, 130, 26));  // floating islands
      band(240, 0.30, 0.13, isle(GROUND - 270, 86, 18));
      drawStars(c);
    }
    ctx.globalAlpha = 1;
  }
  // Volcanic embers drifting up (tier 3) — a few deterministic accent motes.
  function drawEmbers(c) {
    ctx.fillStyle = c.accent;
    for (let i = 0; i < 10; i++) {
      const span = BASE_W + 40;
      const x = ((i * 167 - dist * 0.6) % span + span) % span - 20;
      const climb = (i * 53 + dist * 0.7) % 230;
      const y = GROUND - climb;
      const a = 0.4 * (1 - climb / 230) * (0.6 + 0.4 * Math.sin(uiTick * 0.2 + i));
      ctx.globalAlpha = Math.max(0, a);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Twinkling stars in the upper sky (tier 4), a few as accent sparkles.
  function drawStars(c) {
    const span = BASE_W + 30, hi = Math.max(60, GROUND - 240);
    for (let i = 0; i < 16; i++) {
      const x = ((i * 91 - dist * 0.08) % span + span) % span - 15;
      const y = 28 + (i * 137) % hi;
      const tw = 0.35 + 0.45 * Math.sin(uiTick * 0.12 + i * 1.3);
      ctx.globalAlpha = Math.max(0.05, tw);
      if (i % 4 === 0) { ctx.fillStyle = c.accent; drawSparkle(x, y, 3.4, uiTick * 0.02 + i); }
      else { ctx.fillStyle = c.secondary; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawObstacle(o, c) {
    if (o.type === "platform") {
      ctx.fillStyle = c.fg; rrect(o.x, o.y, o.w, 12, 5);
      ctx.fillStyle = c.mid; rrect(o.x + 4, o.y + 4, o.w - 8, 3, 2); // top groove
      return;
    }
    if (o.type === "bar") {
      const topY = 4, bottom = o.y;                 // o.y is the bar's bottom edge
      ctx.fillStyle = c.fg; rrect(o.x, topY, o.w, bottom - topY, 6);
      ctx.fillStyle = c.bg;                          // seams for texture
      for (let sx = o.x + 44; sx < o.x + o.w - 8; sx += 44) ctx.fillRect(sx, topY + 6, 2, (bottom - topY) * 0.62);
      ctx.fillStyle = c.accent;                      // danger lip + downward spikes ("don't raise your head")
      rrect(o.x, bottom - 6, o.w, 6, 3);
      const tw = 18;
      ctx.beginPath();
      for (let tx = o.x + 6; tx + tw <= o.x + o.w - 6; tx += tw) { ctx.moveTo(tx, bottom); ctx.lineTo(tx + tw / 2, bottom + 9); ctx.lineTo(tx + tw, bottom); }
      ctx.fill();
      return;
    }
    if (o.type === "wall") {
      const wh = GROUND - o.y;
      ctx.fillStyle = c.fg; rrect(o.x, o.y, o.w, wh, 6);
      // brick seams (in bg) so it reads as a built wall/step, not raised floor
      ctx.fillStyle = c.bg;
      ctx.fillRect(o.x + 2, o.y + wh * 0.5, o.w - 4, 2);           // mid course
      const bw = 46;
      for (let bx = o.x + bw; bx < o.x + o.w - 6; bx += bw) {
        ctx.fillRect(bx, o.y + 4, 2, wh * 0.5 - 6);                // upper verticals
        ctx.fillRect(bx + bw * 0.5, o.y + wh * 0.5 + 2, 2, wh * 0.5 - 6); // lower (offset)
      }
      ctx.fillStyle = c.accent; rrect(o.x + o.w * 0.5 - 9, o.y + 5, 18, 3, 1.5); // top accent
      return;
    }
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
    uiTick++;
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

    drawHills(c);
    for (const cl of clouds) drawCloud(c, cl);
    drawGround(c);
    if (state === "ready") drawCactus(c, BASE_W * 0.62, GROUND, 38, 66, false); // title scene

    for (const o of obstacles) drawObstacle(o, c);
    drawCoins(c);

    // particles: dust (secondary circles), jump-arc dots + sparkle stars (accent)
    for (const p of particles) {
      const a = Math.max(0, p.life / (p.max || 16));
      if (p.kind === "star") {
        ctx.globalAlpha = Math.max(0.35, a); ctx.fillStyle = c.accent;
        drawSparkle(p.x, p.y, p.r || 3, p.rot || 0);
      } else {
        ctx.globalAlpha = p.kind === "dot" ? Math.max(0.3, a) : 0.5 * a;
        ctx.fillStyle = p.kind === "dot" ? c.accent : c.secondary;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Power aura: a pulsing accent ring around the big dino.
    if (powered && state !== "ready") {
      const B = formBox();
      const cx = B.boxLeft + B.boxW * 0.5, cy = B.boxTop + B.boxH * 0.56;
      const rad = Math.max(B.boxW, B.boxH) * 0.6 + (reduceMotion ? 0 : Math.sin(uiTick * 0.2) * 3);
      ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.45; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    // Mercy invincibility blinks the dino; the death flash hides it on alt frames.
    const flashHide = flashT > 0 && Math.floor(flashT) % 2 === 0;
    const mercyHide = mercyT > 0 && !reduceMotion && Math.floor(uiTick) % 8 < 3;
    if (!flashHide && !mercyHide) drawDino(c);

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
    drawTeachPrompt(c);

    scoreEl.textContent = String(Math.floor(score)).padStart(5, "0");
  }

  // Learn-by-doing prompt: a minimal animated gesture above the dino, shown
  // only while the world is frozen waiting for that move (DESIGN_SPEC-style,
  // no wall of text — like Subway Surfers / Temple Run).
  // Lesson copy: [title, control hint]. Controls spell out BOTH touch and
  // keyboard so first-time players know either input works.
  const LESSON = {
    jump:   ["跳 JUMP", "点击屏幕 / 空格 / ↑"],
    double: ["二段跳 DOUBLE", "空中再点一次 / 再按空格"],
    duck:   ["下蹲 DUCK", "向下滑 / ↓ 键"],
    gap:    ["缺口 · 跳过去!", "点击 / 空格 — 掉下去会摔"],
    wall:   ["高墙 · 跳上去", "点击 / 空格,落到墙顶"],
    bar:    ["低梁 · 蹲下钻过", "向下滑 / ↓ — 跳起会撞到"],
  };
  function drawTeachPrompt(c) {
    if (!teach) return;
    const down = teach === "duck" || teach === "bar";
    const cx = dino.x + dino.w / 2, cy = dino.y - dino.h - 64;
    const pulse = 1 + 0.10 * Math.sin(uiTick * 0.2);
    const bob = Math.sin(uiTick * 0.2) * 4;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.15; ctx.fillStyle = c.accent;
    ctx.beginPath(); ctx.arc(0, 4, 36, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = c.accent;
    if (down) triBox(-13, -6 - bob, 26, 15, [[0, 0], [1, 0], [0.5, 1]]);
    else { triBox(-13, -2 + bob, 26, 15, [[0.5, 0], [1, 1], [0, 1]]); if (teach === "double") triBox(-13, -18 + bob, 26, 15, [[0.5, 0], [1, 1], [0, 1]]); }
    ctx.restore();
    const L = LESSON[teach] || ["", ""];
    const title = teach === "double" && teachTaps >= 1 ? "再来一下!" : L[0];
    const midX = BASE_W / 2, ty = cy + 24;       // centred so long labels never clip
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = c.accent;
    ctx.font = "700 23px 'Space Grotesk', sans-serif";
    ctx.fillText(title, midX, ty);
    ctx.fillStyle = c.ink;
    ctx.font = "600 14px 'Space Grotesk', sans-serif";
    ctx.fillText(L[1], midX, ty + 24);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // Fixed-timestep loop: the simulation always advances at 60 steps/sec no
  // matter the display refresh rate, so 90/120Hz phones don't run the game at
  // 1.5–2× speed. render() still runs once per animation frame for smoothness.
  const FRAME_MS = 1000 / 60;
  let lastFrameT = 0, simAcc = 0;
  function loop(t) {
    t = t || 0;
    if (!lastFrameT) lastFrameT = t;
    let dt = t - lastFrameT;
    lastFrameT = t;
    if (!(dt >= 0) || dt > 250) dt = FRAME_MS;   // clamp NaN / long tab-away pauses
    simAcc += dt;
    let steps = 0;
    while (simAcc >= FRAME_MS && steps < 5) {     // catch up, but never spiral
      if (state === "play") update();
      else if (state === "dying") tickDying();
      tickConfetti();   // animates over the clear overlay (state !== play)
      simAcc -= FRAME_MS; steps++;
    }
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
      if (locked) {
        const g = document.createElement("span");
        g.className = "skin-emoji"; g.textContent = "🔒";
        cell.appendChild(g);
      } else {
        // The real in-game character art (not an Apple emoji).
        const thumb = document.createElement("canvas");
        thumb.className = "skin-thumb";
        renderFormThumb(thumb, i);
        cell.appendChild(thumb);
      }
      const name = document.createElement("span");
      name.className = "skin-name";
      name.textContent = locked ? (evo.ultimate ? "通关 L30" : "Level " + evo.from) : evo.name;
      cell.appendChild(name);
      if (!locked) cell.addEventListener("click", () => {
        chosenSkin = (i === max) ? null : i; // picking the newest returns to auto
        saveProgress(); refreshSkinUI(); buildSkinGrid(); blip(560, 0.06);
      });
      skinGrid.appendChild(cell);
    });
  }

  // ---- Events ----
  function isJumpKey(e) { return e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.code === "KeyA"; }
  function isDuckKey(e) { return e.code === "ArrowDown" || e.code === "KeyS"; }
  window.addEventListener("keydown", e => {
    if (isJumpKey(e)) { e.preventDefault(); jump(); }
    else if (isDuckKey(e)) { e.preventDefault(); setDuck(true); }
    else if (e.code === "Escape" || e.code === "KeyP") { if (state === "play") pauseGame(); else if (state === "paused") resumeGame(); }
  }, { passive: false });
  window.addEventListener("keyup", e => {
    if (isJumpKey(e)) releaseJump();
    else if (isDuckKey(e)) setDuck(false);
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
  function showSelect() { confetti = []; state = "select"; buildGrid(); showOverlay(selectOverlay); }
  function markTutorialSeen() { tutorialSeen = true; try { localStorage.setItem("dino_seen", "1"); } catch (e) {} }

  // Title screen
  document.getElementById("startBtn").addEventListener("click", () => startLevel(level));

  // Level clear
  nextBtn.addEventListener("click", () => startLevel(level >= TOTAL_LEVELS ? 1 : level + 1));
  document.getElementById("clearLevelsBtn").addEventListener("click", showSelect);
  document.getElementById("clearHomeBtn").addEventListener("click", goHome);

  // Game over
  document.getElementById("retryBtn").addEventListener("click", () => startLevel(level));
  document.getElementById("overLevelsBtn").addEventListener("click", showSelect);
  document.getElementById("overHomeBtn").addEventListener("click", goHome);

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
  document.getElementById("pauseGlyph").addEventListener("click", resumeGame);
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
    unlocked = 1; bestByLevel = {}; chosenSkin = null; championUnlocked = false; tipsSeen.clear(); saveProgress();
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
  render();
  requestAnimationFrame(loop);

  // Read-only test hook for automated playtesting. Inert unless the page is
  // opened with ?bot in the query string — adds nothing to normal play.
  if (location.search.indexOf("bot") >= 0) {
    window.__dino = {
      get state() { return state; }, get level() { return level; },
      get dino() { return dino; }, get obstacles() { return obstacles; },
      get gaps() { return gaps; }, get coins() { return coins; },
      get powered() { return powered; }, get mercy() { return mercyT; },
      get teach() { return teach; },
      get speed() { return speed; }, get ground() { return GROUND; },
      get goal() { return goal; }, get dist() { return dist; },
      jump, releaseJump, setDuck, next: () => nextBtn.click(),
    };
  }
})();
