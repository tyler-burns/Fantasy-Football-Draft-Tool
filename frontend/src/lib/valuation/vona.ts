// Port of src/fantasy_value/valuation/vona.py.

import { groupByPosition, type ScoredPlayer } from './models'

/** Section 17: for each player, points minus the next-best available player
 * at the same position. The last player at a position gets null (undefined)
 * -- 0 stays reserved for a genuine tie, and VONA stays distinct from PAR
 * ("gap to replacement level"). */
export function computeVona(available: readonly ScoredPlayer[]): Map<string, number | null> {
  const groups = groupByPosition(available)
  const vona = new Map<string, number | null>()
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      const current = group[i]
      const next = group[i + 1]
      if (!current) continue
      vona.set(current.player_id, next ? current.points - next.points : null)
    }
  }
  return vona
}

export function bestAvailable(available: readonly ScoredPlayer[]): Map<string, ScoredPlayer> {
  const groups = groupByPosition(available)
  const best = new Map<string, ScoredPlayer>()
  for (const [position, group] of groups) {
    const top = group[0]
    if (top) best.set(position, top)
  }
  return best
}
