// Port of src/fantasy_value/valuation/par.py.
//
// Use `??`, never `||`. A replacement level of 0 is legitimate (a position
// where the boundary player scores exactly zero). `levels.get(pos) || null`
// would silently convert that 0 to null and erase every PAR at that
// position.

import type { ScoredPlayer } from './models'

export function computePar(player: ScoredPlayer, replacementLevels: ReadonlyMap<string, number | null>): number | null {
  const level = replacementLevels.get(player.position) ?? null
  return level === null ? null : player.points - level
}

export function computeParById(
  pool: Iterable<ScoredPlayer>,
  replacementLevels: ReadonlyMap<string, number | null>,
): Map<string, number | null> {
  const result = new Map<string, number | null>()
  for (const p of pool) {
    result.set(p.player_id, computePar(p, replacementLevels))
  }
  return result
}
