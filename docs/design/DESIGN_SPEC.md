# Dino Runner — Visual System Spec

A minimal endless side-scrolling runner. A geometric dino auto-runs; **tap = jump**, **swipe down = duck**, speed ramps over distance. This file is the single source of truth for building the game UI. All visuals are flat geometry (rounded rectangles + circles + triangles), one solid body color + one orange accent, no gradients, no illustration.

> Implementation note: every glyph below is described as absolutely-positioned boxes inside a fixed-size coordinate box. Reproduce them with CSS (`position:absolute`), SVG `<rect>/<polygon>`, or canvas — the px coordinates are exact. `currentColor` = the body color of that instance; swap it per light/dark/invert state.

---

## 1. Color tokens

Only **two** tokens flip between light and dark. The accent is a constant and never inverts.

| Token | Light (Day) | Dark (Night) | Role |
|---|---|---|---|
| `--bg`        | `#F4F3F0` | `#16161A` | Sky / background |
| `--ink`       | `#1A1A1A` | `#F1EFE9` | Body / characters / text |
| `--secondary` | `#B8B5AD` | `#4A4A52` | Clouds, ghosts, disabled |
| `--accent`    | `#E8552D` | `#E8552D` | **Constant** — danger, score highlight, CTAs |

Supporting neutrals (light mode): card `#FFFFFF`, hairline `#ECECEA`, panel `#FAF9F7`, muted text `#9A988F`, body text `#55534D`, ground/secondary fill steps `#CFCDC5 / #C2BFB6 / #DCDAD3`.
Accent button drop-shadow (the "3D" lip): light `#B53C1A`, dark `#8F2F12`.

**Invert rule:** at each milestone the whole screen swaps `--bg` ↔ `--ink` (0.2s white flash + haptic). `--accent` stays put so danger cues never disappear. The OS dark-mode setting only chooses the *starting* phase.

---

## 2. Type

- **Space Grotesk** — UI, titles, buttons. Weights 400/500/600/700.
- **Space Mono** — scores, counters, captions, any number. Always `font-variant-numeric: tabular-nums` so digits don't jitter.

| Style | Spec |
|---|---|
| Display | Grotesk 700 · 48–62px · letter-spacing −3% |
| Title   | Grotesk 600 · 22–28px |
| Body    | Grotesk 400/500 · 14–16px |
| Score   | Mono 700 · 28–54px · tabular |
| Caption | Mono 400 · 11–12px · letter-spacing +18% |

---

## 3. Characters & obstacles (Glyph)

Coordinate box: **72 × 68 px**. `--eye` = eye color (usually = `--bg` for contrast). Body = `currentColor`.

### Dino — stand/run (default)
- tail: `L2 T30 W18 H11 r3`
- body: `L14 T26 W36 H22 r7`
- head: `L44 T8 W24 H22 r(6 6 4 4)`
- snout: `L60 T18 W9 H9 r(0 3 3 0)`
- jaw: `L45 T33 W9 H6 r2`
- back leg: `L20 T44 W9 H18 r2` + foot `L17 T60 W13 H5 r2`
- front leg: `L36 T46 W9 H16 r2` + foot `L35 T60 W13 H5 r2`
- eye (normal): `L48 T14 W6 H6 r1` fill `--eye`
- eye (crash): two 9×2 bars at `L47 T15` rotated ±45° (an ✕), fill `--eye`; tint whole dino `--accent`
- **Run animation:** alternate the two legs over 2 frames. **Jump:** translateY up, legs together. **Crash:** ✕ eye + accent tint.

### Dino — duck (lower, longer)
- tail `L2 T36 W18 H10 r3` · body `L12 T32 W44 H17 r7` · head `L50 T28 W20 H17 r(5 5 4 4)`
- eye `L53 T33 W6 H6 r1` · legs `L22 T46` & `L38 T46` (9×14) with 13×5 feet at T58

### Cactus (ground obstacle — JUMP over)
- trunk `L30 T6 W13 H58 r5`
- left arm `L18 T30 W15 H9 r4` + `L18 T18 W9 H18 r4`
- right arm `L40 T38 W15 H9 r4` + `L46 T26 W9 H18 r4`
- **double/bush variant** adds: `L52 T28 W10 H36 r4` + `L58 T40 W11 H7 r3`
- Sizes used: small `scale .7`, large `scale 1.15`, bush `scale .85`. Random widths.

