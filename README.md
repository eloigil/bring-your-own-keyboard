# BYOKb — Bring Your Own Keyboard

Design a custom mechanical keyboard like a game, then export the files to build it.

Drag keys around and the 3D case reshapes itself to fit them. Pick switches and keycaps, add a knob or a trackball, design an LED effect. When you're done, one click gives you a case to 3D-print and QMK firmware to flash. Everything runs in the browser; nothing is uploaded.

Inspired by [Tiny Glade](https://tinyglade.com): simple actions, satisfying responses, no CAD.

## Features

- **19 starting layouts**: 40% to full size, Alice and Arisu, split columnar (Corne, Lily58, Sofle, Kyria), ortholinear (Planck, Preonic) and small pads.
- **A live 3D case** that wraps any layout, with an adjustable typing angle and gaps you can fill or open.
- **52 switches** (MX and Choc) with force curves and sounds, and 7 keycap profiles in solid, frosted or clear plastic.
- **Parts**: an RP2040 controller (XIAO, RP2040-Zero or Pico), knob, OLED screen, trackball, joystick, touchpad and slider.
- **LED effects** previewed in 3D, the same ones the firmware runs.
- **Export**
  - the case as three STLs that print flat without supports (shell, switch plate, bottom plate), with printing notes
  - QMK firmware for a hand-wired build, with a README holding the wiring table
  - the design as a file, or as a link that carries the whole design
- Undo and redo, and per-part colours.

## Run it

Needs Node 22 or newer.

```bash
npm install
npm run dev
```

Then open the URL Vite prints.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Type-check and production build into `dist/` |

## How it works

| Path | What's there |
|---|---|
| `src/lib/layout.ts` | Presets, key placement, snapping |
| `src/lib/case.ts` | The case: outline, pockets, plate cutouts, the three printable parts |
| `src/lib/exportStl.ts` | STL export and printing notes |
| `src/lib/qmk.ts` | QMK firmware: matrix, pins, keymap, LEDs, parts |
| `src/lib/share.ts` | Design files and share links |
| `src/scene/` | The 3D scene (react-three-fiber) |
| `src/ui/` | The four steps: Layout, Build, Lights, Export |
| `src/data/` | Switches, keycap profiles, materials, parts and controller pinouts |
| `devpost/` | Scope, PRD and spec written before the build |

Built with React, Three.js (react-three-fiber, drei, postprocessing), Zustand, Clipper, fflate, Vite and Vitest.

## Status

A proof of concept built for the Devpost *Build With AI* hackathon with [Claude Code](https://claude.com/claude-code).

Next up: a KiCad PCB export, routed PCB traces, more sound effects and general polish.
