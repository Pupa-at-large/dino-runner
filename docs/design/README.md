# Dino Runner — UI Handoff

This folder hands the **Dino Runner** visual system to a coding agent (Claude Code) or a human dev.

## What to read first
1. **`DESIGN_SPEC.md`** — the single source of truth. Color tokens, type scale, exact glyph geometry (px coordinates), all 7 screens, interaction model, day/night cadence, the 10-form evolution, and components. Read this fully before writing any code; it is written to be reproduced 1:1.
2. **`Dino Runner Visual System (standalone).html`** — open in a browser to *see* everything the spec describes (cover, color, type, logo, all screens, characters, effects, growth path). Pure visual reference — self-contained, no build, no dependencies.

## How to use it
- Build the game UI from `DESIGN_SPEC.md`; treat the standalone HTML as the pixel reference.
- Every character/obstacle/dino-form in the spec is plain flat geometry (rounded rects + circles + triangles) given as absolute px boxes in a fixed coordinate box — reproduce with CSS, SVG, or canvas, your choice.
- Keep the two-token invert rule and the constant accent (`#E8552D`) intact — they're load-bearing for the day/night mechanic and danger legibility.

## Stack-agnostic
Nothing here assumes a framework. The spec maps cleanly onto React/Vue/Svelte components, a `<canvas>` game loop, or a Unity/Phaser sprite sheet.
