// Port of src/fantasy_value/valuation/replacement.py.

import { dedicatedDemand, flexDemand, starterSlots, valuesPosition, type LeagueConfig } from './league'
import { compareRank, groupByPosition, intersects, type ScoredPlayer } from './models'

export interface StarterAllocation {
  readonly dedicated: ReadonlyMap<string, number>
  readonly flex: ReadonlyMap<string, number>
  readonly cutoff: ReadonlyMap<string, number>
  readonly flex_player_ids: readonly string[]
}

/** Two-pass greedy allocation (spec Section 15): dedicated slots first, then
 * pool leftover FLEX-eligible players across positions regardless of
 * position. Not part of the replacement-level swap contract -- exposed so
 * the "FLEX slots actually consumed" claim is directly testable. */
export function allocateStarters(pool: readonly ScoredPlayer[], league: LeagueConfig): StarterAllocation {
  const groups = groupByPosition(pool)

  const dedicated = new Map<string, number>()
  for (const [position, group] of groups) {
    dedicated.set(position, Math.min(dedicatedDemand(league, position), group.length))
  }

  const candidates: ScoredPlayer[] = []
  for (const [position, group] of groups) {
    const leftovers = group.slice(dedicated.get(position) ?? 0)
    for (const p of leftovers) {
      if (intersects(p.eligible_positions, league.flex_positions)) candidates.push(p)
    }
  }
  candidates.sort(compareRank)

  const chosen = candidates.slice(0, flexDemand(league))
  const flex = new Map<string, number>()
  for (const position of groups.keys()) flex.set(position, 0) // zero-init every group, not just chosen ones
  for (const p of chosen) {
    flex.set(p.position, (flex.get(p.position) ?? 0) + 1)
  }

  const cutoff = new Map<string, number>()
  for (const position of groups.keys()) {
    cutoff.set(position, (dedicated.get(position) ?? 0) + (flex.get(position) ?? 0))
  }

  return { dedicated, flex, cutoff, flex_player_ids: chosen.map((p) => p.player_id) }
}

/** Replacement level per position = the first unallocated player after that
 * position's dedicated+FLEX cutoff, or null if the position has no
 * configured demand or the pool is exhausted at the cutoff. Pure; does not
 * mutate or retain `pool`. */
export function computeReplacementLevels(
  pool: readonly ScoredPlayer[],
  league: LeagueConfig,
): Map<string, number | null> {
  const groups = groupByPosition(pool)
  const allocation = allocateStarters(pool, league)

  const positions = new Set<string>([...groups.keys(), ...starterSlots(league).keys()])
  const levels = new Map<string, number | null>()
  for (const position of positions) {
    if (!valuesPosition(league, position)) {
      levels.set(position, null)
      continue
    }
    const group = groups.get(position) ?? []
    const cut = allocation.cutoff.get(position) ?? 0
    const boundary = group[cut] // ScoredPlayer | undefined (noUncheckedIndexedAccess)
    levels.set(position, boundary ? boundary.points : null)
  }
  return levels
}

export type ReplacementLevelFn = (
  pool: readonly ScoredPlayer[],
  league: LeagueConfig,
) => Map<string, number | null>
