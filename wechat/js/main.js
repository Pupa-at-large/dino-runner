// ===========================================================================
// Dino Runner — WeChat Mini-Game (微信小游戏) MVP
// ---------------------------------------------------------------------------
// Ported from the web version (../../game.js). The game engine (constants,
// level schedule, evolutions, physics/collision, and ALL drawing functions) is
// reused verbatim; only the shell was rewritten: no DOM/CSS/HTML, everything is
// drawn on a single wx canvas, and input/storage/audio use the wx.* APIs.
//
// MVP caveats: system font (no custom font), no sound, no forms-picker /
// settings / level-grid, no pause. See README.md.
// ===========================================================================

'use strict';

// ======================= wx adapter: canvas + screen =======================
// The FIRST wx.createCanvas() call returns the on-screen canvas.
const canvas = wx.createCanvas();
let ctx = canvas.getContext('2d');   // reassignable (kept for parity; unused here)

// Screen metrics. We draw in logical CSS px (windowWidth × windowHeight) and
// scale the backing store by pixelRatio, mirroring the web resize() approach.
const info = wx.getSystemInfoSync();
let BASE_W = info.windowWidth;
let BASE_H = info.windowHeight;
let dpr = info.pixelRatio || 1;

// Ground sits in the lower third (~72% down), leaving sky above for jumps.
const GROUND_OFFSET = 54;   // kept from web (unused now GROUND is % based)
let GROUND = Math.round(BASE_H * 0.72);

