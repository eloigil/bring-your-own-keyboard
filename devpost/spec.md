---
doc: spec
status: approved
---

# BYOKb — Technical Spec

## How This Works, In Plain Language
BYOKb is a single web page that runs entirely in the browser. There's no server and no account.

- **The design** is one object: the keys (position, size, rotation), the components (the knob), the board-wide switch and keycap choice, per-key overrides, and the LEDs. It lives in one **store** (zustand), and the browser saves it to `localStorage` on every change, so a refresh keeps the design.
- **The 3D scene** (react-three-fiber) draws whatever the store says: keycaps, switches, the knob, the LEDs, and the case.
- **The case** is computed, not modeled. Each key's footprint becomes a rectangle. The rectangles are merged into one outline and grown outward with rounded corners (clipper-lib). The outline is extruded into 3D with beveled edges, and then tilted into a typing-angle wedge. Moving a key changes the rectangles, which changes the outline, which changes the case. That chain is the kernel.
- **The panels** on the left (steps) and right (options) edit the store; the scene updates.
- **Export** turns the same case mesh into an STL file, and turns the same key list into a QMK firmware folder zipped for download. What you see is what you print and flash.

This shape keeps a single source of truth: the store feeds the preview, the validation, and both exports, so they can't disagree.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Landing.** `App` shows `Landing`: a slowly rotating sample keyboard plus a short pitch. "Start building" switches `view` to the editor.
2. **Editor opens.** The store loads the saved design from `localStorage`, or the TKL preset on first use. The scene renders the keys, and `caseOutline(keys, switchFamily)` → `caseMesh(outline)` renders the case.
3. **Layout.** Dragging a key updates its `x/y` in the store, snapped to a 0.25u grid. The outline and mesh recompute, at most once per animation frame. Resizing the board or picking a preset replaces the key list. After every change, `validate(design)` marks overlapping items, and the scene tints them red.
4. **Components.** Choosing a switch sets `board.switchId`. If the family changes (MX ↔ Choc), the unit size in mm changes, so the case and spacing shrink or grow automatically. Double-clicking a key sets its `override`. Dropping the knob runs `snapAside`, which shifts the overlapping keys in that row to the right.
5. **LEDs.** Painting writes `key.led = '#ff0000'`, and choosing an effect sets `board.ledEffect`. `Leds` animates the emissive colors in `useFrame`. Painted keys override the effect on those keys.
6. **Export.** If `validate` reports issues, the buttons are disabled with a message. Otherwise **STL** runs the case mesh through `STLExporter` and downloads it, and **Firmware** runs `qmk(design)`, which generates `keyboard.json` + `keymap.c` + a README, zipped with fflate.

```
 panels ──edit──▶ store (zustand + localStorage)
                     │
     ┌───────────────┼──────────────────┬───────────────┐
     ▼               ▼                  ▼               ▼
  3D keys      caseOutline→caseMesh   validate        qmk()
  + LEDs            │                   │               │
                    ├─▶ 3D case      red tint,       firmware.zip
                    └─▶ STLExporter  blocks export
                         → case.stl
```

## Stack
Versions checked with `npm view` on 2026-10-09. Let Vite's template choose compatible versions; these are reference points.

| Piece | Version | Why | Docs |
|---|---|---|---|
| React + TypeScript | react 19.3 | Learner's choice | https://react.dev |
| Vite | 8.3 | Standard dev server and bundler for React (agent-derived, accepted) | https://vite.dev |
| three.js | 0.186 | 3D engine; includes `ExtrudeGeometry` and `STLExporter` | https://threejs.org/docs |
| @react-three/fiber | 9.8 | Learner's choice: three.js as React components | https://r3f.docs.pmnd.rs |
| @react-three/drei | 10.7 | OrbitControls, ContactShadows, Html helpers | https://drei.docs.pmnd.rs |
| zustand | 5.0 | One design store + `persist` to localStorage | https://zustand.docs.pmnd.rs |
| clipper-lib | 6.4 | Polygon union and rounded offset for the case outline (replaced clipper2-js, see checklist Revisions) | https://www.npmjs.com/package/clipper-lib |
| fflate | 0.8 | Zips the firmware folder in the browser | https://github.com/101arrowz/fflate |
| Vitest | (latest) | Fast checks for the pure geometry, validation, and firmware logic | https://vitest.dev |

**Verified in slice 1:** clipper2-js produced wrong offsets, so the build uses the fallback `clipper-lib`.