### Ptero (air obstacle — DUCK under). Two-frame wing flap.
- crest: `L40 T6 W18 H15` triangle `clip-path: polygon(0 0, 100% 55%, 100% 100%)` (sweeps up-back)
- head: `L44 T17 W16 H14 r(5 5 4 4)`
- beak: `L58 T22 W13 H7` triangle `polygon(0 0, 100% 50%, 0 100%)` (points right)
- neck/body: `L30 T24 W18 H10 r4`
- eye: `L48 T21 W5 H5 r1` fill `--eye`
- **wing up frame:** `L2 T4 W40 H24` `polygon(0 0, 100% 35%, 100% 85%)`
- **wing down frame:** `L2 T24 W40 H24` `polygon(0 100%, 100% 15%, 100% 65%)`

### Cloud (parallax background, `--secondary`)
- `L4 T18 W34 H16 r8` · `L22 T10 W32 H20 r10` · `L40 T18 W26 H15 r8`

### Ground line (everywhere)
`height:2px; background: repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)`

---

## 4. Effects

- **Dust** (on jump): 3 fading `--secondary` circles (9/7/5px) at the takeoff foot.
- **Score pop:** Mono 700 ~26px `--accent` `+N` floating up & fading.
- **Jump arc:** trail of 5px `--accent` dots along the parabola, opacity 1 → 0.3.
- **Invert flash:** 0.2s full-screen white wipe between day/night.

---

## 5. Screens (mobile portrait, 300 × 620 reference, 7px bezel, radius 34)

All share: status bar (9:41 + dots + battery, Mono 11px), side padding **18px**, hit targets **≥ 44px**.

1. **Title / Start** — stacked `DINO RUNNER` (Grotesk 700, 42px) + 66px accent underline; `HI 01847` top-right; dino (stand) + cactus on ground line; full-width accent CTA `▶ TAP TO START` (54px, radius 30, 4px accent-shadow lip); hint `TAP 跳跃 · SWIPE↓ 躲避`. Ships in light **and** dark.
2. **HUD (running)** — top-left: sound icon + `HI 01847`; top-right: live score (Mono 700 30px) + `SCORE` label; milestone progress bar (`→ NEXT 700m`, accent fill); play scene with cloud, ptero (floating, `flo` bob anim), speed-line dashes behind dino, dino (run) at left ¼, cactus entering from right. Bottom hint `TAP ▲ · SWIPE ▼`.
3. **Game Over** — centered crash dino (accent), `GAME OVER` (Grotesk 700, +0.22em), optional `★ NEW RECORD!` accent pill, big Mono score, `PREV BEST · NNNNN`; `↻ RETRY` accent CTA + circular share button.
4. **Pause** — dimmed scene behind; pause bars; `PAUSED` (+0.24em); `SCORE · NNNNN`; `RESUME` accent CTA + restart / settings / home circle buttons.
5. **Invert state** — accent inner border ring; `☀ DAY ▸ NIGHT ☾` pill; scene drawn inverted. Used for the milestone flip.
6. **Milestone** — confetti (accent + ink squares/circles/diamonds), `MILESTONE` (Mono, accent), big `700m`, `SPEED ×1.6 · 进入夜晚`, dino centered on ground.
7. **Multiplayer / Ghost race** — `LIVE · GHOST RACE`, rank `2ND / 4`; your lane (accent border) + ghost lanes (`--secondary` dino at reduced opacity); bottom standings strip (P1–P4 chips, your chip accent).

Layout zones top→bottom: status/safe → HUD (score, never blocks track) → play area → hint. Dino lives at left ¼; obstacles enter from the right.

---

## 6. Interaction model

- **Whole screen is the hit area.** TAP anywhere = jump; SWIPE DOWN / long-press = duck (held = stays ducked). No on-screen game buttons — full immersion.
- **TAP** → jump over cactus. **SWIPE↓** → duck under ptero.
- **Double jump:** tap again mid-air (before apex) for extra height. Normal cactus = single jump; **large cactus requires the double jump**.

