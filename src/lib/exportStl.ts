import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { strToU8, zipSync } from 'fflate'
import type { Design } from '../types'
import { BOTTOM_T, PLATE_T, caseParts } from './case'
import { familyOf, switchById } from './catalog'
import { caseController, componentFootprint } from './layout'
import { COMPONENTS } from '../data/components'
import { caseColors } from '../scene/Case'

/** A geometry as a binary STL in millimetres, rotated so +Z is up and the front faces -Y, how slicers expect a part. */
function stl(geometry: THREE.BufferGeometry): Uint8Array {
  const g = geometry.clone().rotateX(Math.PI / 2) // world Y-up → Z-up
  const result = new STLExporter().parse(new THREE.Mesh(g), { binary: true }) as DataView
  g.dispose()
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
}

export interface CaseFiles { 'shell.stl': Uint8Array; 'plate.stl': Uint8Array; 'bottom.stl': Uint8Array; 'PRINTING.md': string }

/** The printable case: shell, plate and bottom as STLs plus printing and assembly notes. */
export function caseFiles(design: Design): CaseFiles | null {
  const family = familyOf(design.board.switchId)
  const footprints = [...design.keys, ...design.components.map(componentFootprint)]
  const ctrl = caseController(design.components)
  const parts = caseParts(footprints, family, design.pocketFills, design.board.tiltDeg, ctrl)
  if (!parts) return null
  const sw = switchById(design.board.switchId)
  const col = caseColors(design.board)
  const files: CaseFiles = {
    'shell.stl': stl(parts.shell),
    'plate.stl': stl(parts.plate),
    'bottom.stl': stl(parts.bottom),
    'PRINTING.md': `# BYOKb case — printing and assembly

Three parts, millimetres, each exported lying the way it prints. ${sw.brand} ${sw.model} (${family}) plate, ${design.board.tiltDeg}° typing angle.

| Part | Print | Notes |
|---|---|---|
| shell.stl | **upside down** (top face on the bed) | The case walls with the typing angle built in. The 2 mm ledge the plate rests on is a short overhang; enable supports only if your printer can't bridge 2 mm. |
| plate.stl | flat, as exported | ${PLATE_T[family]} mm switch plate with the cutouts${design.components.length ? ` and the holes for your parts (${design.components.map((c) => COMPONENTS[c.type].name.toLowerCase()).join(', ')})` : ''}. Print in a stiff material (PETG, ASA or PC) at 100 % infill. |
| bottom.stl | flat, as exported | ${BOTTOM_T} mm bottom plate, sits flush in the shell's rebate. |

## Colours from your design

- shell: top face ${col.top}${col.wall !== col.top ? `, walls ${col.wall} — one colour per print, so either print it in one, paint the top, or use a multi-material printer (change filament at the start of the rounded top edge)` : ''}
- plate: ${col.plate}
- bottom: ${col.bottom}

## Hardware

- ${parts.screws} × **M2 heat-set inserts** (Ø 3.2 mm hole, ~4–6 mm long) — press into the holes in the shell's underside.
- ${parts.screws} × **M2 × 6 mm screws** through the bottom plate into the inserts.
- Under the plate there is ${parts.cavity.toFixed(1)} mm of room for hand-wiring, the diodes and the LED strip.
${parts.port === null ? '- **No controller placed.** Add one in BYOKb (Build → Components → Controller) to get its mount and the USB opening in the shell; otherwise mount it yourself and cut the opening.'
  : parts.port === 'blocked' ? '- **The controller is too far from an edge**: there is no wall within reach of its USB end, so the shell has no USB opening. Move or rotate it in BYOKb so its USB end faces a nearby edge.'
  : `- **${ctrl!.board.name}:** ${ctrl!.board.holes ? '4 × M2 × 8 mm screws up through the bottom plate and its standoffs, M2 nuts on top' : 'sits in the low tray printed on the bottom plate, USB end towards the opening; a strip of double-sided tape or a dab of hot glue under it'}. The shell has a ${parts.port.w} × ${parts.port.h.toFixed(1)} mm ${ctrl!.board.usb} opening facing its USB end${parts.port.h < 6 ? ' — low-profile cases are thin, so use a cable with a slim plug or an angled adapter' : ''}.`}

## Assembly

1. Drop the plate onto the ledge inside the shell (it rests on 2 mm of wall all round). A dab of glue at the corners if it rattles.
2. Clip the switches into the plate from above, wire or fit the PCB from below.
3. Press the inserts into the shell, screw the bottom plate on.

The parts come straight from the design on screen; nothing here has been test-printed yet, so check the first print's plate fit (there is 0.15 mm of clearance) before printing a second.
`,
  }
  for (const g of [parts.shell, parts.plate, parts.bottom]) g.dispose()
  return files
}

/** All case files in one zip: byokb-case/shell.stl, plate.stl, bottom.stl, PRINTING.md */
export function caseZip(files: CaseFiles): Uint8Array {
  return zipSync({ 'byokb-case': { ...files, 'PRINTING.md': strToU8(files['PRINTING.md']) } })
}

/** Hand the browser a file to save. */
export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
