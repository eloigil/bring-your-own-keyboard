---
doc: prd
status: approved
---

# BYOKb — Product Requirements

A browser app where someone who wants a personal mechanical keyboard, but is intimidated by CAD, designs one as if it were a game, then downloads a printable case and matching firmware.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The user opens BYOKb and lands on a short **3D landing page** that explains the project, then enters the editor.
2. The **editor** opens with a default **tenkeyless (TKL)** keyboard in 3D. The left panel shows the steps; the right panel shows the options for the current step.
3. **Layout step:** they pick a starting preset.
3b. **Build step:** they drag the board's edge to resize it (60% ↔ full with numpad), grab single keys to move, add, or delete them, and drag pocket orbs. The case follows the outline of the keys live.
4. **Components step:** they set switches, keycaps, and the knob for the whole board, and double-click any element to override its config. They add a knob and drag it into place; neighboring keys snap aside.
5. **LEDs step:** they paint per-key colors and/or pick an animated effect, and see it lit in 3D.
6. **Export step:** they see their build and download the case STL and firmware (including the LED pattern).
7. Success: the downloaded STL opens in a slicer as their case shape, and the firmware matches their layout and lights.

## Screens and Layout

- **Landing page** — a small three.js scene that explains BYOKb, with a way into the editor.
- **Editor** — one screen with three regions:
  - **Center:** the 3D keyboard. The user can orbit around it and interact with keys and components.
  - **Left panel:** the step list: **Layout → Build → LEDs → Export**. The user can move between steps freely, back and forth.
  - **Right panel:** the options for the current step (presets, catalogs, colors, downloads).

## Look and Feel
- A simple, neutral environment like ShipShaper's for the MVP. Reference: ShipShaper.
- The overall goal is the Tiny Glade feel (simple actions, satisfying responses), not an engineering tool. Source: `scope.md > Inspiration & Identity`.
- No other visual preferences (fonts, palette) were established; the spec should take its cue from ShipShaper.

## Features and Behavior

