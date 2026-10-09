// Brand logos dropped into src/assets/brands/<brand>.svg|png are picked up at build time (no 404s for missing ones).
const LOGOS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/brands/*.{svg,png}', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.split('/').pop()!.replace(/\.(svg|png)$/, ''),
    url as string,
  ]),
)

/** Kailh Box and Kailh Choc are the same maker. */
export const brandOf = (w: { brand: string }) => w.brand.replace(/ Choc$/, '')

/** The brand's logo, or its name as a wordmark when there's no logo file. Styled per brand via `brand-<name>`. */
export function BrandLogo({ brand }: { brand: string }) {
  const logo = LOGOS[brand.toLowerCase()]
  return (
    <span className={`brand-logo brand-${brand.toLowerCase()}`}>
      {logo ? <img src={logo} alt={brand} /> : <span className="wordmark">{brand}</span>}
    </span>
  )
}