## Where It Runs and How Someone Tries It
- **Runtime:** a browser (Chrome recommended), with Node 22 to run the dev server. No API keys.
- **Start:** `npm install`, then `npm run dev`, then open `http://localhost:5173`.
- **Checks:** `npm test` (Vitest).
- **Demo recording:** landing → editor → pick 60% → drag a key and watch the case → MX → Choc → add the knob → paint LEDs + effect → export the STL and open it in a slicer/viewer → export the firmware and show the zip contents.
- **Deployment:** none (learner's choice: run locally). A static build (`npm run build`) could go to GitHub Pages later.
- Submission needs the demo video and a public GitHub repo (`6-ship`).

## Look and Feel
From `prd.md > Look and Feel`: a simple neutral environment like ShipShaper's, aiming for the Tiny Glade feel.
- **Scene:** a soft light-grey studio backdrop, one key light plus fill (no HDR download, so it works offline), `ContactShadows` under the board, and gentle orbit with damping.
- **Panels:** floating white cards with rounded corners (12px), soft shadows, generous padding. Plain readable sans (system UI stack). One accent color for the active step and buttons.
- **Motion:** keys and the case ease into new positions (short lerp), never jump. Invalid items pulse a subtle red.
- **Copy:** friendly and short ("Drag keys to reshape your board").
- **Unverified:** the agent hasn't examined ShipShaper's actual look. Check the reference at the first visual build step and adjust.

## Components

### Store (`src/store/design.ts`)
Holds the design and the actions (`moveKey`, `addKey`, `deleteKey`, `setPreset`, `resizeBoard`, `setSwitch`, `setKeycap`, `setOverride`, `addKnob`, `moveComponent`, `paintKey`, `setEffect`). Persists to `localStorage` under `byokb-design`, with a `version` for resets.
PRD ref: `prd.md > States and Boundaries`.

### Landing (`src/ui/Landing.tsx`)
A small r3f canvas with a rotating sample board, the title, a two-line pitch, and a "Start building" button. Minimal by design.
PRD ref: `prd.md > Screens and Layout`.

### Editor Shell (`src/ui/Editor.tsx`, `StepsPanel.tsx`, `OptionsPanel.tsx`)
A full-screen canvas with a left steps card (Layout → Build → LEDs → Export, freely clickable) and a right options card that switches content by step.
PRD ref: `prd.md > Screens and Layout`.

### Scene (`src/scene/`)
- `Board.tsx` — renders the keys (keycap + switch stem colored by switch). Handles selection, drag on the plate plane (snapped to 0.25u), and double-click to override.
- `Keycap.tsx` — keycap geometry per profile: a tapered, beveled box. Sculpted profiles (Cherry, OEM, SA, MT3, KAT) vary height and tilt by row; flat profiles (DSA, XDA) are uniform. These shapes are approximations, not exact profiles.
- `Case.tsx` — renders the mesh from `caseMesh`.
- `Knob.tsx` — a cylinder knob, draggable.
- `Leds.tsx` — per-key emissive underglow; animates effects in `useFrame`.
- `ResizeHandle.tsx` — a handle on the board's right edge.
- `PocketOrb.tsx` — one orb per pocket, placed between `mouth` and `deep` by its fill; dragging projects the pointer onto that line and writes the depth to the store (orbit controls paused while dragging).
PRD ref: `prd.md > Layout Step`, `prd.md > Components Step`, `prd.md > LEDs Step`.

### Case Geometry (`src/lib/case.ts`)
- `caseOutline(keys, components, family)` → polygons. Each key/component footprint is converted to mm (MX 19.05 mm/u; Choc 18 × 17 mm/u), rotated, unioned, then inflated by a bezel margin with round joins. Split boards naturally produce two polygons.
- `pockets(keys, family, fills)` → for each body: snug outline (keys + bezel, holes filled) vs. its convex hull; each region in between is a pocket with `mouth` (center of its opening on the hull), `deep` (its deepest point) and `depth`. A pocket's fill is everything behind a straight wall parallel to its mouth, `depth × (1 − t)` in from the mouth (t: 0 = open, 1 = flush); untouched pockets start flush (t = 1); pockets shallower than 8 mm are always filled and get no orb. `caseOutline` = snug ∪ fills, lightly rounded, enclosed voids dropped.
- `caseMesh(outline, family)` → `BufferGeometry`. A solid body up to the top face, with a recessed **well** only around the keys (key footprints + 0.75 mm, never closer than the wall to the outside). The plate (switch cutouts: MX 14 mm, Choc 13.8 mm) and the floor sit in the well; bezel and filled pockets stay at full top height. The rounded top edge is a stack of six thin straight-extruded slabs, each inset a little more along a quarter-round (three.js's own bevel triangulates a shifted contour and folds over at the pockets' sharp corners). Then the vertex tilt for the typing angle.
PRD ref: `prd.md > Layout Step` (Living case), `prd.md > Export Step`.

### Layout Logic (`src/lib/layout.ts`)
- **Presets:** 19 layouts grouped in `PRESET_CATEGORIES` (Standard, Ergonomic, Split columnar, Ortholinear, Small) as key arrays in `u` (KLE-like); split columnar boards share a `columnar()` builder (6 columns, per-column stagger, mirrored thumb clusters). Layouts are approximations of the named boards, not exact replicas.
- `resizeBoard(keys, width, mode)`: *snap* picks the nearest preset width; *free* removes keys beyond the width or fills rows with 1u keys up to it.
- `snapAside(keys, component)`: keys in the rows the component overlaps, at or right of it, shift right by its width.
PRD ref: `prd.md > Layout Step`, `prd.md > Components Step`.

### Validation (`src/lib/validate.ts`)
Returns the IDs of overlapping items (via clipper intersection area > ε). Used for the red tint and to block export.
PRD ref: `prd.md > States and Boundaries` (Invalid design).

### Catalog (`src/data/switches.json`, `src/data/keycaps.ts`)
Switches: `{ id, brand, type: linear|tactile|clicky, model, family: MX|Choc, stemColor, forceG }`, grouped brand → type → model in the UI. Best-effort data. Keycap profiles: Cherry, OEM, SA, DSA, XDA, MT3, KAT with their shape parameters.
PRD ref: `prd.md > Components Step`.

### STL Export (`src/lib/exportStl.ts`)
`STLExporter` (binary) on the case mesh → download `byokb-case.stl`.
PRD ref: `prd.md > Export Step`.

### Firmware Export (`src/lib/qmk.ts`)
Generates a QMK keyboard folder for an **assumed hand-wired Raspberry Pi Pico (RP2040)**:
- **Matrix:** keys sorted by row then column, packed into a near-square matrix (rows = ⌈√n⌉) so even a full-size board fits the Pico's GPIO. Row/col pins are assigned from a fixed GPIO list.
- `keyboard.json`: name, `processor: RP2040`, `bootloader: rp2040`, `matrix_pins`, `diode_direction: COL2ROW`, `layouts.LAYOUT` (matrix + x/y/w), `rgb_matrix` (`driver: ws2812`, LED layout mirroring the keys, enabled animations), `ws2812.pin`, `encoder.rotary` if there's a knob.
- `keymaps/default/keymap.c`: a default keymap (letters by position, `KC_NO` for unknowns), the default effect mode, painted colors via `rgb_matrix_indicators_advanced_user`, and an encoder mapped to volume.
- `README.md`: the wiring table (key → row/col pin) and `qmk compile` / flash steps.
- Zipped with fflate → `byokb-firmware.zip`.
Docs: https://docs.qmk.fm/reference_info_json, https://docs.qmk.fm/features/rgb_matrix, https://docs.qmk.fm/features/encoders
PRD ref: `prd.md > Export Step`.

## Data Model
```ts
type Unit = number;                         // 1u = one key width
interface Key {
  id: string; x: Unit; y: Unit; w: Unit; h: Unit; rot: number; // degrees, around key center
  legend?: string;                          // for keymap generation
  override?: { switchId?: string; keycapColor?: string; profileId?: string };
  led?: string;                             // painted hex color; undefined = not painted
}
interface Component { id: string; type: 'knob'; x: Unit; y: Unit }
interface Design {
  version: 1;
  keys: Key[]; components: Component[];
  board: { switchId: string; profileId: string; keycapColor: string; snap: 'snap' | 'free';
           ledEffect: 'none' | 'breathing' | 'wave' | 'reactive'; tiltDeg: number /* typing angle, 0–12°, default 6 */; ledColor: string /* effect colour */ };
  /** Pocket fills set by orbs (t: 0 = open, 1 = flush), anchored at the pocket's mouth (mm, layout coords). */
  pocketFills: { x: number; y: number; t: number }[];
}
// UI-only, not persisted: view ('landing'|'editor'), step, selectedId
```
- **Where it lives:** the zustand store, mirrored to `localStorage['byokb-design']`.
- **How it updates:** only through store actions.
- **On return:** reloaded from `localStorage`. A missing or invalid design, or a version mismatch, resets to the TKL preset.
- **Derived, never stored:** case outline/mesh, validation results, switch family, firmware.
- **"LEDs off until configured":** true when no key has `led` and `ledEffect === 'none'`.

## File Structure
```
BYOKb/
├── index.html
├── package.json
├── vite.config.ts
├── README.md                 # what it is, how to run, data caveats
├── src/
│   ├── main.tsx
│   ├── App.tsx               # view switch: Landing | Editor
│   ├── styles.css            # panel cards, tokens
│   ├── store/
│   │   └── design.ts         # zustand store + persist + actions
│   ├── ui/
│   │   ├── Landing.tsx
│   │   ├── Editor.tsx        # canvas + two panels
│   │   ├── StepsPanel.tsx    # left: step list
│   │   ├── OptionsPanel.tsx  # right: picks the step's options
│   │   └── options/
│   │       ├── LayoutOptions.tsx   # preset picker
│   │       ├── ShapeOptions.tsx    # add/delete keys, resize
│   │       ├── ComponentsOptions.tsx
│   │       ├── LedOptions.tsx
│   │       └── ExportOptions.tsx
│   ├── scene/
│   │   ├── Stage.tsx         # lights, backdrop, shadows, orbit
│   │   ├── Board.tsx         # keys + interactions
│   │   ├── Keycap.tsx
│   │   ├── Case.tsx
│   │   ├── Knob.tsx
│   │   ├── Leds.tsx
│   │   └── ResizeHandle.tsx
│   ├── lib/
│   │   ├── units.ts          # u → mm per switch family
│   │   ├── case.ts           # caseOutline, caseMesh   (the kernel)
│   │   ├── layout.ts         # presets, resizeBoard, snapAside
│   │   ├── validate.ts
│   │   ├── exportStl.ts
│   │   ├── qmk.ts
│   │   └── *.test.ts         # Vitest checks for case, layout, validate, qmk
│   └── data/
│       ├── switches.json
│       └── keycaps.ts
└── devpost/                  # planning docs
```

## External Services and Dependencies
None at runtime. No APIs, no keys, no hosting. Everything is an npm package bundled at build time. The scene avoids remote HDR environments, so the app works offline.

## Important Failure Modes
- **The outline breaks** (no keys, or degenerate polygons) → the case isn't rendered, and the panel shows "Add a key to start your board." Export is disabled.
- **The saved design is corrupt or from an old version** → silently reset to TKL (no crash).
- **Dragging feels slow on large boards** → the outline recomputes at most once per frame. If still slow, the case updates on drag end while the keys move live.
- **Too many keys for the Pico's pins** (> ~24 matrix pins) → the near-square matrix keeps ~120 keys within the limit. Beyond that, export is blocked with "too many keys for a single controller."

## What Was Simplified and Why
- **An extruded, beveled, tilted case** instead of a CAD-modeled case with curved walls. Keeps one fast `keys → outline → mesh` function for both preview and STL. Fuller version: a CSG/CAD kernel (e.g. OpenCascade WASM).
- **An assumed hand-wired Pico** instead of firmware for a real PCB. No PCB exists in the PoC. Fuller version: generated from the PCB netlist when PCB generation lands.
- **Pocket identity by mouth position** instead of tracking pockets through edits. A saved depth follows the pocket whose opening is nearest (within ~1u); if a pocket disappears its depth is dropped. Fuller version: topological pocket tracking.
- **A near-square, arbitrary key matrix** instead of physical rows/columns. Fits any board on one controller; costs wiring readability, which the README's wiring table covers.
- **Approximate keycap shapes** instead of exact profile models. Enough to see the difference between profiles.
- **A hand-built switch catalog**, labeled best-effort. There's no free switch database.
- **The knob only** among components. Others are deferred (`prd.md > Possible Later Enhancements`).

## Decisions and Open Issues
**Learner decisions:**
- React + react-three-fiber + TypeScript.
- Case approach: union + rounded offset + extrude, accepted provisionally ("not fully convinced, but let's try this way").
- QMK firmware on an assumed RP2040 hand-wire.
- Hand-built JSON catalog.
- Run locally; no deployment for now.

**Agent-derived (follow from the above):** Vite, zustand + persist, clipper-lib, fflate, Vitest, a near-square matrix on a Pico, a 0.25u drag grid.

**Learner uncertainty and how it's checked:** will the computed case look "flat and blocky, not like a real case", and can it handle "curved or ergonomic layouts"? Clarified with the plan for rounded joins, bevels, and the vertex tilt. Rotated and staggered keys are just rotated polygons. **Check:** build step 1 renders a TKL, a column-staggered split, and an Alice-style rotated layout with the full case treatment. The learner judges them visually before anything is built on top. If it fails, change the case approach first.

**Open, resolve during the build:**
- ShipShaper's actual look, to check at the first visual step.
- How exactly the split preset's halves export: one STL with two bodies (default), and one QMK matrix as if hand-wired to one controller. True split firmware (two controllers) is deferred.
