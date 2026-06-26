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
- **50 hand-authored levels.** Each level is a *designed* obstacle score (not random), written as a compact pattern string and expanded into an ordered schedule. Spacing is normalized to the level's top speed, so patterns are speed-invariant and always passable. Each ends with a distance-based finish line (a checkered flag).
- **10-stage evolution ladder.** A new dino form unlocks every 5 levels: Egg → Cracked Egg → Legged Egg → Hatchling → Lil' Dino → Runner → Crested → Horned → Alpha → Super Dino. Forms are cosmetic only (the hitbox never changes). A **Forms** screen lets the player wear any unlocked form; "newest" is the default and follows progress automatically.
- **Progress bar** above the canvas showing how far the dino is from the flag; its marker shows the current form's emoji.
- **Level-clear screen** that pauses the game; announces a newly-unlocked form when one is earned; player taps "Next level" to continue.
- **Level select** screen reachable from the title (scrollable 50-cell grid); cleared levels are unlocked permanently.
- **Per-level difficulty ramp**: start speed and max speed scale with level number (capped at 16).
- **Persistence** via `localStorage`: highest unlocked level, best score per level, chosen form, sound on/off.
- **Day/night color inversion** at the level's midpoint, with a soft milestone blip.
- **Synthesized sound** (WebAudio blips + a clear fanfare) — no audio files. Toggleable.
- **PWA**: `manifest.json` + a service worker (`sw.js`) cache the app shell, so it's installable and plays offline.
- **Accessibility**: honors `prefers-reduced-motion` (no strobe/particles) and dark mode; overlay buttons are real `<button>`s with focus-visible rings.
- **Responsive + crisp**: canvas scales to its container and is DPR-aware. Respects iOS safe areas, dark mode, and prevents page scroll/zoom on mobile.
- **Auto-pause** when the tab is backgrounded.
- Landed/ground dust particles, death flash feedback.

---

## 3. File structure

```
dino-runner/
├── index.html      # Markup: HUD, progress bar, canvas, 4 overlays (title / clear / level-select / forms), control buttons
├── style.css       # Mobile-first styles, CSS variables for theming, dark-mode + reduced-motion
├── game.js         # The whole engine — see architecture below
├── manifest.json   # PWA metadata (installable)
├── sw.js           # Service worker — offline app-shell cache
├── icon.svg        # App / home-screen icon
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
2. **Levels** — `TOTAL_LEVELS` (50), `levelConfig(n)` (speed envelope: `startSpeed`/`maxSpeed`/`accel`), and `LEVEL_PATTERNS` (one authored string per level). `buildSchedule(pattern, maxSpeed)` expands a pattern into `{ items, goal }`:
   - Tokens: `c` small cactus · `C` big cactus · `2` double · `3` triple · `b` bird; spacers `.` small · `-` medium · `~` large gap (space ignored).
   - Spacing is expressed in **jump units** (`u = ~max-airtime-frames × maxSpeed`), so the same pattern feels identical at any speed and an implicit `1.0u` gap between obstacles guarantees a land-and-rejump window. This replaced the old random `spawn()` and `birdFrom`.
   - `goal` is derived from where the pattern ends (plus lead-in/out padding).
3. **Logical resolution** — the game world is computed in a fixed logical width (`BASE_W = 720`); `BASE_H` is derived from the container's aspect ratio on resize. All gameplay math uses these logical coords; the canvas transform scales them to physical pixels.
4. **`theme()`** — returns the active color set (`fg/bg/mid/line/accent`), accounting for OS dark mode AND the in-level night inversion. Colors are re-read each frame so theme changes apply live.
5. **State** — physics constants (`GRAV`, `JUMP_V`, `MAX_FALL`), the `dino` object, the `obstacles / clouds / particles` arrays, and run vars (`speed, dist, score, level, state`). `state` is a string state machine: `ready | play | clear | over | select`.
6. **Persistence** — `unlocked`, `bestByLevel`, plus `saveProgress()`. All `localStorage` reads/writes are wrapped in try/catch (private mode safe).
7. **Sound** — lazy `AudioContext`, `blip()` and `fanfare()`. Resumed on first user gesture (`startLevel`).
8. **`resize()`** — recomputes canvas pixel size, DPR scale, and the `ctx.setTransform`. Re-renders if not actively playing.
9. **Level lifecycle** — `loadLevel(n)` (reset for level n), `startLevel(n)`, `clearLevel()`, `failLevel()`.
10. **Overlay helpers** — `hideAllOverlays()` / `showOverlay(el)`.
11. **Input** — `jump()`, `releaseJump()`, `setDuck()`. Keyboard + pointer events both route here.
12. **`spawnDue()`** — pulls scheduled obstacles onto the stage as their world position reaches the right edge (replaces the old random `spawn()`). World-distance based, so spacing is exact and frame-rate independent. Birds use one duck-height lane.
13. **`update()`** — the per-frame simulation: advance distance/score, apply gravity, move obstacles/clouds/particles, pull due obstacles, spawn the finish flag near the end, run AABB collision, detect level clear. The finish flag is `type:"finish"` and is treated as a goal trigger, not a hazard.
14. **`render()` + evolution ladder** — draws everything each frame. The dino is drawn by the active stage's `draw(c)` from the `EVOLUTIONS` array (`drawDino` dispatches via `effectiveStage()`); grown-up forms share `dinoForm(c, opt)` (scale + optional spikes/horn/accent), egg forms have their own helpers. All forms use `fillRect` in `fg`/`bg`, so dark mode and night inversion still work. Cacti/birds/flag are also `fillRect`.
15. **`loop()`** — `requestAnimationFrame`; only calls `update()` when `state === "play"`, always renders.
16. **Level-select grid** — `buildGrid()` builds the 8-cell selector dynamically, marking locked/cleared.
17. **Events + boot** — wires keyboard, pointer, buttons, resize, dark-mode change, visibility (auto-pause), then `loadLevel(1); resize(); render(); loop()`.

### Key invariants / gotchas

- **All gameplay coordinates are in logical space** (`BASE_W`-based), never physical pixels. If you add drawing code, use logical coords; the transform handles scaling.
- **`GROUND` is recomputed on resize** (`BASE_H - GROUND_OFFSET`). Don't hardcode a ground Y.
- **Collision skips the finish flag** — it's the goal. Don't add it to the hazard loop.
- **`state` gates input**: jumping/ducking only act in the right states. New UI must set `state` correctly or input will leak (e.g. tapping the canvas behind an overlay).
- **The stage pointer handler ignores taps whose target is a `<button>`** (overlays live inside `#stage`, so a button's `pointerdown` would otherwise bubble down and trigger a jump/start before the button's own click — this was a latent bug). It also early-returns during `clear`/`select`/`skins`.
- **localStorage keys**: `dino_unlocked`, `dino_best`, `dino_sound`, `dino_skin` (`"auto"` = always newest form, else a stage index). Keep these stable or migrate.
- **Evolution is cosmetic.** The dino hitbox (`dino.w/h`, set in `update()`) never changes with the chosen form, so play stays fair across skins. When swapping in real art later, drop it into the `EVOLUTIONS[i].draw` hooks.
- **`?bot` debug hook**: opening the page with `?bot` exposes a read-only `window.__dino` (state, dino, obstacles, speed, jump/duck) for automated playtesting. Inert without the query param — no globals leak in normal play. A reactive auto-player using it lives in the repo's test notes; it clears all 50 levels.

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

