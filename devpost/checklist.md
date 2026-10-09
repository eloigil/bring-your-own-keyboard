---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Three test boards render with a real-looking case**
  Becomes usable: A running app showing a TKL, a column-staggered split, and an Alice-style rotated board in the neutral studio scene, each with a rounded, beveled, tilted case computed from its keys. A toggle switches between them.
  Why now: This is the kernel and the learner's recorded doubt ("flat and blocky", "curved or ergonomic layouts"). If the case approach fails, everything else changes, so it's proven before anything is built on top. It also confirms the clipper2-js API.
  PRD ref: `prd.md > Layout Step` (Living case), `prd.md > Look and Feel`
  Spec ref: `spec.md > Case Geometry`, `spec.md > Stack`, `spec.md > Look and Feel`, `spec.md > File Structure`
  Build: Scaffold Vite + React + TS, install three/r3f/drei/clipper2-js/vitest, add `src/lib/units.ts` and `src/lib/case.ts` (`caseOutline`, `caseMesh` with round joins, bevel, switch cutouts, and tilt), `src/scene/Stage.tsx`, `Case.tsx`, and simple keycaps, plus three hardcoded test layouts.
  Verify (mechanical): `npm test` passes checks that a split layout gives 2 outline polygons, deleting a corner key yields a notch (area shrinks, the polygon has more vertices), and a rotated key stays inside the outline. `npm run build` succeeds. The dev server starts with no console errors.
  Learner check: Run `npm run dev`, open http://localhost:5173, flip between the three boards, orbit around them, and decide: does this read as a real keyboard case?
  Commit: `Render computed cases for three test layouts`

