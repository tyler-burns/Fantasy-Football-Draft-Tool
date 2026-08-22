// The projection source carries no per-player K/DST data (see
// docs/frontend.md), so kickers and defenses can never be real pool rows --
// there's nothing to search, value, or click. A real draft can still take
// one at any pick, though, and every downstream derivation (snake order,
// My Roster, VONA's pick-distance math) depends on the overall PICK COUNT
// staying accurate. These placeholder ids exist so a K/DST pick can be
// logged -- advancing the count and rendering a labeled Board cell -- without
// ever entering the scored pool or the Player pool.

export type PlaceholderPosition = 'K' | 'DST'

const PREFIX = 'placeholder:'

/** Unique per pick (embeds the pick index) because a real draft has one
 * K and one DST taken by EVERY team -- reusing a fixed id per position
 * would collide with the draft reducer's own-id dedupe after the second
 * team's kicker. */
export function makePlaceholderPickId(position: PlaceholderPosition, pickIndex: number): string {
  return `${PREFIX}${position}:${pickIndex}`
}

export function parsePlaceholderPickId(id: string): PlaceholderPosition | null {
  if (!id.startsWith(PREFIX)) return null
  const rest = id.slice(PREFIX.length)
  if (rest.startsWith('K:')) return 'K'
  if (rest.startsWith('DST:')) return 'DST'
  return null
}

export const PLACEHOLDER_NAME: Readonly<Record<PlaceholderPosition, string>> = {
  K: 'Kicker',
  DST: 'Defense/ST',
}