---

## 7. Day/Night cadence

`0–700m` ☀ Day (light bg / dark body) → ⚡ flip → `700–1400m` ☾ Night (dark bg / light body) → ⚡ flip → repeat. Each milestone fires simultaneously: **invert + speed-up + accent pulse**. Default milestone interval 700m.

---

## 8. Growth path — 50 levels, 10 forms (DinoForm)

Coordinate box **96 × 100 px**. Evolve every 5 levels. Body = `currentColor`, accent parts = `--hot` (`#E8552D`), eye = `--eye`. Scale ramps `.58 → 1.18` (hitbox scales with it). Accent ornaments only from Lv36+.

| Lv | Form | Build |
|---|---|---|
| 1–5  | 角蛋 Horned egg | egg `L26 T32 W44 H60` (organic radius) + accent horn triangle `L41 T12 W14 H24` + 3 light face-dots + **two thin feet** (leg `4×8` + foot `11×4`, at L38/L55, bottom) |
| 6–10 | 破壳 Hatchling | zig-zag eggshell base `L24 T58 W48 H36` (cracked top via polygon) + round head `L34 T30 30×30` + snout + accent horn + eye + **two thin feet** |
| 11–15| 幼龙 Hatched dino | **dino base** only (see below) |
| 16–20| 少年龙 | base + back spikes |
| 21–25| 角龙 | base + 1 horn |
| 26–30| 背鳍龙 | base + 3 back plates |
| 31–35| 双角龙 | base + back spikes + 2 horns |
| 36–40| 烈焰龙 ✦ | base + accent crest flames + accent tail flame + accent belly stripe + accent eye |
| 41–45| 王者龙 ✦ | base + accent crown (3 spikes) + horn + belly stripe + accent eye |
| 46–50| 巨龙 ★ | base + plates + crest flames + 2 horns + **wing** + belly stripe + accent eye |

**Dino base (forms 3–10):** tail `L6 T46 22×13 r4` · body `L20 T42 46×28 r9` · head `L58 T18 30×28 r(8 8 5 5)` · snout `L80 T32 12×11 r(0 4 4 0)` · jaw `L60 T50 10×7 r2` · back leg `L28 T64 11×24` +foot `L25 T85 16×6` · front leg `L48 T66 11×22` +foot `L47 T85 16×6` · eye `L64 T25 7×7 r2` (`--eye`, or `--hot` for Lv36+).

**Ornament parts** (all `--hot` unless noted, all triangles `polygon(50% 0,100% 100%,0 100%)`):
- back spikes (body color): `L30 T30 12×14`, `L44 T28 12×16`
- back plates (body color): `L24 T30 12×14`, `L37 T26 13×18`, `L51 T29 12×15`
- crest flames: `L24 T24 11×20`, `L36 T18 11×26`, `L48 T22 11×22`
- tail flame: `L-2 T44 16×17` `polygon(100% 0,100% 100%,0 50%)`
- horn 1: `L65 T4 12×18` · horn 2: `L76 T8 10×15`
- crown: `L59 T2 9×16`, `L68 T-1 9×19`, `L77 T3 9×15`
- wing (behind body, body color, opacity .8): `L28 T20 32×28` `polygon(0 100%,100% 100%,28% 0)`
- belly stripe: `L24 T60 36×6 r3`

**Evolution moment:** accent flash + 0.3s scale bounce.

**Principle:** spine/plates/horns are *body-color* triangles; manes/crowns/wings/belly are *accent*. Everything stacks on one base → procedurally composable, one consistent visual language.

---

## 9. Controls / components

- **Primary button:** accent fill, white text, radius 28, height ~50–54, `box-shadow: 0 4px 0 <accent-shadow>` (pressed = translateY 4px, shadow gone).
- **Secondary:** 2px `--ink` border, transparent. **Disabled:** `#D6D3CB` border + `--secondary` text.
- **Icon buttons:** 46px circle, 2px `--ink` border, ≥44px hit target. Set: sound on/off, pause, restart (↻), play (▶ triangle), share (↗), home (⌂).
