// Pure filter -> sort pipeline over RankedPlayer[]. Kept out of components so
// it's unit-testable without rendering anything (see docs/frontend.md's
// testing-strategy note).

import type { RankedPlayer } from '../ranking/modes'
import { matchesProjectionQuery } from '../search'

export interface RowFilters {
  readonly position: string | null // null = all positions
  readonly team: string | null // null = all teams
  readonly query: string // free-text filter, matched against name/team
}

export const DEFAULT_FILTERS: RowFilters = { position: null, team: null, query: '' }

export type SortColumn = 'overall_rank' | 'points' | 'par' | 'vona' | 'adp' | 'value'
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  readonly column: SortColumn
  readonly direction: SortDirection
}

export const DEFAULT_SORT: SortState = { column: 'overall_rank', direction: 'asc' }

function matchesQuery(player: RankedPlayer, query: string): boolean {
  return matchesProjectionQuery(player.projection, query)
}

export function applyFilters(players: readonly RankedPlayer[], filters: RowFilters): RankedPlayer[] {
  return players.filter((p) => {
    if (filters.position !== null && p.position !== filters.position) return false
    if (filters.team !== null && p.projection.team !== filters.team) return false
    if (!matchesQuery(p, filters.query)) return false
    return true
  })
}

function sortValue(player: RankedPlayer, column: SortColumn): number | null {
  switch (column) {
    case 'overall_rank':
      return player.overall_rank
    case 'points':
      return player.points
    case 'par':
      return player.par
    case 'vona':
      return player.vona
    case 'adp':
      return player.adp
    case 'value':
      return player.value
  }
}

/** Nulls always sort last, regardless of direction -- same rule as
 * everywhere else in the ranking/valuation pipeline. Ties broken by
 * player_id ascending, for reproducible ordering. */
export function applySort(players: readonly RankedPlayer[], sort: SortState): RankedPlayer[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...players].sort((a, b) => {
    const va = sortValue(a, sort.column)
    const vb = sortValue(b, sort.column)
    if (va === null && vb === null) return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
    if (va === null) return 1
    if (vb === null) return -1
    if (va !== vb) return sign * (va - vb)
    return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
  })
}

export function buildRows(players: readonly RankedPlayer[], filters: RowFilters, sort: SortState): RankedPlayer[] {
  return applySort(applyFilters(players, filters), sort)
}