// Configure the canvas backing store and draw in logical px.
function applyCanvasSize() {
  canvas.width = Math.round(BASE_W * dpr);
  canvas.height = Math.round(BASE_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
// Single resize (orientation locked to portrait). Recompute GROUND from height.
function resize() {
  const i = wx.getSystemInfoSync();
  BASE_W = i.windowWidth; BASE_H = i.windowHeight; dpr = i.pixelRatio || 1;
  GROUND = Math.round(BASE_H * 0.72);
  applyCanvasSize();
  if (state !== 'play') { placeDinoGround(); }
}
applyCanvasSize();

// ======================= wx adapter: storage (localStorage → wx) ============
// Same keys/semantics as the web version.
function storeGet(key, def) {
  try { const v = wx.getStorageSync(key); return (v === '' || v == null) ? def : v; }
  catch (e) { return def; }
}
function storeSet(key, val) { try { wx.setStorageSync(key, val); } catch (e) {} }

// ======================= wx adapter: audio (MVP no-op) ======================
// WeChat has no Web-Audio oscillator; sound is skipped in the MVP.
// (Later: wx.createInnerAudioContext() could play short sfx clips.)
function blip(/* freq, dur, type */) { /* no-op in MVP */ }
function fanfare() { /* no-op in MVP */ }

// ======================= Fonts (MVP: system default) =======================
// Web used 'Space Grotesk' / 'Space Mono'; here we fall back to system fonts.
// (Later: wx.loadFont(path) can register a bundled font file.)
const FONT_UI = 'sans-serif';
const FONT_MONO = 'monospace';

// ===========================================================================
// ================  ENGINE (reused verbatim from web game.js) ===============
// Only ctx/global wiring and the DOM shell differ; numbers are identical.
// ===========================================================================

// ---- Levels ----
const TOTAL_LEVELS = 30;

function levelConfig(n) {
  return {
    startSpeed: 5.5 + (n - 1) * 0.15,
    maxSpeed: Math.min(16, 8.8 + (n - 1) * 0.245),
    accel: 0.0024 + (n - 1) * 0.00003,
  };
}

const LEVEL_PATTERNS = [
  // World 1 — Egg (L1-3)
  "c ~ c ~ _ ~ c",
  "c ~ 2 ~ _ ~ c ~ _",
  "2 ~ _ ~ c ~ _ ~ 2",
  // World 2 — Cracked egg (L4-6)
  "c ~ ^ ~ _ ~ C",
  "C ~ _ ~ ^ ~ 2 ~ _",
  "2 ~ ^ ~ _ ~ C ~ ^",
  // World 3 — Legged egg (L7-9)
  "c ~ v ~ _ ~ ^ ~ c",
  "2 ~ v ~ _ ~ C ~ v",
  "v ~ _ ~ ^ ~ v ~ 2 ~ _",
  // World 4 — Hatchling (L10-12)
  "3 ~ b ~ v ~ _ ~ ^",
  "b ~ ^ ~ v ~ _ ~ b ~ 3",
  "3 ~ _ ~ b ~ v ~ ^ ~ C",
  // World 5 — Young dino (L13-15)
  "3 - _ ~ ^ ~ v ~ 3 - _",
  "C - b ~ ^ ~ v ~ _ ~ C",
  "2 - 3 ~ _ ~ v ~ ^ ~ C ~ b",
  // World 6 — Horned (L16-18)
  "3 - ^ ~ V ~ _ ~ C - b",
  "C ~ _ ~ V ~ ^ ~ 3 ~ b",
  "2 - _ ~ V ~ b ~ ^ ~ 3 ~ v",
  // World 7 — Finback (L19-21)
  "3 . _ ~ ^ ~ V ~ C . _ ~ b",
  "C - ^ ~ V ~ 3 . _ ~ b ~ v",
  "3 . _ ~ v ~ ^ ~ V ~ b - C",
  // World 8 — Twin-horn (L22-24)
  "3 . C - ^ ~ V ~ _ ~ 3 ~ b",
  "C . _ ~ v ~ b - ^ ~ V ~ C",
  "3 . v ~ _ ~ b - 3 . V ~ ^ ~ C",
  // World 9 — Blaze (L25-27)
  "3 . _ ~ ^ ~ V ~ C . _ ~ b . v",
  "C . v ~ b - _ ~ 3 . ^ ~ V ~ C",
  "3 . _ ~ 3 . V ~ b - ^ ~ C ~ v",
  // World 10 — King → Super dino (L28-30)
  "b . v ~ ^ ~ V ~ C . 3 ~ _ ~ b",
  "3 . _ ~ ^ ~ V ~ C . v ~ b . _ ~ C",
  "3 . _ ~ ^ ~ V ~ C . _ ~ b . v ~ _ ~ C ~ V",
];

function obstacleFootprint(type) {
  if (type === "3") return 78;
  if (type === "2") return 52;
  if (type === "C") return 30;
  if (type === "b") return 52;
  return 26;
}

function buildSchedule(pattern, cfg) {
  const u = 44 * cfg.maxSpeed;
  const gapU = 44 * cfg.startSpeed;
  const BASE_GAP = 1.0 * u;
  let cursor = 360;
  const items = [];
  for (const ch of pattern) {
    if (ch === " ") continue;
    else if (ch === ".") cursor += 0.30 * u;
    else if (ch === "-") cursor += 0.62 * u;
    else if (ch === "~") cursor += 1.2 * u;
    else if (ch === "_") {
      cursor += 0.45 * u;
      const w = 0.50 * gapU;
      items.push({ at: cursor, type: "gap", w });
      const gc = cursor + w / 2;
      items.push({ at: gc - 26, type: "coin", h: 66 });
      items.push({ at: gc, type: "coin", h: 82 });
      items.push({ at: gc + 26, type: "coin", h: 66 });
      cursor += w + 0.9 * u;
    } else if (ch === "=") {
      cursor += 0.5 * u;
      const w = 1.4 * u;
      items.push({ at: cursor, type: "platform", w, h: 92 });
      cursor += w + 0.8 * u;
    } else if (ch === "^") {
      cursor += 0.7 * u;
      const w = 0.6 * u;
      items.push({ at: cursor, type: "wall", w, h: 62 });
      items.push({ at: cursor + w / 2 - 16, type: "coin", h: 98 });
      items.push({ at: cursor + w / 2 + 16, type: "coin", h: 98 });
      cursor += w + 1.0 * u;
    } else if (ch === "v" || ch === "V") {
      const long = ch === "V";
      cursor += 0.75 * u;
      const w = (long ? 1.7 : 0.55) * u;
      items.push({ at: cursor, type: "bar", w, clear: 50 });
      cursor += w + 0.95 * u;
    } else {
      if (ch === "C") cursor += 0.7 * u;
      items.push(makeScheduleItem(ch, cursor));
      cursor += obstacleFootprint(ch) + BASE_GAP + (ch === "C" ? 0.9 * u : 0);
    }
  }
  if (!items.some(it => it.type === "coin")) items.push({ at: 640, type: "coin", h: 44 });
  items.sort((a, b) => a.at - b.at);
  return { items, goal: cursor + 360 };
}

function makeScheduleItem(ch, at) {
  if (ch === "b") return { at, type: "bird" };
  if (ch === "C") return { at, type: "cactus", variant: "tall", cluster: 1 };
  if (ch === "2") return { at, type: "cactus", variant: "cluster", cluster: 2 };
  if (ch === "3") return { at, type: "cactus", variant: "cluster", cluster: 3 };
  return { at, type: "cactus", variant: "small", cluster: 1 };
}

// ---- Theme ----
const C_LIGHT_BG = "#F4F3F0", C_DARK_BG = "#16161A";
const C_LIGHT_INK = "#1A1A1A", C_DARK_INK = "#F1EFE9";
const C_LIGHT_SEC = "#B8B5AD", C_DARK_SEC = "#4A4A52";
const C_ACCENT = "#E8552D";
// WeChat: default to a LIGHT start (no matchMedia). `night` still flips the
// phase during play (via MILESTONE), so day/night still alternates.
const osDark = false;
function theme() {
  const startLight = !osDark;
  const isLight = night ? !startLight : startLight;
  const bg = isLight ? C_LIGHT_BG : C_DARK_BG;
  const ink = isLight ? C_LIGHT_INK : C_DARK_INK;
  const sec = isLight ? C_LIGHT_SEC : C_DARK_SEC;
  return { fg: ink, bg, mid: sec, line: sec, accent: C_ACCENT, hot: C_ACCENT, eye: bg, ink, secondary: sec };
}

// ---- State ----
const GRAV = 0.62, JUMP_V = -11.5, JUMP_V2 = -10.6, MAX_FALL = 16;
const MILESTONE = 5200;
const dino = { x: 64, y: 0, vy: 0, ducking: false, onGround: true, crashed: false, jumps: 0, w: 0, h: 0 };
let obstacles = [], clouds = [], particles = [], pops = [], confetti = [], gaps = [], coins = [];
const POWER_SCALE = 1.3, COIN_SCORE = 50, MERCY_FRAMES = 72;
let powered = false, mercyT = 0;
let speed, dist, score, night = false, flashT = 0;
let invertT = 0, pulseT = 0, toastT = 0, toastText = "", lastMilestone = 0;
let tutorialMode = false;
let teach = null;
let teachTaps = 0, duckHold = 0;
const taught = { jump: false, double: false, duck: false };
let uiTick = 0;
let dyingT = 0;
let revealStage = null;
let level = 1, cfg = levelConfig(1);
let goal = 2200, schedule = [], schedIdx = 0;
let state = "ready";
let legTick = 0, finishSpawned = false, midPlayed = false;

// MVP: no reduce-motion preference source; keep full motion.
let reduceMotion = false;

// ---- Persistence (wx storage) ----
let unlocked = 1, bestByLevel = {}, chosenSkin = null, tutorialSeen = false, championUnlocked = false;
let tipsSeen = new Set();
(function loadProgress() {
  unlocked = parseInt(storeGet("dino_unlocked", "1"), 10) || 1;
  try { bestByLevel = JSON.parse(storeGet("dino_best", "{}")) || {}; } catch (e) { bestByLevel = {}; }
  const sk = storeGet("dino_skin", "auto");
  if (sk != null && sk !== "auto") chosenSkin = parseInt(sk, 10);
  tutorialSeen = storeGet("dino_seen", "") === "1";
  championUnlocked = storeGet("dino_champion", "") === "1";
  const tips = storeGet("dino_tips", "");
  if (tips) tipsSeen = new Set(String(tips).split(",").filter(Boolean));
})();
function saveProgress() {
  storeSet("dino_unlocked", String(unlocked));
  storeSet("dino_best", JSON.stringify(bestByLevel));
  storeSet("dino_skin", chosenSkin == null ? "auto" : String(chosenSkin));
  storeSet("dino_champion", championUnlocked ? "1" : "0");
  storeSet("dino_tips", Array.from(tipsSeen).join(","));
}
function markTip(key) { tipsSeen.add(key); saveProgress(); }
function markTutorialSeen() { tutorialSeen = true; storeSet("dino_seen", "1"); }

// ---- Resize helper ----
function placeDinoGround() { dino.y = GROUND; dino.vy = 0; dino.onGround = true; }

// ---- Level lifecycle ----
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
  revealStage = null;
  dino.ducking = false; dino.crashed = false; dino.jumps = 0; placeDinoGround();
  for (let i = 0; i < 3; i++) clouds.push({ x: Math.random() * BASE_W, y: 24 + Math.random() * 60, s: 0.3 + Math.random() * 0.5 });
}
function startLevel(n) {
  loadLevel(n);
  state = "play";
  blip(440, 0.08);
}
function clearLevel() {
  state = "clear";
  if (tutorialMode) markTutorialSeen();
  const prevBest = bestByLevel[level] || 0;
  const s = Math.floor(score);
  if (s > prevBest) bestByLevel[level] = s;
  const stageBefore = maxUnlockedStage();
  if (level + 1 <= TOTAL_LEVELS && level + 1 > unlocked) unlocked = level + 1;
  if (level >= TOTAL_LEVELS) championUnlocked = true;
  const stageAfter = maxUnlockedStage();
  saveProgress();
  const newForm = stageAfter > stageBefore;
  revealStage = newForm ? stageAfter : null;
  spawnConfetti();
  fanfare();
}
function gainPower(cn) {
  blip(740, 0.1, "triangle"); blip(990, 0.1, "triangle");
  if (cn && !reduceMotion)
    for (let i = 0; i < 7; i++)
      particles.push({ kind: "dot", x: cn.x, y: cn.y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3, r: 3, life: 18, max: 18 });
  if (!powered) {
    powered = true;
    pulseT = reduceMotion ? 0 : 18;
    if (!tipsSeen.has("coin")) { toastText = "✦ 金币 · 变大,可挡一次撞击"; toastT = 150; markTip("coin"); }
    else { toastText = "✦ 变大了 BIG"; toastT = 72; }
  }
}
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
function crash() {
  state = "dying";
  dino.crashed = true;
  dino.ducking = false;
  dino.vy = -7;
  dyingT = reduceMotion ? 1 : 44;
  flashT = reduceMotion ? 0 : 8;
  blip(150, 0.2, "sawtooth");
  if (!reduceMotion)
    for (let i = 0; i < 9; i++)
      particles.push({ kind: "dust", x: dino.x + dino.w / 2, y: dino.y - dino.h / 2, r: 3 + Math.random() * 3, vr: 0, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, life: 26, max: 26 });
}
function tickDying() {
  dino.vy = Math.min(dino.vy + GRAV, MAX_FALL);
  dino.y += dino.vy;
  if (dino.y > GROUND + 36) { dino.y = GROUND + 36; dino.vy = 0; }
  for (const p of particles) { p.x += p.vx; p.y += p.vy; if (p.kind === "dust") p.vy += 0.18; p.life--; }
  particles = particles.filter(p => p.life > 0);
  if (flashT > 0) flashT--;
  if (--dyingT <= 0) showGameOver();
}
function showGameOver() { state = "over"; }

// ---- Input primitives ----
function doJump(v, jumps) { dino.vy = v; dino.onGround = false; dino.jumps = jumps; dino.ducking = false; puff(); }
function teachInput(kind) {
  if (teach === "jump" && kind === "tap") { taught.jump = true; teach = null; doJump(JUMP_V, 1); blip(660, 0.06); }
  else if (teach === "double" && kind === "tap") {
    if (++teachTaps >= 2) { taught.double = true; teach = null; teachTaps = 0; doJump(-14, 2); blip(880, 0.06); }
    else blip(660, 0.06);
  } else if (teach === "duck" && kind === "duck") { taught.duck = true; teach = null; duckHold = 42; blip(523, 0.06); }
}
function jump() {
  // State routing lives in the tap handler; this is the play-state jump.
  if (state !== "play") return;
  if (teach) { if (isTipLesson(teach)) dismissTip(); else teachInput("tap"); return; }
  if (dino.onGround) {
    dino.vy = JUMP_V; dino.onGround = false; dino.jumps = 1; dino.ducking = false;
    if (tutorialMode) taught.jump = true;
    blip(660, 0.06); puff();
  } else if (dino.jumps === 1) {
    dino.vy = JUMP_V2; dino.jumps = 2;
    if (tutorialMode) taught.double = true;
    blip(880, 0.06); jumpArc();
  }
}
function releaseJump() { /* no-op */ }
function setDuck(v) {
  if (teach) { if (v) { if (isTipLesson(teach)) dismissTip(); else teachInput("duck"); } return; }
  if (state === "play" && dino.onGround) { dino.ducking = v; if (v && tutorialMode) taught.duck = true; }
}
function dismissTip() { if (teach) { markTip(teach); teach = null; blip(620, 0.06); } }

// ---- Spawning ----
function spawnDue() {
  const ahead = BASE_W - dino.x + 8;
  while (schedIdx < schedule.length && schedule[schedIdx].at - dist <= ahead) {
    const it = schedule[schedIdx++];
    const x = dino.x + (it.at - dist);
    if (it.type === "bird") {
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
      obstacles.push({ type: "cactus", variant: "small", cluster: 1, x, y: GROUND, w: 28, h: 48, bush: Math.random() < 0.3 });
    }
  }
}

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

function groundUnder(px) {
  for (const g of gaps) if (px > g.x + 4 && px < g.x + g.w - 4) return false;
  return true;
}

// ---- Update ----
function update() {
  if (!teach) {
    let m = tutorialMode ? pendingLesson() : null;
    if (!m) m = pendingTip();
    if (m) { teach = m; teachTaps = 0; }
  }
  if (teach) {
    dino.vy = Math.min(dino.vy + GRAV, MAX_FALL);
    dino.y += dino.vy;
    if (dino.y >= GROUND) { dino.y = GROUND; dino.vy = 0; dino.onGround = true; dino.jumps = 0; }
    return;
  }
  if (duckHold > 0) { duckHold--; if (dino.onGround) dino.ducking = true; }

  dist += speed;
  score += speed * 0.08;
  if (speed < cfg.maxSpeed) speed += cfg.accel;

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
    if (dino.y > GROUND + 40) { crash(); return; }
  }

  const duck = dino.ducking && dino.onGround;
  const unit = PXU * formScale(), bw = 96 * unit, bh = 100 * unit;
  dino.w = duck ? bw * 0.70 : bw * 0.60;
  dino.h = duck ? bh * 0.32 : bh * 0.66;

  if (!finishSpawned) spawnDue();

  for (const o of obstacles) {
    o.x -= speed;
    if (o.type === "bird") o.wing = (o.wing + 0.18) % 2;
    if (!o.scored && o.type !== "finish" && o.x + o.w < dino.x) { o.scored = true; scorePop(); }
  }
  obstacles = obstacles.filter(o => o.x + o.w > -10);
  for (const g of gaps) g.x -= speed;
  gaps = gaps.filter(g => g.x + g.w > -10);
  for (const cn of coins) {
    cn.x -= speed; cn.t++;
    if (!cn.taken && cn.x > dino.x - cn.r && cn.x < dino.x + dino.w + cn.r &&
        cn.y > dino.y - dino.h - cn.r && cn.y < dino.y + cn.r) {
      cn.taken = true; score += COIN_SCORE; gainPower(cn);
    }
  }
  coins = coins.filter(cn => !cn.taken && cn.x + cn.r > -10);

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
    if (o.type === "platform") continue;
    if (o.type === "bar") {
      const ducked = dino.ducking && dino.onGround;
      if (!ducked && dino.x + dino.w > o.x + 4 && dino.x < o.x + o.w - 4) { if (hitObstacle(o)) return; }
      continue;
    }
    if (o.type === "wall") {
      if (dino.x + dino.w > o.x + 2 && dino.x < o.x + 2 && dino.y > o.y + 6) { if (hitObstacle(o)) return; }
      continue;
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
}

// ---- Particle helpers ----
function puff() {
  if (reduceMotion) return;
  const s = effectiveStage(), n = 3 + Math.floor(s / 3);
  for (let i = 0; i < n; i++)
    particles.push({ kind: "dust", x: dino.x + 6 + i * 5, y: GROUND - 2, r: (5 - i * 0.6) + s * 0.1, vr: 0.35, vx: -1 - Math.random(), vy: -0.5, life: 16 + i * 3, max: 16 + i * 3 });
}
function jumpArc() {
  if (reduceMotion) return;
  const s = effectiveStage(), n = 4 + Math.floor(s / 2);
  for (let i = 0; i < n; i++)
    particles.push({ kind: "dot", x: dino.x + dino.w * 0.5, y: dino.y - dino.h * 0.6 - i * 4, vx: -speed * 0.3, vy: 0, r: 3, life: 18, max: 18 });
  if (s >= 5)
    for (let i = 0; i < Math.floor(s / 2); i++)
      particles.push({ kind: "star", x: dino.x + dino.w * 0.5 + (Math.random() - 0.5) * 26, y: dino.y - dino.h * 0.6 + (Math.random() - 0.5) * 22, vx: -speed * 0.3 + (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, r: 3 + s * 0.12, life: 22, max: 22, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4 });
}
function scorePop() {
  if (reduceMotion) return;
  pops.push({ x: dino.x + dino.w + 6, y: dino.y - dino.h - 6, vy: -0.9, life: 36, max: 36 });
}

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

// ---- Evolution ladder ----
const PXU = 0.78;
const EVOLUTIONS = [
  { name: "角蛋", from: 1, emoji: "🥚", scale: 0.58, kind: "egg" },
  { name: "破壳", from: 4, emoji: "🥚", scale: 0.66, kind: "hatch" },
  { name: "幼龙", from: 7, emoji: "🐣", scale: 0.74, kind: "dino", orn: {} },
  { name: "少年龙", from: 10, emoji: "🦎", scale: 0.82, kind: "dino", orn: { spikes: 1 } },
  { name: "角龙", from: 13, emoji: "🦎", scale: 0.90, kind: "dino", orn: { horns: 1 } },
  { name: "背鲍龙", from: 16, emoji: "🦖", scale: 0.97, kind: "dino", orn: { plates: 1 } },
  { name: "双角龙", from: 19, emoji: "🦖", scale: 1.04, kind: "dino", orn: { spikes: 1, horns: 2 } },
  { name: "烈焰龙", from: 22, emoji: "🐉", scale: 1.09, kind: "dino", orn: { crest: 1, tailFlame: 1, belly: 1, accentEye: 1 } },
  { name: "王者龙", from: 25, emoji: "🐉", scale: 1.13, kind: "dino", orn: { crown: 1, horns: 1, belly: 1, accentEye: 1 } },
  { name: "巨龙", from: 28, emoji: "🐲", scale: 1.18, kind: "dino", orn: { plates: 1, crest: 1, horns: 2, wing: 1, belly: 1, accentEye: 1 } },
  { name: "神龙", from: 99, emoji: "👑", scale: 1.25, kind: "dino", ultimate: true, orn: { plates: 1, crest: 1, crown: 1, wing: 1, belly: 1, accentEye: 1, tailFlame: 1 } },
];

function maxUnlockedStage() {
  let m = 0;
  for (let i = 0; i < EVOLUTIONS.length; i++) {
    const e = EVOLUTIONS[i];
    if (e.ultimate) { if (championUnlocked) m = i; }
    else if (e.from <= unlocked) m = i;
  }
  return m;
}
function effectiveStage() {
  const max = maxUnlockedStage();
  return Math.max(0, Math.min(chosenSkin == null ? max : chosenSkin, max));
}
function formScale() { return EVOLUTIONS[effectiveStage()].scale * (powered ? POWER_SCALE : 1); }

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
  rrect(fx(6), fy(46), fw(22), fh(13), fr(4));
  rrect(fx(20), fy(42), fw(46), fh(28), fr(9));
  rrect(fx(58), fy(18), fw(30), fh(28), fr(7));
  rrect(fx(80), fy(32), fw(12), fh(11), fr(3));
  rrect(fx(60), fy(50), fw(10), fh(7), fr(2));
  if (dino.onGround) {
    const backDown = step;
    const backFt = backDown ? 85 : 77, frontFt = backDown ? 77 : 85;
    rrect(fx(28), fy(63), fw(11), fh(backFt - 63), fr(3));
    rrect(fx(25), fy(backFt), fw(16), fh(6), fr(2));
    rrect(fx(48), fy(63), fw(11), fh(frontFt - 63), fr(3));
    rrect(fx(47), fy(frontFt), fw(16), fh(6), fr(2));
  } else {
    rrect(fx(28), fy(62), fw(11), fh(18), fr(3)); rrect(fx(25), fy(80), fw(16), fh(6), fr(2));
    rrect(fx(48), fy(66), fw(11), fh(14), fr(3)); rrect(fx(47), fy(80), fw(16), fh(6), fr(2));
  }
  ctx.fillStyle = accentEye ? c.hot : c.eye;
  rrect(fx(64), fy(25), fw(7), fh(7), fr(2));
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
  if (o.spikes) { ctx.fillStyle = c.fg; up(fx(30), fy(30), fw(12), fh(14)); up(fx(44), fy(28), fw(12), fh(16)); }
  if (o.plates) { ctx.fillStyle = c.fg; up(fx(24), fy(30), fw(12), fh(14)); up(fx(37), fy(26), fw(13), fh(18)); up(fx(51), fy(29), fw(12), fh(15)); }
  if (o.horns >= 1) { ctx.fillStyle = c.fg; up(fx(65), fy(4), fw(12), fh(18)); }
  if (o.horns >= 2) { ctx.fillStyle = c.fg; up(fx(76), fy(8), fw(10), fh(15)); }
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
  else rrect(fx(26), fy(24), fw(44), fh(52), fr(18));
  ctx.fillStyle = c.hot; triBox(fx(41), fy(6), fw(14), fh(22), [[0.5, 0], [1, 1], [0, 1]]);
  ctx.fillStyle = c.eye;
  rrect(fx(36), fy(46), fw(4), fh(4), fr(2)); rrect(fx(44), fy(44), fw(4), fh(4), fr(2)); rrect(fx(52), fy(46), fw(4), fh(4), fr(2));
  if (!duck) {
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
  rrect(fx(24), fy(58), fw(48), fh(36), fr(8));
  ctx.fillStyle = c.bg;
  for (let i = 0; i < 5; i++) triBox(fx(24 + i * 10), fy(54), fw(10), fh(8), [[0, 1], [0.5, 0], [1, 1]]);
  ctx.fillStyle = c.fg;
  rrect(fx(34), fy(30), fw(30), fh(30), fr(12));
  rrect(fx(60), fy(40), fw(12), fh(11), fr(3));
  ctx.fillStyle = c.hot; triBox(fx(42), fy(10), fw(13), fh(22), [[0.5, 0], [1, 1], [0, 1]]);
  ctx.fillStyle = c.eye; rrect(fx(46), fy(38), fw(6), fh(6), fr(2));
  ctx.fillStyle = c.fg;
  const lFt = step ? 94 : 90, rFt = step ? 90 : 94;
  rrect(fx(37), fy(86), fw(4), fh(lFt - 86), fr(2)); rrect(fx(34), fy(lFt), fw(11), fh(4), fr(2));
  rrect(fx(55), fy(86), fw(4), fh(rFt - 86), fr(2)); rrect(fx(54), fy(rFt), fw(11), fh(4), fr(2));
}

function drawDuckForm(c, B) {
  const u = B.unit, x = dino.x, gy = dino.y, step = Math.floor(legTick) % 2 === 0;
  ctx.fillStyle = c.fg;
  rrect(x, gy - 30 * u, 60 * u, 18 * u, 7 * u);
  rrect(x + 50 * u, gy - 34 * u, 22 * u, 18 * u, 6 * u);
  rrect(x + 70 * u, gy - 28 * u, 10 * u, 9 * u, 3 * u);
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

function drawFormAt(c, evo, B) {
  if (evo.kind === "egg") { drawEgg(c, B, false); return; }
  if (evo.kind === "hatch") { drawHatch(c, B, false); return; }
  const o = evo.orn || {};
  if (o.wing) drawWing(c, B);
  dinoBase(c, B, !!o.accentEye);
  drawDinoOrnaments(c, B, o);
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
function drawFormShowcase(c, idx) {
  const evo = EVOLUTIONS[idx];
  const unit = PXU * evo.scale * 2.6;
  const boxW = 96 * unit, boxH = 100 * unit;
  const bob = Math.sin(uiTick * 0.12) * 6;
  const B = { unit, boxW, boxH, boxLeft: BASE_W / 2 - boxW / 2, boxTop: BASE_H * 0.46 - 0.91 * boxH + bob };
  drawFormAt(c, evo, B);
}

// ---- Flat-geometry primitives ----
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

function terrainTier() { return Math.min(4, Math.floor((level - 1) / 6)); }
function drawCactus(c, x, gy, W, H, bush) {
  const top = gy - H;
  const px = L => x + (L / 72) * W, py = T => top + (T / 68) * H;
  const pw = w => (w / 72) * W, ph = h => (h / 68) * H, pr = r => (r / 72) * W;
  const tri = pts => triBox(x, top, W, H, pts);
  const tier = terrainTier();
  if (tier === 1) {
    ctx.fillStyle = c.fg;
    rrect(px(6), py(32), pw(60), ph(36), pr(9));
    tri([[0.06, 0.56], [0.34, 0.02], [0.52, 0.56]]);
    tri([[0.46, 0.56], [0.74, 0.16], [0.96, 0.56]]);
    return;
  }
  if (tier === 2) {
    ctx.fillStyle = c.fg;
    tri([[0.02, 1], [0.2, 0.18], [0.36, 1]]);
    tri([[0.3, 1], [0.5, 0.0], [0.72, 1]]);
    tri([[0.64, 1], [0.82, 0.26], [0.98, 1]]);
    ctx.fillStyle = c.accent;
    tri([[0.42, 0.4], [0.5, 0.0], [0.58, 0.4]]);
    return;
  }
  if (tier === 3) {
    ctx.fillStyle = c.fg;
    rrect(px(29), py(8), pw(14), ph(54), pr(5));
    rrect(px(22), py(3), pw(12), ph(13), pr(6)); rrect(px(38), py(3), pw(12), ph(13), pr(6));
    rrect(px(22), py(52), pw(12), ph(13), pr(6)); rrect(px(38), py(52), pw(12), ph(13), pr(6));
    ctx.fillStyle = c.accent; rrect(px(27), py(31), pw(18), ph(4), pr(2));
    return;
  }
  if (tier === 4) {
    ctx.fillStyle = c.fg;
    tri([[0.5, 0.0], [0.96, 0.62], [0.5, 1]]);
    tri([[0.5, 0.0], [0.04, 0.62], [0.5, 1]]);
    ctx.fillStyle = c.accent;
    tri([[0.5, 0.06], [0.84, 0.56], [0.62, 0.56]]);
    return;
  }
  ctx.fillStyle = c.fg;
  rrect(px(30), py(6), pw(13), ph(58), pr(5));
  rrect(px(18), py(30), pw(15), ph(9), pr(4));
  rrect(px(18), py(18), pw(9), ph(18), pr(4));
  rrect(px(40), py(38), pw(15), ph(9), pr(4));
  rrect(px(46), py(26), pw(9), ph(18), pr(4));
  if (bush) { rrect(px(52), py(28), pw(10), ph(36), pr(4)); rrect(px(58), py(40), pw(11), ph(7), pr(3)); }
}

function drawPtero(c, x, yTop, W, H, wingUp) {
  const px = L => x + (L / 72) * W, py = T => yTop + (T / 68) * H;
  const pw = w => (w / 72) * W, ph = h => (h / 68) * H, pr = r => (r / 72) * W;
  ctx.fillStyle = c.fg;
  if (wingUp) triBox(px(2), py(4), pw(40), ph(24), [[0, 0], [1, 0.35], [1, 0.85]]);
  else triBox(px(2), py(24), pw(40), ph(24), [[0, 1], [1, 0.15], [1, 0.65]]);
  rrect(px(30), py(24), pw(18), ph(10), pr(4));
  rrect(px(44), py(17), pw(16), ph(14), pr(5));
  triBox(px(40), py(6), pw(18), ph(15), [[0, 0], [1, 0.55], [1, 1]]);
  triBox(px(58), py(22), pw(13), ph(7), [[0, 0], [1, 0.5], [0, 1]]);
  ctx.fillStyle = c.eye; rrect(px(48), py(21), pw(5), ph(5), pr(1));
}

function drawGround(c) {
  ctx.fillStyle = c.ink;
  for (let i = 0; i < BASE_W + 14; i += 14) {
    const gx = ((i - (dist % 14)) % (BASE_W + 14));
    if (!groundUnder(gx + 4)) continue;
    ctx.fillRect(gx, GROUND + 2, 8, 2);
  }
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
  if (tier === 0) {
    band(300, 0.18, 0.16, dome(GROUND + 10, 86));
    band(200, 0.34, 0.26, dome(GROUND + 20, 58));
  } else if (tier === 1) {
    band(360, 0.16, 0.15, dome(GROUND + 26, 128));
    band(230, 0.32, 0.24, dome(GROUND + 28, 84));
  } else if (tier === 2) {
    band(320, 0.15, 0.15, peak(GROUND + 8, 168, 140));
    band(200, 0.33, 0.24, peak(GROUND + 12, 104, 88));
  } else if (tier === 3) {
    band(340, 0.14, 0.17, peak(GROUND + 8, 232, 128));
    band(210, 0.31, 0.25, peak(GROUND + 12, 150, 82));
    drawEmbers(c);
  } else {
    band(380, 0.13, 0.13, peak(GROUND + 24, 96, 160));
    band(320, 0.22, 0.16, isle(GROUND - 150, 130, 26));
    band(240, 0.30, 0.13, isle(GROUND - 270, 86, 18));
    drawStars(c);
  }
  ctx.globalAlpha = 1;
}
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
    ctx.fillStyle = c.mid; rrect(o.x + 4, o.y + 4, o.w - 8, 3, 2);
    return;
  }
  if (o.type === "bar") {
    const topY = 4, bottom = o.y;
    ctx.fillStyle = c.fg; rrect(o.x, topY, o.w, bottom - topY, 6);
    ctx.fillStyle = c.bg;
    for (let sx = o.x + 44; sx < o.x + o.w - 8; sx += 44) ctx.fillRect(sx, topY + 6, 2, (bottom - topY) * 0.62);
    ctx.fillStyle = c.accent;
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
    ctx.fillStyle = c.bg;
    ctx.fillRect(o.x + 2, o.y + wh * 0.5, o.w - 4, 2);
    const bw = 46;
    for (let bx = o.x + bw; bx < o.x + o.w - 6; bx += bw) {
      ctx.fillRect(bx, o.y + 4, 2, wh * 0.5 - 6);
      ctx.fillRect(bx + bw * 0.5, o.y + wh * 0.5 + 2, 2, wh * 0.5 - 6);
    }
    ctx.fillStyle = c.accent; rrect(o.x + o.w * 0.5 - 9, o.y + 5, 18, 3, 1.5);
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

// ---- Learn-by-doing teach prompt ----
const LESSON = {
  jump: ["跳 JUMP", "点击屏幕"],
  double: ["二段跳 DOUBLE", "空中再点一次"],
  duck: ["下蹲 DUCK", "向下滑 / 长按"],
  gap: ["缺口 · 跳过去!", "点击—掉下去会摔"],
  wall: ["高墙 · 跳上去", "点击,落到墙顶"],
  bar: ["低梁 · 蹲下钻过", "向下滑—跳起会撞到"],
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
  const midX = BASE_W / 2, ty = cy + 24;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = c.accent;
  ctx.font = "700 23px " + FONT_UI;
  ctx.fillText(title, midX, ty);
  ctx.fillStyle = c.ink;
  ctx.font = "600 14px " + FONT_UI;
  ctx.fillText(L[1], midX, ty + 24);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

// ===========================================================================
// ==================  SHELL: canvas HUD + screens (new) =====================
// Replaces the web DOM overlays. Everything is drawn on the canvas.
// ===========================================================================

// On-canvas HUD: LEVEL (top-left), SCORE (top-right), a thin progress bar.
function drawHUD(c) {
  ctx.textBaseline = "alphabetic";
  // LEVEL (top-left)
  ctx.textAlign = "left";
  ctx.fillStyle = c.mid; ctx.font = "700 11px " + FONT_MONO;
  ctx.fillText("LEVEL", 16, 28);
  ctx.fillStyle = c.ink; ctx.font = "700 22px " + FONT_MONO;
  ctx.fillText(String(level), 16, 52);
  // SCORE (top-right)
  ctx.textAlign = "right";
  ctx.fillStyle = c.mid; ctx.font = "700 11px " + FONT_MONO;
  ctx.fillText("SCORE", BASE_W - 16, 28);
  ctx.fillStyle = c.ink; ctx.font = "700 22px " + FONT_MONO;
  ctx.fillText(String(Math.floor(score)).padStart(5, "0"), BASE_W - 16, 52);
  ctx.textAlign = "left";
  // Progress bar (fill = dist/goal)
  const barX = 16, barY = 62, barW = BASE_W - 32, barH = 6;
  const pct = Math.max(0, Math.min(1, dist / goal));
  ctx.fillStyle = c.line; rrect(barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = c.accent; if (pct > 0) rrect(barX, barY, barW * pct, barH, barH / 2);
}

// A centred accent "pill" CTA button label (informational — the whole screen
// is tappable; we don't hit-test the pill).
function drawPill(c, text, cy) {
  ctx.font = "700 16px " + FONT_UI;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width + 48;
  const pw = tw, ph = 44, px = BASE_W / 2 - pw / 2;
  ctx.fillStyle = c.accent; rrect(px, cy - ph / 2, pw, ph, ph / 2);
  ctx.fillStyle = "#fff"; ctx.fillText(text, BASE_W / 2, cy + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

function bestScore() {
  let m = 0; for (const k in bestByLevel) if (bestByLevel[k] > m) m = bestByLevel[k];
  return m;
}

// READY / title screen.
function drawReadyScreen(c) {
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.mid; ctx.font = "600 12px " + FONT_MONO;
  ctx.fillText("HI " + String(bestScore()).padStart(5, "0"), BASE_W - 16, 30);
  ctx.textAlign = "center";
  ctx.fillStyle = c.ink; ctx.font = "700 46px " + FONT_UI;
  ctx.fillText("DINO", BASE_W / 2, BASE_H * 0.30);
  ctx.fillText("RUNNER", BASE_W / 2, BASE_H * 0.30 + 52);
  ctx.fillStyle = c.accent;
  rrect(BASE_W / 2 - 33, BASE_H * 0.30 + 74, 66, 6, 3);
  drawPill(c, "▶ 开始 / Tap to start", BASE_H * 0.55);
  ctx.textAlign = "left";
}

// GAME OVER screen.
function drawOverScreen(c) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.accent; ctx.font = "700 12px " + FONT_MONO;
  ctx.fillText("撞到啦 · GAME OVER", BASE_W / 2, BASE_H * 0.34);
  ctx.fillStyle = c.ink; ctx.font = "700 30px " + FONT_UI;
  ctx.fillText("再试一次", BASE_W / 2, BASE_H * 0.34 + 40);
  ctx.fillStyle = c.mid; ctx.font = "500 15px " + FONT_UI;
  ctx.fillText("Level " + level + " · Score " + String(Math.floor(score)).padStart(5, "0"), BASE_W / 2, BASE_H * 0.34 + 70);
  drawPill(c, "↻ 重试 / Tap to retry", BASE_H * 0.58);
  ctx.textAlign = "left";
}

// LEVEL CLEAR screen. Keeps the new-form reveal (drawFormShowcase) on canvas.
function drawClearScreen(c) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const s = Math.floor(score);
  const isFinal = level >= TOTAL_LEVELS;
  const newForm = revealStage != null;
  if (newForm) {
    const evo = EVOLUTIONS[revealStage];
    ctx.fillStyle = c.accent; ctx.font = "700 12px " + FONT_MONO;
    ctx.fillText(evo.ultimate ? "🏆 通关 · CHAMPION" : "✨ 新形态解锁 · NEW FORM", BASE_W / 2, BASE_H * 0.16);
    ctx.fillStyle = c.ink; ctx.font = "700 26px " + FONT_UI;
    ctx.fillText(evo.name, BASE_W / 2, BASE_H * 0.16 + 34);
    // showcase drawn separately in render() so it layers above bg
  } else {
    ctx.fillStyle = c.accent; ctx.font = "700 12px " + FONT_MONO;
    ctx.fillText(isFinal ? "🏆 通关" : "LEVEL CLEARED", BASE_W / 2, BASE_H * 0.20);
    ctx.fillStyle = c.ink; ctx.font = "700 30px " + FONT_UI;
    ctx.fillText(isFinal ? "All levels cleared!" : "Level " + level, BASE_W / 2, BASE_H * 0.20 + 40);
    ctx.fillStyle = c.mid; ctx.font = "500 15px " + FONT_UI;
    ctx.fillText("Score " + String(s).padStart(5, "0") + " · Best " + String(bestByLevel[level] || s).padStart(5, "0"), BASE_W / 2, BASE_H * 0.20 + 70);
  }
  const label = isFinal ? "再玩一次 / Tap" : "下一关 → / Tap";
  drawPill(c, label, BASE_H * 0.82);
  ctx.textAlign = "left";
}

// ---- Master render ----
function render() {
  uiTick++;
  const c = theme();
  ctx.fillStyle = flashT > 0 && Math.floor(flashT) % 2 === 0 ? c.fg : c.bg;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  if (night) {
    ctx.fillStyle = c.fg;
    ctx.beginPath(); ctx.arc(BASE_W - 70, 90, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(BASE_W - 64, 86, 11, 0, Math.PI * 2); ctx.fill();
  }

  drawHills(c);
  for (const cl of clouds) drawCloud(c, cl);
  drawGround(c);
  if (state === "ready") drawCactus(c, BASE_W * 0.62, GROUND, 38, 66, false);

  for (const o of obstacles) drawObstacle(o, c);
  drawCoins(c);

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

  if (powered && state !== "ready") {
    const B = formBox();
    const cx = B.boxLeft + B.boxW * 0.5, cy = B.boxTop + B.boxH * 0.56;
    const rad = Math.max(B.boxW, B.boxH) * 0.6 + (reduceMotion ? 0 : Math.sin(uiTick * 0.2) * 3);
    ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.45; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  const flashHide = flashT > 0 && Math.floor(flashT) % 2 === 0;
  const mercyHide = mercyT > 0 && !reduceMotion && Math.floor(uiTick) % 8 < 3;
  // Hide the live running dino on the clear/over screens (showcase/text take over
  // for the reveal; on plain clear/over the frozen dino is fine to keep).
  if (!flashHide && !mercyHide && !(state === "clear" && revealStage != null)) drawDino(c);

  if (pops.length) {
    ctx.fillStyle = c.accent;
    ctx.font = "700 22px " + FONT_MONO;
    ctx.textBaseline = "middle";
    for (const sp of pops) { ctx.globalAlpha = Math.max(0, sp.life / sp.max); ctx.fillText("+10", sp.x, sp.y); }
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }

  if (pulseT > 0) {
    ctx.globalAlpha = Math.min(1, pulseT / 26);
    ctx.strokeStyle = c.accent; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, BASE_W - 4, BASE_H - 4);
    ctx.globalAlpha = 1;
  }
  if (invertT > 0) {
    ctx.globalAlpha = Math.min(1, invertT / 9) * 0.85;
    ctx.fillStyle = c.fg; ctx.fillRect(0, 0, BASE_W, BASE_H);
    ctx.globalAlpha = 1;
  }
  if (toastT > 0) {
    ctx.globalAlpha = Math.min(1, toastT / 18);
    ctx.font = "700 20px " + FONT_MONO;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tw = ctx.measureText(toastText).width + 36;
    ctx.fillStyle = c.accent; rrect(BASE_W / 2 - tw / 2, 78, tw, 34, 17);
    ctx.fillStyle = "#fff"; ctx.fillText(toastText, BASE_W / 2, 96);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  }

  if (state === "clear" && revealStage != null) drawFormShowcase(c, revealStage);
  drawConfetti(c);
  drawTeachPrompt(c);

  // HUD only during active gameplay states.
  if (state === "play" || state === "dying") drawHUD(c);

  // Screen overlays (canvas-drawn).
  if (state === "ready") drawReadyScreen(c);
  else if (state === "over") drawOverScreen(c);
  else if (state === "clear") drawClearScreen(c);
}

// ===========================================================================
// ==================  wx adapter: touch input routing =======================
// tap = jump; press-hold (>200ms) OR downward swipe (>24px) = duck; release
// ends the duck. A tap that never became a duck = jump. State screens route a
// tap to start / retry / next-level.
// ===========================================================================
let touch = null;   // { y, duck, startTime }
const HOLD_MS = 200, SWIPE_PX = 24;

function tapAdvance() {
  // Route a tap on the non-play screens.
  if (state === "ready") { startLevel(level); return true; }
  if (state === "over") { startLevel(level); return true; }   // retry same level
  if (state === "clear") { startLevel(level >= TOTAL_LEVELS ? 1 : level + 1); return true; }
  return false;   // dying: ignore taps until Game Over appears
}

wx.onTouchStart(e => {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (state !== "play") { tapAdvance(); return; }
  touch = { y: t ? t.clientY : 0, duck: false, startTime: Date.now() };
});
wx.onTouchMove(e => {
  if (!touch || state !== "play") return;
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (t && t.clientY - touch.y > SWIPE_PX) { touch.duck = true; setDuck(true); }
});
wx.onTouchEnd(() => {
  if (state !== "play") { touch = null; return; }
  if (!touch) return;
  // Long-press (held past HOLD_MS without moving) counts as a duck too.
  if (!touch.duck && Date.now() - touch.startTime >= HOLD_MS) { touch.duck = true; setDuck(true); }
  if (touch.duck) setDuck(false); else jump();   // tap that wasn't a duck → jump
  touch = null;
});
if (wx.onTouchCancel) wx.onTouchCancel(() => { if (touch) { setDuck(false); touch = null; } });

// A held press that hasn't moved should begin ducking mid-hold, not only on
// release — poll during the loop so the tunnel duck feels responsive.
function pollHold() {
  if (state === "play" && touch && !touch.duck && Date.now() - touch.startTime >= HOLD_MS) {
    touch.duck = true; setDuck(true);
  }
}

// Keep the play area sized if the system reports a change (rare in portrait).
if (wx.onWindowResize) wx.onWindowResize(resize);

// ---- Boot ----
loadLevel(1);
state = "ready";
// Fixed-timestep loop: advance the simulation at a steady 60 steps/sec no
// matter the display refresh rate, so 90/120Hz phones don't run the game at
// 1.5–2× speed ("first open is super fast"). render() runs once per frame.
const FRAME_MS = 1000 / 60;
let lastFrameT = 0, simAcc = 0;
(function boot() {
  function frame(t) {
    t = t || 0;
    if (!lastFrameT) lastFrameT = t;
    let dt = t - lastFrameT; lastFrameT = t;
    if (!(dt >= 0) || dt > 250) dt = FRAME_MS;   // clamp NaN / long background pauses
    simAcc += dt;
    pollHold();
    let steps = 0;
    while (simAcc >= FRAME_MS && steps < 5) {     // catch up, but never spiral
      if (state === "play") update();
      else if (state === "dying") tickDying();
      tickConfetti();
      simAcc -= FRAME_MS; steps++;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