### Layout Step
Source: `scope.md > The POC Boundary` items 1–2.
Covers two UI steps: **Layout** (presets only) and **Build** (everything else below: resize, key editing, pocket orbs).
- **Presets, in categories:** Standard (40%, 60%, 65%, 75%, TKL, 96%, Full), Ergonomic (Alice, Arisu, Row split), Split columnar (Corne, Lily58, Sofle, Kyria), Ortholinear (Planck, Preonic, Ortho pad), Small (Numpad, Macropad). Choosing one replaces the current layout. TKL is the default.
- **Board resize:** drag the board's edge to grow or shrink it.
- **Snap toggle:** in *autosnap* mode, resizing snaps to the standard sizes. In *freeform* mode, it stops anywhere, adding or removing keys.
- **Single-key editing:** select a key to move it, add a key, or delete a key.
- **Living case:** the case follows the outline of the keys (not a bounding rectangle) and updates live as keys change.
- **Typing angle slider:** in the Build step, 0–12° (default 6°). The case wedge and the keys follow it live, and the angle is saved with the design.
- **Pocket fill orbs:** wherever the case dips inward (a pocket, e.g. beside the arrows or the V of an Alice), a small orb sits in the pocket. Dragging it decides how deep the pocket goes: out to the edge fills it flush, inward opens it up. Untouched pockets start fully filled (flush), so every board starts as a clean solid shape.
- [ ] The editor opens with a TKL keyboard visible in 3D.
- [ ] Choosing the 60% preset visibly changes the board and its case to a 60% layout.
- [ ] Dragging the edge in autosnap mode lands only on standard sizes; in freeform it stops between them.
- [ ] Moving a key outward makes the case extend to cover it.
- [ ] Each pocket shows an orb; dragging it to the edge fills the pocket flush, dragging it inward deepens the pocket (e.g. a deleted corner key's notch can be opened fully).
- [ ] Gaps between key groups inside the board (Esc→F1, between F-key groups) are always filled.

### Components Step
Lives in the **Build** UI step, alongside the shape tools.
Source: `scope.md > The POC Boundary` items 3 and 6.
- **Whole-board config:** switches and keycaps apply to every key by default.
- **Per-element override:** double-click a key (or component) to give it its own config. Everything else keeps the board config.
- **Switches:** a catalog grouped by **brand → type → model**, as complete as possible (e.g. Cherry MX Red, Kailh Choc Brown). Switching between families with different spacing (MX vs. Choc) changes the layout spacing and the case.
- **Keycaps:** color and profile (e.g. Cherry, OEM, SA, DSA, XDA). The profile changes the keycap shape and row sculpt in 3D.
- **Knob (and other components):** add the component, drag it anywhere on the board, and neighboring keys auto-snap and rearrange to make room.
- [ ] Changing the board switch from Cherry MX Red to Kailh Choc Brown visibly changes the switches and tightens the layout/case.
- [ ] Changing the keycap profile visibly changes keycap shape.
- [ ] Double-clicking one key and changing its color affects only that key.
- [ ] Dragging the knob into the key area pushes neighboring keys aside, and the case reshapes.

### LEDs Step
Source: `scope.md > The POC Boundary` item 7.
- LEDs are **off until configured**.
- **Per-key painting:** set a color on individual keys.
- **Animated effects:** pick an effect (e.g. wave, breathing, reactive).
- Painting and effects can be combined.
- Once configured, the lights stay visible in every step.
- [ ] Before configuration, the board shows no lighting.
- [ ] Painting a key red shows that key lit red in 3D.
- [ ] Choosing an effect animates the lights in the preview.
- [ ] Going back to Layout still shows the configured lights.

### Export Step
Source: `scope.md > The POC Boundary` items 4–5.
- The user sees their build and the download buttons.
- **Case STL:** downloads a 3D-printable case matching the current outline and the switch family's plate cutouts.
- **Firmware:** downloads firmware matching the layout, including the LED pattern. The firmware target is decided in `4-spec`.
- Downloads only: no ordering, no account.
- [ ] The STL opens in a slicer or STL viewer and matches the on-screen case outline.
- [ ] The firmware download contains the user's key layout and LED configuration.
- [ ] With an overlapping key present, the downloads are disabled; fixing the overlap re-enables them.

## States and Boundaries
- **First use:** the editor opens with a default TKL, LEDs off, and the Layout step active.
- **Persistence:** the design survives a refresh or a closed tab, stored in the browser, with no backend. Clearing browser data loses it.
- **Invalid design:** overlapping keys, or a component on top of keys, glow or blink subtly in red. In Export, the download buttons are disabled with a note saying the design has problems to fix.
- **LEDs unconfigured:** no lights in the preview.

## Product Decisions
- The game-like design experience is the kernel. PCB tools already exist; none feel like a game.
- The editor opens on a TKL instead of an empty space or a picker, so the user can start playing immediately.
- Left panel = steps, right panel = options for the step.
- Layout is split in two: **Layout** only picks a starting preset (clean preview, no orbs, keys fixed), **Build** is the full build (drag/add/delete keys, pocket orbs, resize, and the components: switches, keycaps, knob) — picking a start and shaping are different activities, and the orbs no longer clutter later steps.
- Switches, keycaps, the knob, and other components share one Components step.
- A snap/freeform toggle exists because both kinds of editing are useful.
- The case follows the key outline, not a rectangle.
- Each pocket in the case gets its own draggable orb to set its depth (chosen over a single global control, accepting the extra complexity). Internal gaps are always filled.
- A whole-board config plus a double-click override per element.
- The switch catalog is as complete as possible, grouped by brand → type → model.
- LEDs support per-key painting and animated effects, off until configured, then visible in all steps.
- Export is downloads only. The firmware includes LEDs.
- The design persists if technically possible, with no full backend ("I don't want a full backend").
- Invalid parts are highlighted with a subtle red glow or blink, and downloads are blocked until they're fixed.
- The case's top face is orange (learner liked it while debugging; kept as the look).
- The environment is simple and neutral like ShipShaper's; customizing it comes later.

**Assumptions (not yet confirmed):**
- The landing page is short and explanatory, with no specific content defined. The build keeps it minimal.

## What We're Building
- A 3D landing page → editor
- The editor with Layout, Components, LEDs, and Export steps, as described above
- Presets, resize with the snap/freeform toggle, single-key editing, and the outline-following case
- A switch and keycap catalog with board-wide config and per-element override
- A knob component with snap-aside behavior
- LED painting and effects
- STL case and firmware downloads
- Browser-only persistence and invalid-design highlighting

## Deferred From the POC
- **PCB files and routing.** A separate project; the learner's idea is a fine-tuned LLM. Source: `scope.md > Later`.
- **A parts list (BOM) with purchase links, and affiliate revenue.** Not needed to prove the kernel.
- **Starting from a text description, and hand photo → layout.** Alternative entry points; presets cover the PoC.
- **Accounts, cloud saves, and sharing.** Would require a backend.
- **Environment customization options.** The neutral environment is enough for the MVP.
- **Ordering, premium features, and assembled kits.**

## Possible Later Enhancements
- Multiple saved designs and a design gallery.
- Components beyond the knob (e.g. a screen or trackball).
- Customizable scene and environment themes.

## Non-Goals
- Not a CAD or PCB editor. No engineering UI.
- No backend or user accounts.
- No purchasing inside the app.

## Open Questions
- **Firmware target** (QMK, ZMK, VIA, …) and how the LED pattern is encoded. Technical; resolve in `4-spec`.
- **Source of the switch and keycap catalog data.** Resolve in `4-spec`.
- **Split boards:** how the case and firmware handle two halves. Resolve in `4-spec`.
