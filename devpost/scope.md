---
doc: scope
status: approved
---

# BYOKb — Build Your Own Keyboard

A web app where designing a custom mechanical keyboard feels like a video game, and the result is a file you can actually build from.

## The Unique Kernel
**Drag keys around and the keyboard's case reshapes itself to fit them.** Tools for designing PCBs and keyboards already exist, "just none that do it in a videogame-like experience." BYOKb is the Tiny Glade of keyboards: simple actions, satisfying responses, no CAD.

## Who It's For
Someone who wants a truly personal mechanical keyboard but is intimidated by the DIY toolchain. Today they either buy off-the-shelf or face CAD software, PCB editors, and hand-wiring guides.

## The Core Loop
1. Pick a starting preset: 60%, 75%, tenkeyless, split, or ortholinear.
2. Drag keys, add keys, or move them, and watch the 3D case adapt live.
3. Pick switches and keycaps.
4. Add components: a knob, and backplate LEDs with designed lighting patterns.
5. Export what's needed to build it.
They come back to tweak and try new shapes, because playing with the layout is the fun part.

## Inspiration & Identity
- Tiny Glade — https://tinyglade.com — drag a wall and it builds itself.
- ShipShaper — a playful, tactile builder.
It should feel like a game: pleasant, responsive, satisfying. Not like an engineering tool.

## Why This Matters to the Learner
They want BYOKb to be a real, working thing, and they want to get better at running longer agent-driven build loops while building it. They have about 20 days before the deadline. They've already designed simple PCBs with help from LLMs.

## What "Working" Looks Like
"A full flow to design a full keyboard through a pleasant experience, and then being able to physically build it."
Demo beat: pick a preset → drag keys and watch the case morph around them in 3D → choose switches and keycaps → add a knob and paint an LED pattern → click export and get a printable case file plus firmware config.

## The POC Boundary
Build these in this order. The kernel comes first; knob and LEDs come last.
1. Interactive 3D keyboard that you can drag keys on, with the case adapting live (the kernel)
2. Presets: 60%, 75%, TKL, split, ortholinear
3. Pick switches and keycaps (switch type, e.g. MX vs low-profile, affects plate cutouts and case height)
4. Export the case as an STL for 3D printing
5. Export a firmware config (e.g. a QMK keyboard definition and keymap)
6. Add a rotary knob as a component
7. A backplate LED pattern designer

## Later
- Generating PCB files a fab will accept (routed KiCad + Gerbers). The learner thinks a fine-tuned LLM could handle routing; that's a separate project.
- A parts list (BOM) with purchase links, and affiliate revenue
- Starting from a plain-language description ("compact split ergonomic with a volume knob")
- A hand photo → ergonomic layout fitted to finger lengths
- Premium features, ordering, and white-glove assembled kits

## Explicitly Cut
Nothing is cut outright. Everything outside the PoC boundary is "maybe later" (learner's call).
