# 🦖 Dino Runner

A minimal level-based runner game in pure HTML, CSS, and JavaScript — no frameworks, no build step, no assets, no dependencies. Inspired by Chrome's offline dinosaur game. Works on mobile and desktop, and installs as an offline PWA.

[**▶ Play it live**](#) <!-- replace with your GitHub Pages URL -->

## Features

- **One-tap to play** — tap, click, space, or ↑ to jump; hold / ↓ to duck
- **Variable jump height** — hold to jump higher, tap for a short hop
- **50 hand-authored levels** — each is a designed obstacle score, not random; spacing auto-scales to each level's speed so every level stays fair
- **Evolve your dino** — clear levels to unlock 10 forms, from a wobbling egg to a Super Dino; pick any unlocked form in **Forms**
- **Ground + flying obstacles** — cacti to jump, pterodactyls to duck under (or jump over)
- **Day / night cycle** — colors invert at each level's midpoint
- **Progress + level select** — a flag-to-flag progress bar and a 50-level picker
- **Persistent progress** — unlocked levels, best score per level, and chosen form saved locally
- **Sound toggle** — tiny synthesized blips, no audio files
- **Installable & offline** — PWA manifest + service worker cache the whole app
- **Accessible** — honors `prefers-reduced-motion` and dark mode; keyboard-navigable
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
| Jump | Space / ↑ / click | Tap screen or JUMP |
| Duck | ↓ (hold) | Hold DUCK |
| Higher jump | Hold jump | Hold tap |

## Structure

```
dino-runner/
├── index.html     # markup + HUD + overlays
├── style.css      # mobile-first styles, dark mode, reduced-motion
├── game.js        # game engine (levels, physics, evolution, rendering)
├── manifest.json  # PWA metadata
├── sw.js          # service worker (offline app-shell cache)
└── icon.svg       # app icon
```

## License

MIT — see [LICENSE](LICENSE).
