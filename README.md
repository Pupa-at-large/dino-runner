# 🦖 Dino Runner

A minimal endless-runner game in pure HTML, CSS, and JavaScript — no frameworks, no build step, no assets. Inspired by Chrome's offline dinosaur game. Works on mobile and desktop.

[**▶ Play it live**](#) <!-- replace with your GitHub Pages URL -->

## Features

- **One-tap to play** — tap, click, space, or ↑ to jump; hold / ↓ to duck
- **Variable jump height** — hold to jump higher, tap for a short hop
- **Progressive difficulty** — speed ramps up the longer you survive
- **Ground + flying obstacles** — cacti to jump, pterodactyls to duck under (after 250 pts)
- **Day / night cycle** — colors invert at score milestones
- **Persistent high score** — saved locally in your browser
- **Sound toggle** — tiny synthesized blips, no audio files
- **Responsive + crisp** — DPR-aware canvas, fits any screen, respects safe areas and dark mode

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
├── index.html   # markup + HUD
├── style.css    # mobile-first styles, dark mode
└── game.js      # game engine (loop, physics, rendering)
```

## License

MIT — see [LICENSE](LICENSE).