- [x] **2. The editor opens on your saved TKL with steps and presets**
  Becomes usable: The editor layout: 3D board in the center, steps on the left (Layout → Components → LEDs → Export), options on the right. It opens on TKL, and picking 60/65/75/TKL/full/split/ortho replaces the board and case. The design survives a refresh.
  Why now: Gives every later feature its home (store, panels, step navigation) and makes the board data-driven instead of hardcoded.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Layout Step` (Presets), `prd.md > States and Boundaries` (First use, Persistence)
  Spec ref: `spec.md > Store (src/store/design.ts)`, `spec.md > Editor Shell (src/ui/Editor.tsx, StepsPanel.tsx, OptionsPanel.tsx)`, `spec.md > Layout Logic (src/lib/layout.ts)`, `spec.md > Data Model`
  Build: Zustand store with persist, the version check and TKL reset, the Data Model types, presets in `layout.ts`, the Editor shell with panel cards, and `LayoutOptions` preset picker.
  Verify (mechanical): Tests confirm every preset has unique key IDs and non-overlapping keys, and that a corrupt or old-version saved value resets to TKL. In the browser, pick 60%, reload, and confirm 60% is still shown.
  Learner check: Open the editor, click through the steps, pick a few presets, refresh the page, and check that your last board is still there.
  Commit: `Add editor shell, presets, and saved design`

- [x] **3. Drag, add, and delete keys while the case follows**
  Becomes usable: Select a key and drag it (0.25u grid), add a key, delete a key, and the case reshapes live with eased motion. Each pocket in the case has an orb you drag to set its depth. Overlapping keys pulse red.
  Why now: This is the interactive kernel, the "drag a wall" moment. Validation lands here because dragging is the first way to create overlaps.
  PRD ref: `prd.md > Layout Step` (Single-key editing, Living case), `prd.md > States and Boundaries` (Invalid design)
  Spec ref: `spec.md > Scene (src/scene/)`, `spec.md > Validation (src/lib/validate.ts)`, `spec.md > Case Geometry`
  Build: Selection and drag in `Board.tsx`, add/delete actions and buttons, per-frame outline recompute, `pockets()` in `case.ts`, `PocketOrb.tsx` with `pocketFills` in the store, `validate.ts`, and the red pulse.
  Verify (mechanical): Tests confirm that `validate` flags two overlapping keys and clears once separated, that `moveKey` snaps to 0.25u, that a TKL with Pause deleted has a pocket there, and that fill d=0 leaves the notch open while d=depth makes the outline contain the Pause center. In the browser, dragging a key outward visibly extends the case (screenshot check).
  Learner check: Drag a corner key outward and watch the case stretch, delete one and drag its pocket orb in and out, drop a key on top of another and see the red pulse.
  Commit: `Add live key editing with reshaping case and overlap warnings`

- [ ] **4. Resize the whole board with snap or freeform**
  Becomes usable: A handle on the board's right edge resizes it. In *snap* mode it jumps between standard sizes (60 → 65 → 75 → TKL → full). In *freeform* it adds or removes keys anywhere in between. A toggle in the Layout options switches mode.
  Why now: Completes the Layout step on top of slice 3's editing.
  PRD ref: `prd.md > Layout Step` (Board resize, Snap toggle)
  Spec ref: `spec.md > Layout Logic (src/lib/layout.ts)`, `spec.md > Scene (src/scene/)`
  Build: `resizeBoard` in snap and free modes, `ResizeHandle.tsx`, the snap toggle in `ShapeOptions` (Shape step).
  Verify (mechanical): Tests confirm that snap mode always returns a preset width and that free mode removes keys past the width and fills to it.
  Learner check: Drag the edge with snap on (does it jump between known sizes?), then switch to freeform and stop halfway.
  Commit: `Add board resize with snap and freeform modes`

- [ ] **5. Choose switches and keycaps, board-wide or per key**
  Becomes usable: The Components step: a switch catalog grouped brand → type → model and keycap color and profile, applied board-wide. Double-click any key to override it. Switching MX ↔ Choc changes the spacing and the case.
  Why now: Switch family changes the geometry, so it must exist before export.
  PRD ref: `prd.md > Components Step`
  Spec ref: `spec.md > Catalog (src/data/switches.json, src/data/keycaps.ts)`, `spec.md > Scene (src/scene/)`, `spec.md > Case Geometry`
  Build: `switches.json` (best-effort, as complete as practical), keycap profile shapes in `keycaps.ts`/`Keycap.tsx`, `ComponentsOptions`, and an override panel on double-click.
  Verify (mechanical): Tests confirm every switch has a valid family, and that the Choc case outline is smaller than MX for the same layout. In the browser, changing one key's color after a double-click changes only that key.
  Learner check: Switch Cherry MX Red → Kailh Choc Brown and watch the board tighten, try SA vs DSA, double-click one key and make it a different color.
  Commit: `Add switch and keycap selection with per-key overrides`

- [ ] **6. Add a knob that pushes keys aside**
  Becomes usable: Add a knob in Components and drag it anywhere. Keys in its rows shift right to make room, and the case grows around it.
  Why now: Depends on the Components step and slice 3's dragging.
  PRD ref: `prd.md > Components Step` (Knob)
  Spec ref: `spec.md > Layout Logic (src/lib/layout.ts)`, `spec.md > Scene (src/scene/)`
  Build: `Knob.tsx`, `addKnob`/`moveComponent`, `snapAside`, the knob included in the case outline and validation.
  Verify (mechanical): Tests confirm that after `snapAside` no key overlaps the knob, and keys in other rows are untouched.
  Learner check: Add a knob, drag it into the top row, and watch keys move aside and the case adapt.
  Commit: `Add draggable knob with snap-aside`

- [ ] **7. Paint LEDs and pick effects**
  Becomes usable: The LEDs step: paint per-key colors and pick an effect (breathing, wave, reactive). The lights stay off until configured and remain visible in every step afterwards.
  Why now: The firmware export needs the LED data, so it comes before export.
  PRD ref: `prd.md > LEDs Step`
  Spec ref: `spec.md > Scene (src/scene/)`, `spec.md > Data Model`
  Build: `Leds.tsx` emissive underglow with `useFrame` animation, `LedOptions` with a color picker and effect list, and paint mode on click.
  Verify (mechanical): Tests confirm the "LEDs configured" rule (false by default; true after a paint or an effect). In the browser, the painted key renders lit (screenshot check).
  Learner check: Before touching LEDs, confirm the board is dark. Paint a few keys, pick wave, then go back to Layout and confirm the lights are still on.
  Commit: `Add LED painting and effects`

- [ ] **8. Export a printable case and QMK firmware**
  Becomes usable: The Export step shows the build summary and two downloads: `byokb-case.stl` and `byokb-firmware.zip` (keyboard.json, keymap.c, README with a wiring table). Both are disabled with a message while anything is red.
  Why now: Completes the "physically buildable" half of the demo once every input to the files exists.
  PRD ref: `prd.md > Export Step`, `prd.md > States and Boundaries` (Invalid design)
  Spec ref: `spec.md > STL Export (src/lib/exportStl.ts)`, `spec.md > Firmware Export (src/lib/qmk.ts)`, `spec.md > Important Failure Modes`
  Build: `exportStl.ts`, `qmk.ts` (near-square matrix, Pico pins, rgb_matrix, encoder, painted colors, effect), fflate zip, `ExportOptions` with blocking.
  Verify (mechanical): Tests confirm that `qmk()` produces valid JSON whose layout key count equals the design's, that matrix pins plus the LED pin fit the Pico, and that the knob produces an encoder entry. The STL buffer is non-empty and parses back with three's `STLLoader`. Downloads are disabled when `validate` reports issues.
  Learner check: Export both files. Open the STL in a slicer or viewer (or https://www.viewstl.com) and compare it to the screen, then unzip the firmware and skim the README wiring table.
  Commit: `Add STL and QMK firmware export`

- [ ] **9. Landing page leads into the editor**
  Becomes usable: Opening the app shows a small 3D landing (a rotating sample board, the title, a two-line pitch) with "Start building" leading to the editor.
  Why now: Wrapping, not kernel. Last, so it can show off the finished board.
  PRD ref: `prd.md > Screens and Layout` (Landing page), `prd.md > The Core Journey` (step 1)
  Spec ref: `spec.md > Landing (src/ui/Landing.tsx)`
  Build: `Landing.tsx` and the `view` switch in `App.tsx`.
  Verify (mechanical): `npm run build` and `npm test` pass. In the browser, the landing renders and "Start building" shows the editor with the saved design.
  Learner check: Open the app fresh, read the landing as a first-time visitor would, and click into the editor.
  Commit: `Add landing page`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1: does the computed case look real? (decides whether the case approach stands)
- [x] Kernel interaction explored — after slice 3: does dragging keys and watching the case feel like play?
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions
- Case outline library switched from clipper2-js to clipper-lib (the spec's fallback) — clipper2-js 1.2.4 broke offsets when union results contained duplicate points, and even after trimming them the rounded outline came out with the wrong area.
- Added `src/types.ts` for the shared `Key` type — the case geometry needs it before the store exists (slice 2).
- Case outline now fills gaps between key groups and smooths pockets per body (closing, CLOSE = 30 mm) — checkpoint 1: the learner saw odd gaps and a thin slot beside the arrow cluster; tight outline-following looked unreal there.
- Added per-pocket fill orbs to slice 3 (PRD Layout Step, spec Case Geometry/Scene/Data Model) — learner chose per-pocket control over a single global one; replaces the 'deleting a corner key leaves a notch' criterion with orb-controlled depth.
- Case walls use creased normals — curved walls showed vertical banding from flat per-face shading.
- Pocket fill now grows the keys' outline outward by a 0–1 fraction (was a band measured from the mouth), enclosed voids are dropped, and cut-ins under 8 mm auto-fill with no orb — checkpoint 2: partial fills trapped a void so the plate overhung the wall, and tiny cut-ins couldn't be adjusted.
- Pockets under 40 mm² (or without a clear opening) are now filled flush instead of skipped, and bodies whose hulls overlap are grouped into one case piece — checkpoint 2 again: slivers along the TKL's top edge and gaps beside a nearby dragged key could never be flattened. A 200-board random-edit test now proves every case can reach its fully flat outline.
- Case is now a solid body at top-face height with a recessed well only around the keys (was a 3 mm wall ring with the whole inside recessed) — checkpoint 2: filled pockets and key-sized gaps showed at plate height with stacked surfaces instead of continuing the top face.
- Pocket fill is now a straight wall parallel to the pocket's opening, slid by the orb (was outward growth from the keys) — checkpoint 2: in L-shaped pockets the growth met on a diagonal, giving a slanted wall the learner didn't expect.
- Untouched pockets now use the same straight wall (default amount sized like the old smoothing) instead of the rounded closing shape — checkpoint 2: the closing fill added after checkpoint 1 carved curved/diagonal fronts in L-shaped pockets; it had been the default for every untouched pocket since then.
- Case top edge is now six stacked inset slabs instead of ExtrudeGeometry's bevel — checkpoint 2 (orange paint): with a bevel, three.js triangulates the bevel-shifted contour, which crosses itself at the straight pocket walls' sharp corners and produced board-spanning slanted triangles on the top face; present since the straight walls arrived. Sliver islands under 90 mm² now join the well.
- Split the Layout step into Layout (pick a starting preset) and Shape (drag/add/delete keys, pocket orbs, resize); orbs and key dragging only active in Shape — learner's request at checkpoint 2.
- Merged Shape and Components into one Build step (Layout → Build → LEDs → Export); slices 5–6 put switch/keycap/knob options in the Build panel. Case top face stays orange — learner's choice.
- Presets grew from 7 to 19 in five categories (Standard, Ergonomic, Split columnar, Ortholinear, Small) — learner's request after checkpoint 2.
- 3D view renders on demand (frameloop="demand"), easing and the red pulse request frames only while running, dpr capped at 1.5, shadow map 1024 — learner's laptop was overheating from the constant 60 fps redraw. Also fixed keys snapping instead of easing (position prop overwrote the lerp each render).
- Untouched pockets now start flush (t = 1) and the closing-based default is gone — learner found the initial partly-filled shapes weird.
- Added a typing-angle slider (0–12°, default 6°) to the Layout step (learner moved it from Build); `board.tiltDeg` is saved, and older saves get 6° — learner's request after checkpoint 2.
