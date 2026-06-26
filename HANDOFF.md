# Dino Runner — Handoff document

This document hands off the project to a new developer (or a cloud Claude Code session). It captures the current state, architecture, design decisions, known gaps, and how to ship. Read this first; you should be able to continue without any prior conversation context.

---

## 1. What this is

A minimal, level-based endless-runner game (Chrome-dino style) in **pure HTML + CSS + JavaScript**. No frameworks, no build step, no external assets, no dependencies. It runs by opening `index.html`. It is designed to deploy to GitHub Pages as a static site.

**Core loop:** a pixel dino auto-runs to the right; the player jumps over cacti and ducks under pterodactyls; each level has a finish line; clearing a level unlocks the next.

---

## 2. Current state (what works today)

- One-input play: tap / click / space / ↑ to jump; hold / ↓ to duck.
- Variable jump height (hold to jump higher — gravity is halved during the rising phase while held).
- **8 levels**, each with a distance-based finish line (a checkered flag).
- **Progress bar** above the canvas showing how far the dino is from the flag.
- **Level-clear screen** ("Level cleared") that pauses the game; player taps "Next level" to continue.
- **Level select** screen reachable from the title; cleared levels are unlocked permanently.
- **Per-level difficulty ramp**: start speed, max speed, and how early pterodactyls appear all scale with level number.
- **Persistence** via `localStorage`: highest unlocked level, best score per level, sound on/off.
- **Day/night color inversion** at the level's midpoint (cosmetic milestone).
- **Synthesized sound** (WebAudio blips + a clear fanfare) — no audio files. Toggleable.
- **Responsive + crisp**: canvas scales to its container and is DPR-aware. Respects iOS safe areas, dark mode, and prevents page scroll/zoom on mobile.
- **Auto-pause** when the tab is backgrounded.
- Landed/ground dust particles, death flash feedback.

---

## 3. File structure

```
dino-runner/
├── index.html      # Markup: HUD, progress bar, canvas, 3 overlays (title / clear / level-select), control buttons
├── style.css       # Mobile-first styles, CSS variables for theming, dark-mode via prefers-color-scheme
├── game.js         # The whole engine — see architecture below
├── README.md       # Player-facing + deploy instructions
├── HANDOFF.md      # This file
├── LICENSE         # MIT
└── .gitignore
```

There is intentionally no `package.json`, bundler, or transpiler. Keep it that way unless a feature genuinely requires it.

---

## 4. Architecture of `game.js`

It's a single IIFE (`(function(){ "use strict"; ... })()`) to avoid polluting globals. Sections, top to bottom:

1. **DOM refs** — all `getElementById` lookups cached once.
2. **Levels** — `TOTAL_LEVELS` and `levelConfig(n)`. This is the single source of difficulty truth. Each level returns `{ goal, startSpeed, maxSpeed, birdFrom }`:
   - `goal` — world distance to the finish line.
   - `startSpeed` / `maxSpeed` — scroll speed bounds for that level.
   - `birdFrom` — fraction of the level (0–1) before flying obstacles can appear.
3. **Logical resolution** — the game world is computed in a fixed logical width (`BASE_W = 720`); `BASE_H` is derived from the container's aspect ratio on resize. All gameplay math uses these logical coords; the canvas transform scales them to physical pixels.
4. **`theme()`** — returns the active color set (`fg/bg/mid/line/accent`), accounting for OS dark mode AND the in-level night inversion. Colors are re-read each frame so theme changes apply live.
5. **State** — physics constants (`GRAV`, `JUMP_V`, `MAX_FALL`), the `dino` object, the `obstacles / clouds / particles` arrays, and run vars (`speed, dist, score, level, state`). `state` is a string state machine: `ready | play | clear | over | select`.
6. **Persistence** — `unlocked`, `bestByLevel`, plus `saveProgress()`. All `localStorage` reads/writes are wrapped in try/catch (private mode safe).
7. **Sound** — lazy `AudioContext`, `blip()` and `fanfare()`. Resumed on first user gesture (`startLevel`).
8. **`resize()`** — recomputes canvas pixel size, DPR scale, and the `ctx.setTransform`. Re-renders if not actively playing.
9. **Level lifecycle** — `loadLevel(n)` (reset for level n), `startLevel(n)`, `clearLevel()`, `failLevel()`.
10. **Overlay helpers** — `hideAllOverlays()` / `showOverlay(el)`.
11. **Input** — `jump()`, `releaseJump()`, `setDuck()`. Keyboard + pointer events both route here.
12. **`spawn()`** — random obstacle generation. Picks cactus (single/cluster, small/big) or bird, gated by `birdFrom`. **This is currently random; see gaps.**
13. **`update()`** — the per-frame simulation: advance distance/score, apply gravity, move obstacles/clouds/particles, spawn the finish flag near the end, run AABB collision, detect level clear. The finish flag is `type:"finish"` and is treated as a goal trigger, not a hazard.
14. **`render()`** — draws everything each frame: background, moon (night), clouds, ground, obstacles, particles, dino. The dino/cacti/birds/flag are drawn with `fillRect` primitives (no sprites).
15. **`loop()`** — `requestAnimationFrame`; only calls `update()` when `state === "play"`, always renders.
16. **Level-select grid** — `buildGrid()` builds the 8-cell selector dynamically, marking locked/cleared.
17. **Events + boot** — wires keyboard, pointer, buttons, resize, dark-mode change, visibility (auto-pause), then `loadLevel(1); resize(); render(); loop()`.

