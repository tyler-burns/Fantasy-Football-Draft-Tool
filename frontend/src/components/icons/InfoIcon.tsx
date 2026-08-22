/** Small inline "i" glyph -- the pool row's detail-panel affordance. No icon
 * package (decision: one icon isn't worth a dependency). */
export function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="4.6" r="0.9" fill="currentColor" />
      <rect x="7.25" y="6.8" width="1.5" height="5" fill="currentColor" />
    </svg>
  )
}
