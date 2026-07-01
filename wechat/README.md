# Dino Runner — WeChat Mini-Game (微信小游戏) MVP

A port of the web canvas game "Dino Runner" to a WeChat Mini-Game. Same engine
(30 levels, 11 evolving dino forms, gaps/walls/duck-bars, coins → big+shield
power-up, evolving parallax backgrounds, particles, learn-by-doing tutorial),
rebuilt with a canvas-only shell and the `wx.*` APIs.

## Run it (微信开发者工具)

1. Open **微信开发者工具 (WeChat DevTools)**.
2. Create / import a project, choosing **小游戏 (Mini-Game)** as the project type,
   and point it at this `wechat/` folder.
3. Replace the placeholder AppID in `project.config.json`
   (`"appid": "wxYOURAPPID_PLACEHOLDER"`) with your own **小游戏 AppID**.
   (You can also select the AppID in the DevTools "new project" dialog.)
4. Click **预览 (Preview)** for the simulator, or **真机调试 (Remote debug)** to
   run on a real phone.

## Project structure

- `game.json` — mini-game config (portrait, status bar hidden, network timeout).
- `project.config.json` — DevTools config (AppID placeholder, `compileType: game`).
- `game.js` — entry file; `require('./js/main.js')`.
- `js/main.js` — the full ported game (self-contained).

## Controls

- **Tap** — jump (tap again mid-air for a double jump).
- **Press-and-hold (>200ms) or swipe down (>24px)** — duck (hold to stay ducked;
  release to stand). Used to slide under overhead bars.
- On the title / game-over / level-clear screens, **tap anywhere** to
  start / retry / continue.

## MVP caveats / not yet ported

- **System font only** — the custom fonts (Space Grotesk / Space Mono) are
  replaced with the default `sans-serif` / `monospace`. `wx.loadFont` could bundle
  a real font later.
- **No sound** — WeChat has no Web-Audio oscillator, so `blip()`/`fanfare()` are
  no-ops. `wx.createInnerAudioContext()` could add short sfx clips later.
- **No Forms picker, Settings, or Level-select grid** — the flow is linear:
  START → Level 1 → (clear) Next level → … → back to Level 1 after Level 30.
- **No pause** — omitted to reduce MVP risk.
- **Light theme start** — the web version read the OS dark-mode preference to pick
  the starting day/night phase; here it always starts in light. Day/night still
  alternates during play (via the distance milestone), unchanged.
- Progress is persisted with `wx.setStorageSync` using the same keys as the web
  version (`dino_unlocked`, `dino_best`, `dino_skin`, `dino_seen`,
  `dino_champion`, `dino_tips`). Because there is no Forms picker, `dino_skin`
  stays on "auto" (newest unlocked form).
- **Untested outside DevTools** — verified for JS syntax with `node --check`, but
  `wx.*` calls only run inside the WeChat runtime / DevTools, so behaviour on a
  real device should still be smoke-tested.
- **Publishing** requires an **enterprise 小游戏 account** plus review/approval by
  WeChat before the game can go live.

## Gameplay parity

All gameplay numbers (gravity, jump velocities, speeds, spacing, coin/power
rules, mercy frames, level patterns, evolution thresholds) are identical to the
web version, so difficulty matches exactly. The play area lays the ground at
~72% of the screen height, leaving sky above for jumps, and uses the device's
logical width/height as the drawing surface.
