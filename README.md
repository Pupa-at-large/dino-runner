# 🦖 Dino Runner

A minimal level-based runner game in pure HTML, CSS, and JavaScript — no frameworks, no build step, no assets, no dependencies. Inspired by Chrome's offline dinosaur game. Works on mobile and desktop, and installs as an offline PWA.

[**▶ Play it live**](#) <!-- replace with your GitHub Pages URL -->

## Features

- **Whole-screen controls** — tap to jump, tap again mid-air to double jump, swipe down to duck
- **Double-jump gate** — small cacti need one jump; tall cacti require the double jump
- **50 hand-authored levels** — each is a designed obstacle score, not random; spacing auto-scales to each level's speed so every level stays fair
- **Evolve your dino** — clear levels to unlock 10 flat-geometry forms, from a horned egg to a 巨龙 (the hitbox grows with you); pick any unlocked form in **Forms**
- **Ground + flying obstacles** — cacti to jump, pterodactyls to duck under (or jump over)
- **Day / night cycle** — full-screen invert + accent pulse + speed surge at each milestone, with a constant orange danger accent
- **Design-driven visuals** — built to the Design Cloud spec (`docs/design/DESIGN_SPEC.md`): two-token theme, Space Grotesk / Space Mono type, flat-geometry glyphs
- **Screens** — title, HUD, level-clear, level-select (50), Forms, Pause, Settings
- **Persistent progress** — unlocked levels, best score per level, chosen form, preferences saved locally
- **Installable & offline** — PWA manifest + service worker cache the whole app (fonts included)
- **Accessible** — `prefers-reduced-motion` (toggleable) and dark mode; keyboard-navigable
- **Responsive + crisp** — DPR-aware canvas, fits any screen, respects safe areas

## Run locally

No build needed. Just open `index.html`, or serve the folder:

```bash
# Python
python3 -m http.server 8000
# then visit http://localhost:8000

# or Node
npx serve .
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Go to **Settings → Pages**.
3. Set source to your default branch, root folder.
4. Your game is live at `https://<username>.github.io/<repo>/`.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Jump | Space / ↑ / click | Tap anywhere |
| Double jump | Tap again mid-air | Tap again mid-air |
| Duck | ↓ (hold) | Swipe down / long-press |
| Pause | Esc / P | Pause button |

Small cacti need one jump; **tall cacti require a double jump**. Duck (or jump) under pterodactyls.

## Structure

```
dino-runner/
├── index.html     # markup + HUD + overlays
├── style.css      # mobile-first styles, @font-face, dark mode, reduced-motion
├── game.js        # game engine (levels, physics, evolution, rendering)
├── manifest.json  # PWA metadata
├── sw.js          # service worker (offline app-shell cache)
├── icon.svg       # app icon
├── fonts/         # self-hosted Space Grotesk + Space Mono (woff2)
└── docs/design/   # Design Cloud visual spec (DESIGN_SPEC.md)
```

## License

MIT — see [LICENSE](LICENSE).