1. ✅ **Hand-authored levels (done).** 50 designed levels via `LEVEL_PATTERNS` + `buildSchedule`; random spawning removed. The speed-normalized "jump unit" gives a built-in minimum-passable-gap guarantee. An optional endless/random mode could be added back if wanted.
2. **Better art (in progress — Design Cloud).** The 10 evolution forms are placeholder `fillRect` art, intentionally monochrome-tintable so theme/night inversion works. A separate Design pass owns the real visual system; drop sprites/denser pixel grids into the `EVOLUTIONS[i].draw` hooks, keeping them tintable (or add per-theme variants).
3. ✅ **PWA / installable + offline (done).** `manifest.json` + `sw.js` (versioned app-shell cache) + `icon.svg`. Bump `CACHE` in `sw.js` when shell files change.
4. ✅ **Difficulty tuning (done, validate by feel).** Per-level spacing auto-scales to `maxSpeed`, so no level can spawn an impossible cluster. The speed curve (`levelConfig`) is gentle L1→L50; play-test the back half and tune `LEVEL_PATTERNS` / `levelConfig` if it feels off.
5. ✅ **Milestone feedback (basic, done).** Soft blip at the level midpoint + a "new form unlocked" callout on clear. Could add more distance milestones.
6. **Food / collectibles (deferred).** Was scoped out this round. A `type:"food"` non-hazard pickup (eaten on overlap, +score, munch fx) would add rhythm to patterns and fit the "eats as it grows" narrative — a natural next gameplay layer.
7. **Global leaderboard** (optional, scope-expanding). Would require a backend — breaks the pure-static constraint. Only if the product wants social.
8. ✅ **Accessibility (done).** `prefers-reduced-motion` disables strobe/particles/transitions; overlay buttons are keyboard-navigable `<button>`s with focus-visible rings. Further: ARIA live-region for level/score, fuller screen-reader pass.

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

- Start by reading `game.js` top-to-bottom once — it's self-contained (single IIFE).
- The knobs you'll most likely touch: `LEVEL_PATTERNS` (level design), `levelConfig(n)` (speed curve), `buildSchedule` constants (global pacing), and `EVOLUTIONS` (forms).
- To tweak a level, edit its pattern string. To add a new form, add an `EVOLUTIONS` entry with a `from` level and a `draw(c)`.
- Don't introduce a build system or dependencies unless a feature truly requires it; the project's value is its zero-dependency simplicity.
- Test on a narrow viewport (≤400px) and with the OS in dark mode — both are supported and easy to regress.
- For automated playtesting, open with `?bot` and drive `window.__dino` (see gotchas).
