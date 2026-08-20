// Pure text search over projections, shared by DraftSearch and the table's
// text filter so both normalize the same way.

import type { PlayerProjection } from './projections/types'

export function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matchesProjectionQuery(projection: PlayerProjection, query: string): boolean {
  if (!query) return true
  const needle = normalizeQuery(query)
  const haystacks = [projection.name, projection.team, projection.search_full_name]
  return haystacks.some((h) => h !== null && normalizeQuery(h).includes(needle))
}

export function searchProjections(
  players: readonly PlayerProjection[],
  query: string,
  limit = 8,
): PlayerProjection[] {
  if (!query.trim()) return []
  return players.filter((p) => matchesProjectionQuery(p, query)).slice(0, limit)
}
