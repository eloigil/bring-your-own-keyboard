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

- [x] **4. Resize the whole board with snap or freeform** — CUT after it was built (see Revisions)
  Becomes usable: A handle on the board's right edge resizes it. In *snap* mode it jumps between standard sizes (60 → 65 → 75 → TKL → full). In *freeform* it adds or removes keys anywhere in between. A toggle in the Build options switches mode.
  Why now: Completes the Layout step on top of slice 3's editing.
  PRD ref: `prd.md > Layout Step` (Board resize, Snap toggle)
  Spec ref: `spec.md > Layout Logic (src/lib/layout.ts)`, `spec.md > Scene (src/scene/)`
  Build: `resizeBoard` in snap and free modes, `ResizeHandle.tsx`, the snap toggle in `ShapeOptions` (Shape step).
  Verify (mechanical): Tests confirm that snap mode always returns a preset width and that free mode removes keys past the width and fills to it.
  Learner check: Drag the edge with snap on (does it jump between known sizes?), then switch to freeform and stop halfway.
  Commit: `Add board resize with snap and freeform modes`

- [x] **5. Choose switches and keycaps, board-wide or per key**
  Becomes usable: The Components step: a switch catalog grouped brand → type → model and keycap color and profile, applied board-wide. Double-click any key to override it. Switching MX ↔ Choc changes the spacing and the case.
  Why now: Switch family changes the geometry, so it must exist before export.
  PRD ref: `prd.md > Components Step`
  Spec ref: `spec.md > Catalog (src/data/switches.json, src/data/keycaps.ts)`, `spec.md > Scene (src/scene/)`, `spec.md > Case Geometry`
  Build: `switches.json` (best-effort, as complete as practical), keycap profile shapes in `keycaps.ts`/`Keycap.tsx`, `ComponentsOptions`, and an override panel on double-click.
  Verify (mechanical): Tests confirm every switch has a valid family, and that the Choc case outline is smaller than MX for the same layout. In the browser, changing one key's color after a double-click changes only that key.
  Learner check: Switch Cherry MX Red → Kailh Choc Brown and watch the board tighten, try SA vs DSA, double-click one key and make it a different color.
  Commit: `Add switch and keycap selection with per-key overrides`

- [x] **6. Add a knob that pushes keys aside**
  Becomes usable: Add a knob in Components and drag it anywhere. Keys in its rows shift right to make room, and the case grows around it.
  Why now: Depends on the Components step and slice 3's dragging.
  PRD ref: `prd.md > Components Step` (Knob)
  Spec ref: `spec.md > Layout Logic (src/lib/layout.ts)`, `spec.md > Scene (src/scene/)`
  Build: `Knob.tsx`, `addKnob`/`moveComponent`, `snapAside`, the knob included in the case outline and validation.
  Verify (mechanical): Tests confirm that after `snapAside` no key overlaps the knob, and keys in other rows are untouched.
  Learner check: Add a knob, drag it into the top row, and watch keys move aside and the case adapt.
  Commit: `Add draggable knob with snap-aside`

- [x] **7. Paint LEDs and pick effects**
  Becomes usable: The LEDs step: paint per-key colors and pick an effect (breathing, wave, reactive). The lights stay off until configured and remain visible in every step afterwards.
  Why now: The firmware export needs the LED data, so it comes before export.
  PRD ref: `prd.md > LEDs Step`
  Spec ref: `spec.md > Scene (src/scene/)`, `spec.md > Data Model`
  Build: `Leds.tsx` emissive underglow with `useFrame` animation, `LedOptions` with a color picker and effect list, and paint mode on click.
  Verify (mechanical): Tests confirm the "LEDs configured" rule (false by default; true after a paint or an effect). In the browser, the painted key renders lit (screenshot check).
  Learner check: Before touching LEDs, confirm the board is dark. Paint a few keys, pick wave, then go back to Layout and confirm the lights are still on.
  Commit: `Add LED painting and effects`