### Key invariants / gotchas

- **All gameplay coordinates are in logical space** (`BASE_W`-based), never physical pixels. If you add drawing code, use logical coords; the transform handles scaling.
- **`GROUND` is recomputed on resize** (`BASE_H - GROUND_OFFSET`). Don't hardcode a ground Y.
- **Collision skips the finish flag** — it's the goal. Don't add it to the hazard loop.
- **`state` gates input**: jumping/ducking only act in the right states. New UI must set `state` correctly or input will leak (e.g. tapping the canvas behind an overlay).
- **The canvas pointer handler early-returns during `clear`/`select`** so overlay buttons receive the tap instead of triggering a jump.
- **localStorage keys**: `dino_unlocked`, `dino_best`, `dino_sound`. Keep these stable or migrate.

---

## 5. Design decisions (and why)

- **No framework / no build** — the whole point is a tiny, instantly-deployable static toy. A bundler would add friction for zero gain at this size. Resist adding React/Vite unless scope explodes.
- **Canvas, not DOM sprites** — one canvas redrawn per frame is simpler and faster than animating dozens of DOM nodes.
- **`fillRect` primitives instead of image assets** — keeps the repo asset-free and the dino themeable (it's drawn in the current `fg` color, so dark mode / night inversion "just work"). The tradeoff: art is blocky. **This is the #1 place visual polish should go** (see gaps).
- **Logical-resolution + DPR scaling** — gameplay stays consistent across screen sizes while staying crisp on Retina.
- **Difficulty centralized in `levelConfig`** — so tuning is one function, not scattered magic numbers.
- **Synthesized audio** — no binary assets to host or license.

---

## 6. Known gaps / suggested next steps

Ordered roughly by value-to-effort. Pick up from here.

1. **Hand-authored levels (high value).** `spawn()` is currently random. To make levels feel *designed* (e.g. level 3 = a dense cactus gauntlet, level 5 = all pterodactyls), replace random spawning with a per-level obstacle sequence — an array of `{ at: distance, type, ... }` entries that `update()` consumes in order. This is the biggest step from "procedural toy" to "real game". Keep random as a fallback/endless mode if desired.
2. **Better art.** Replace the `fillRect` dino/cacti/birds with either a denser pixel grid or a small sprite sheet. If sprites: keep them monochrome-tintable so theme/night inversion still works, or add per-theme variants. (A separate Claude Design pass is planned for the visual system — see the prompt the team already has.)
3. **PWA / installable + offline.** Add `manifest.json` + a service worker so it can be "added to home screen" and played offline — very fitting for a runner. Static-site-friendly, no backend.
4. **Difficulty tuning.** Current per-level durations run ~6s (L1) → ~13s (L8). Validate this feels right; consider a guaranteed *minimum passable gap* check in spawning so fast levels never produce an impossible obstacle cluster.
5. **Milestone feedback.** Short sound/flash at distance milestones within a level for extra game-feel.
6. **Global leaderboard** (optional, scope-expanding). Would require a backend — breaks the pure-static constraint. Only if the product wants social.
7. **Accessibility.** Add reduced-motion handling (`prefers-reduced-motion`) and ensure overlay buttons are fully keyboard-navigable.

---

## 7. How to run locally

No build. Either open `index.html` directly, or serve the folder (better — avoids any file:// quirks):

```bash
python3 -m http.server 8000   # then http://localhost:8000
# or
npx serve .
```

---

## 8. How to ship to GitHub

```bash
cd dino-runner
git init
git add .
git commit -m "Initial commit: level-based dino runner"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then enable GitHub Pages: **Settings → Pages → Source: deploy from branch → main / root.** The game goes live at `https://<you>.github.io/<repo>/`. Update the "Play it live" link in `README.md` once the URL exists.

> Note: this handoff was produced in an environment without outbound network/git access, so the repo has not been pushed — the commands above are for you to run.

---

## 9. Quick orientation for a cloud Claude Code session

- Start by reading `game.js` top-to-bottom once — it's ~350 lines and self-contained.
- The difficulty/level knobs you'll most likely touch are all in `levelConfig(n)` and `TOTAL_LEVELS` at the top.
- To add designed levels, the change is localized to `spawn()` + a new per-level data table consumed in `update()`.
- Don't introduce a build system or dependencies unless a feature truly requires it; the project's value is its zero-dependency simplicity.
- Test on a narrow viewport (≤400px) and with the OS in dark mode — both are supported and easy to regress.
