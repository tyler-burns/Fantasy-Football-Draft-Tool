// Pure filter -> sort pipeline over PoolPlayer[], replacing rows.ts's
// RankedPlayer-based version (deleted once components/pool/* lands in
// Sitting 2). Kept out of components so it's unit-testable without
// rendering anything.

import type { PoolPlayer } from '../ranking/pool'
import { matchesProjectionQuery } from '../search'

export interface RowFilters {
  readonly position: string | null // null = all positions
  readonly team: string | null // null = all teams
  readonly query: string // free-text filter, matched against name/team
}

export const DEFAULT_FILTERS: RowFilters = { position: null, team: null, query: '' }

export type PoolSort = 'adp' | 'vona' | 'par'
export const POOL_SORTS: readonly PoolSort[] = ['adp', 'vona', 'par']
export const DEFAULT_SORT: PoolSort = 'adp'

function matchesQuery(player: PoolPlayer, query: string): boolean {
  return matchesProjectionQuery(player.projection, query)
}

export function applyFilters(players: readonly PoolPlayer[], filters: RowFilters): PoolPlayer[] {
  return players.filter((p) => {
    if (filters.position !== null && p.position !== filters.position) return false
    if (filters.team !== null && p.projection.team !== filters.team) return false
    if (!matchesQuery(p, filters.query)) return false
    return true
  })
}

function sortValue(player: PoolPlayer, sort: PoolSort): number | null {
  switch (sort) {
    case 'adp':
      return player.adp
    case 'vona':
      return player.vona
    case 'par':
      return player.par
  }
}

/** Direction is implied by the sort, not user-selectable (the design has
 * three fixed buttons, not sortable headers): ADP ascending (lower = better
 * draft position), VONA/PAR descending (higher = better). Nulls always
 * sort last regardless of direction; ties broken by player_id ascending --
 * the same rule used everywhere else in the valuation/ranking pipeline. */
export function applySort(players: readonly PoolPlayer[], sort: PoolSort): PoolPlayer[] {
  const sign = sort === 'adp' ? 1 : -1
  return [...players].sort((a, b) => {
    const va = sortValue(a, sort)
    const vb = sortValue(b, sort)
    if (va === null && vb === null) return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
    if (va === null) return 1
    if (vb === null) return -1
    if (va !== vb) return sign * (va - vb)
    return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
  })
}

export function buildRows(players: readonly PoolPlayer[], filters: RowFilters, sort: PoolSort): PoolPlayer[] {
  return applySort(applyFilters(players, filters), sort)
}

/** Remaining-player counts per position within `players`, plus an '' key
 * for the total -- feeds the pool's ALL/QB/RB/WR/TE tabs with live counts. */
export function positionCounts(players: readonly PoolPlayer[]): Map<string, number> {
  const counts = new Map<string, number>([['', players.length]])
  for (const p of players) {
    counts.set(p.position, (counts.get(p.position) ?? 0) + 1)
  }
  return counts
}