- [x] **8. Export a printable case and QMK firmware**
  Becomes usable: The Export step shows the build summary and two downloads: `byokb-case.stl` and `byokb-firmware.zip` (keyboard.json, keymap.c, README with a wiring table). Both are disabled with a message while anything is red.
  Why now: Completes the "physically buildable" half of the demo once every input to the files exists.
  PRD ref: `prd.md > Export Step`, `prd.md > States and Boundaries` (Invalid design)
  Spec ref: `spec.md > STL Export (src/lib/exportStl.ts)`, `spec.md > Firmware Export (src/lib/qmk.ts)`, `spec.md > Important Failure Modes`
  Build: `exportStl.ts`, `qmk.ts` (near-square matrix, Pico pins, rgb_matrix, encoder, painted colors, effect), fflate zip, `ExportOptions` with blocking.
  Verify (mechanical): Tests confirm that `qmk()` produces valid JSON whose layout key count equals the design's, that matrix pins plus the LED pin fit the Pico, and that the knob produces an encoder entry. The STL buffer is non-empty and parses back with three's `STLLoader`. Downloads are disabled when `validate` reports issues.
  Learner check: Export both files. Open the STL in a slicer or viewer (or https://www.viewstl.com) and compare it to the screen, then unzip the firmware and skim the README wiring table.
  Commit: `Add STL and QMK firmware export`

- [x] **8b. Switch lab: browse switches by feel and sound**
  Becomes usable: In Build → Switches, "Open switch lab" opens a large panel: search and filter the catalog; a detailed 3D switch (housing, stem, spring, pins) you can rotate, see through, and press with a slider; a force curve chart with the actuation point and tactile bump or click; feel stats (actuation, bottom-out, pre-travel, travel, bump); a sound profile (thocky/clacky/creamy/clicky/muted, pitch, loudness) with a synthesized ▶ Hear it; and materials. "Use this switch" applies it to the board.
  Why now: Learner's request before the landing page; switch choice is what keyboard builders care most about.
  PRD ref: `prd.md > Components Step` (Switch lab)
  Spec ref: `spec.md > Catalog (src/data/switches.json, src/data/keycaps.ts)`
  Build: extended switch data (forces, travel, bump/click, materials, sound), `forceCurve()` model, `SwitchModel` 3D component, Web Audio press sound, `SwitchLab` overlay.
  Verify (mechanical): Tests confirm every switch has complete feel and sound data, force curves rise to the bottom-out force, tactile and clicky curves have a bump before actuation, and linear curves don't. Build passes; the lab opens, filters, and applies a switch in the browser.
  Learner check: Open the switch lab, compare a linear, a tactile and a clicky switch (curve, press slider, ▶ Hear it), and apply one.
  Commit: `Add the switch lab`

- [ ] **9. Landing page leads into the editor** — DEFERRED by the learner (2026-10-12): the app opens straight into the editor; revisit after shipping if there's time.
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
- Freeform growth fills only the new strip past the old edge (not short rows like a TKL's Caps row); snap swaps in the preset, resetting custom edits — found while writing slice 4's tests.
- Per-key overrides open from the selected key (single click or double-click) in the Build panel instead of a double-click-only popup; per-key switches are limited to the board's family (MX and Choc need different plates); Choc boards get low-profile caps (0.55× height). Catalog lives in `src/lib/catalog.ts` + `src/data/switches.json` (52 switches).
- Knob keys slide aside on drop (pointer up), not continuously while dragging — continuous shifting would push keys further on every move. The knob counts as a 1u footprint for the case, well, plate cutout and overlap checks.
- LEDs render as an additive underglow halo plus the keycap's emissive (shared live colour per key) — a plain plane under the cap only showed as thin slivers. Effects run in a chosen colour (`board.ledColor`, wave is rainbow); reactive lights keys on hover. Only an active effect keeps the frame loop running.
- Board resize (slice 4) cut by the learner after it was built: handle, Snap/Freeform toggle, `resizeFree`/`snapSize` and their tests removed; presets and key editing cover sizing. The unused `board.snap` field was dropped from the data model (old saves keep it harmlessly).
- Added keycap transparency, switch housing colour, backlight-only LEDs (shine-through scales with transparency; solid caps block it) and a dark-mode toggle top-right — learner refinements after slice 7. The options panel moved down to make room for the toggle.
- Keycap transparency slider replaced by three real materials (Solid, Frosted, Clear) with their own opacity, gloss and light behaviour in `src/data/materials.ts` — learner asked for realistic transparency levels.
- Clear caps use a physical transmission material (refraction at ior 1.58, colour as attenuation tint, glossy clearcoat) with a code-built studio environment for reflections (kept faint on everything else) — the faked translucent material read like aerogel. Transmission adds a render pass, but only when the view redraws.
- Frosted caps now use the same transmission material as clear, with a rough surface and half transmission so the cap's own colour reads milky — the old faked translucency looked smoky grey in daylight.
- Second performance pass (laptop overheating with an LED effect + see-through caps): shadow map and contact shadow re-render only while the board shape changes instead of every frame; breathing/wave tick at 30 fps from one timer; transmission renders at half resolution. Each animated frame went from 4 scene renders to about 1.5.
- Added per-key size (width presets + custom, 1u/2u height) in Selected key; width changes slide the rest of the row (`resizeKey`) — learner request.
- Dragging now snaps magnetically: flush against a neighbour's edge / aligned to its row within 0.35u, else the 0.25u grid — learner found the plain grid landed keys slightly too close or too far.
- Export: firmware structure, keycodes, pin limits (every preset fits one Pico with knob + LEDs), zip contents and STL size/orientation are tested; the firmware has NOT been compiled with QMK here (toolchain not installed) — the README asks the builder to run `qmk lint` first. Unconfigured LEDs leave RGB out of the firmware entirely; layers 1/2 are generated transparent when Fn/Lower/Raise keys exist. The STL is the preview mesh (overlapping slabs, not a single welded shell); slicers merge it, but it hasn't been sliced here.
- Switch lab built: switch data extended (actuation/bottom-out force, pre/total travel, bump, sound profile/pitch/loudness, smoothness, materials, housing tint); `forceCurve()` models the curve from specs; sound is synthesized with Web Audio (noise burst + body tone per profile). All data and curves are approximate and labelled so; the sound couldn't be listened to during the build (no audio here).
- Switch lab list grouped by brand with official logos (6 fetched from brand websites with the learner's OK; Durock and Outemu had no official site reachable, so they show text wordmarks). Sources and trademark note in `src/assets/brands/README.md`.
- Build → Switches shows the selected switch as a card (SVG side view in its real colours, brand logo, model, type/force/sound) that opens the lab; the board-wide switch dropdown was removed as redundant (the per-key override picker stays).
- Switch lab 3D model rebuilt from each switch's construction instead of one shape for all: MX-style (cross stem, click jacket on clickies), Kailh Box (cross inside a box wall, click bar, sealed contacts) and Kailh Choc (low profile, twin-rail stem, blade pins). Tactile stems get bumped legs, silent switches dampers, 5-pin brands side posts; the plate, LED window and contact leaf are drawn on all — learner found every switch looked identical.
- Light/dark toggle plays a 3 s sunset/sunrise: the sun travels one continuous arc (overhead at noon, sets west, rises east), the room goes golden hour → dusk → moonlight, the backlight blinks on at nightfall, the panels cross-fade with the text flipping quickly past mid-grey. Only animates while moving — learner asked for a more satisfying transition.
- Landing page (slice 9) deferred by the learner; the app opens in the editor.
- Final checkpoint feedback (1/4): five new parts next to the knob — screen (OLED), trackball, joystick, touchpad, slider — each with its own footprint, plate cutout, 3D model and firmware wiring (`src/data/components.ts`). Bus parts claim fixed Pico pins (I²C GP4/5, SPI GP16–19), analog parts the ADC pins (GP26–28); the matrix avoids them. The firmware zip gains config.h / halconf.h / mcuconf.h / rules.mk when a bus is used. One Pico can't drive a TKL plus all five with LEDs (3 pins over); the export says so.
- Final checkpoint feedback (2/4): four more LED effects — rainbow, pinwheel, raindrops, ripple — mapped to QMK's cycle_all, pinwheel, raindrops and solid_reactive_wide.
- Final checkpoint feedback (3/4): per-key LED painting removed (the learner found painting single keys odd) — LEDs are now effect-only; `Key.led`, the brush, `paintKey`, `clearLeds` and the firmware's painted indicators are gone, and "LEDs configured" means an effect is chosen. The PRD's per-key painting line is superseded.
- Final checkpoint feedback (4/4): dropping a part that would bridge a split board's halves now slides the far half away until the pieces part again (`pushApart`, step-and-retest in 0.25u), so halves never fuse by accident. Case colour is a board setting (`board.caseColor`, swatches in Build → Shape it); the walls are a lighter tint of the top.
- Parts and keys can be rotated (chips / degrees field / `[` `]`) and nudged by 0.05u ≈ 1 mm with the arrow keys (Shift: ¼ u) without snapping — `rotate` and `nudge` store actions; a rotated part's bounding box drives the row shove. Learner request.
- Each part has its own colour (`Component.color`, defaults per type in `src/data/components.ts`): knob body, trackball, joystick cap, screen bezel, touchpad frame, fader cap — swatches in the Selected part section. Learner request.
- Case export reworked into a real three-part build (learner's final-checkpoint point 4): a shell (walls with the typing angle, a 2 mm ledge the plate rests on, a rebate the bottom drops into, M2 heat-set insert holes along the edge), a flat switch plate (1.5 mm MX / 1.3 mm Choc, cutouts for switches and parts, any enclosed deck pieces standing on it), and a flat 2 mm bottom plate with clearance holes. 9 mm (MX) under the plate for a PCB or hand-wiring. The zip carries the three STLs plus PRINTING.md (orientation, inserts, screws, assembly). The 3D view shows the same assembly. Solids are built as stacked cross-sections with zipped thin rings and a lofted top edge, so there are no buried faces; nothing has been test-printed.
- Graphics pass merged from the `graphics` branch: N8AO ambient occlusion (half resolution), bloom on the LEDs, ACES filmic tone mapping with 4× MSAA, and a procedural plastic-grain bump map on solid keycaps and the case. New deps: @react-three/postprocessing, postprocessing, n8ao. It adds GPU work to every rendered frame; idle frames still cost nothing.
- Case colour per part: top, sides, switch plate and bottom plate (`board.wallColor` / `plateColor` / `bottomColor`, unset = a lighter tint of the top). The 3D view renders the three printed parts as separate meshes (`caseAssembly`), and PRINTING.md lists the filament colour per part. Learner request.
- Improvement 1/5 — undo/redo: ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y) and two buttons top-right. `src/store/history.ts` watches the design store; changes within 500 ms merge into one step, so a drag, slider sweep or colour scrub undoes as a whole. 100 steps, not saved across reloads.
- Improvement 2/5 — controller and USB port: a **Controller** part (Raspberry Pi Pico, 1.25 × 3.25 u) shows through a window in the plate and stands on four bored M2 standoffs printed on the bottom plate. The shell gets a 12 mm USB opening through whichever wall its USB end faces (rotate the part to pick the wall), tunnelling up to 45 mm to reach the outside; 7.8 mm tall on MX, ~4 mm on Choc (slim plug needed). A controller with no wall in reach is flagged in the panel and in PRINTING.md. The firmware refuses two controllers.
- Controller size slider: Seeed XIAO RP2040 (17.8 × 21 mm, USB-C, 11 pins), Waveshare RP2040-Zero (18 × 23.5 mm, USB-C, 20 edge pins) and Raspberry Pi Pico (21 × 51 mm, micro-USB, 26 pins) in `CONTROLLERS` (sizes and pin maps from the Seeed and Waveshare wikis). Each sets the part's footprint and plate window, the USB opening's length and height, the mount (Pico on M2 standoffs; the two small boards, which have no holes, in a printed tray on a 2 mm pad so the plug clears the opening's floor), and the firmware's pins, I²C/SPI peripherals and flashing button. A TKL needs more pins than a XIAO has; the export says so. Learner request.
