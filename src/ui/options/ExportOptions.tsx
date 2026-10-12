import { useMemo } from 'react'
import type { LedEffect } from '../../types'
import { useDesign, ledsConfigured } from '../../store/design'
import { familyOf, switchById } from '../../lib/catalog'
import { profileById } from '../../data/keycaps'
import { KEYCAP_MATERIALS } from '../../data/materials'
import { validate } from '../../lib/validate'
import { caseFiles, caseZip, download } from '../../lib/exportStl'
import { firmwareZip, generateFirmware } from '../../lib/qmk'
import { COMPONENTS } from '../../data/components'

const EFFECT_NAMES: Record<LedEffect, string> = { none: 'off', breathing: 'breathing', wave: 'wave', rainbow: 'rainbow', pinwheel: 'pinwheel', raindrops: 'raindrops', reactive: 'reactive', ripple: 'ripple' }

export function ExportOptions() {
  const design = useDesign((s) => s.design)
  const preset = useDesign((s) => s.preset)
  const { board, keys, components } = design
  const problems = useMemo(() => validate(keys, components, familyOf(board.switchId)).size, [keys, components, board.switchId])
  const firmware = useMemo(() => generateFirmware(design), [design])
  const sw = switchById(board.switchId)
  const blocked = problems > 0 ? `${problems} keys or parts overlap (they pulse red). Fix them in Build to export.` : keys.length === 0 ? 'Add some keys first.' : null

  return (
    <>
      <section>
        <h3>Your build</h3>
        <dl className="summary">
          <dt>Layout</dt><dd>{preset ?? 'Custom'} · {keys.length} keys{components.map((c) => ` · ${COMPONENTS[c.type].name.toLowerCase()}`).join('')}</dd>
          <dt>Switches</dt><dd>{sw.brand} {sw.model}</dd>
          <dt>Keycaps</dt><dd>{profileById(board.profileId).name}, {KEYCAP_MATERIALS[board.keycapMaterial].name.toLowerCase()}</dd>
          <dt>Angle</dt><dd>{board.tiltDeg}°</dd>
          <dt>LEDs</dt><dd>{ledsConfigured(design) ? EFFECT_NAMES[board.ledEffect] : 'off'}</dd>
        </dl>
      </section>
      {blocked && <p className="blocked">{blocked}</p>}
      <section>
        <h3>Files</h3>
        <button
          className="tile wide download"
          disabled={!!blocked}
          onClick={() => {
            const files = caseFiles(design)
            if (files) download('byokb-case.zip', new Uint8Array(caseZip(files)), 'application/zip')
          }}
        >
          ⬇ Case for 3D printing (.zip)
        </button>
        <p className="muted">Three STLs that print flat without supports — shell, switch plate{components.length ? ' with the holes for your parts' : ''}, bottom plate — plus printing and assembly notes (M2 inserts and screws).</p>
        <button
          className="tile wide download"
          disabled={!!blocked || !firmware.ok}
          onClick={() => firmware.ok && download('byokb-firmware.zip', new Uint8Array(firmwareZip(firmware.firmware)), 'application/zip')}
        >
          ⬇ QMK firmware (.zip)
        </button>
        <p className="muted">
          {firmware.ok
            ? 'For a hand-wired Raspberry Pi Pico. The README inside has the wiring table and build steps.'
            : firmware.reason}
        </p>
      </section>
    </>
  )
}
