import * as THREE from 'three'

/** Fine grain for moulded plastic: value noise drawn once into a small repeating canvas, used as a bump map. */
function grain(size = 128, scale = 2.2): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  // a few octaves of hashed noise, tileable because the hash wraps on the canvas size
  const hash = (x: number, y: number) => {
    const n = Math.sin(((x % size) + 1) * 127.1 + ((y % size) + 1) * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5
      for (let o = 1; o <= 4; o++) {
        const s = o * scale
        v += amp * hash(Math.floor(x / s) * s, Math.floor(y / s) * s)
        amp *= 0.5
      }
      const g = Math.round(110 + v * 90)
      img.data.set([g, g, g, 255], (y * size + x) * 4)
    }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1)
  return tex
}

let plastic: THREE.CanvasTexture | null = null
/** Shared bump map for keycaps and the case (built on first use, in the browser only). */
export function plasticGrain(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  return (plastic ??= grain())
}
