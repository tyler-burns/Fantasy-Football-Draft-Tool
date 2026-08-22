// Replaces the old 5-mode ranking abstraction (lib/ranking/modes.ts,
// deleted) with the design handoff's simpler, live-draft-specific
// semantics: Value = ADP - (current overall pick), and position rank is a
// stable, full-pool-computed number (so a drafted player's "RB12" chip
// never renumbers as the draft progresses).

import type { PlayerProjection } from '../projections/types'
import type { PlayerValuation, ValuationBoard } from '../valuation/models'

export interface PoolPlayer {
  readonly player_id: string
  readonly position: string
  readonly points: number
  readonly par: number | null
  readonly vona: number | null
  readonly adp: number | null
  readonly position_rank: number
  readonly draft_value: number | null
  readonly projection: PlayerProjection
}

export const VALUE_GOOD_THRESHOLD = 8
export const VALUE_BAD_THRESHOLD = -8

export type ValueTone = 'good' | 'bad' | 'neutral'

export function valueTone(value: number | null): ValueTone {
  if (value === null) return 'neutral'
  if (value >= VALUE_GOOD_THRESHOLD) return 'good'
  if (value <= VALUE_BAD_THRESHOLD) return 'bad'
  return 'neutral'
}

function comparePoints(a: PlayerValuation, b: PlayerValuation): number {
  if (a.points !== b.points) return b.points - a.points
  return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
}

/** Position rank computed over the FULL pool (not the active/available
 * board), by points, 1-indexed, ties broken by player_id ascending -- the
 * same stability property board.ts's replacement levels rely on: a drafted
 * player's rank must not renumber as other players come off the board. */
export function computePositionRanks(fullBoard: ValuationBoard): Map<string, number> {
  const byPosition = new Map<string, PlayerValuation[]>()
  for (const p of fullBoard.players) {
    const group = byPosition.get(p.position)
    if (group) group.push(p)
    else byPosition.set(p.position, [p])
  }

  const ranks = new Map<string, number>()
  for (const group of byPosition.values()) {
    const sorted = [...group].sort(comparePoints)
    sorted.forEach((p, i) => ranks.set(p.player_id, i + 1))
  }
  return ranks
}

/** Section 20-style ADP value, but tied to real draft progress rather than
 * a draft-invariant model rank: how many picks a player has fallen past (or
 * been taken ahead of) the pick currently on the clock. `clockIndex` is
 * 0-based (== draftedIds.length); the pick on the clock is `clockIndex + 1`
 * in 1-indexed ADP terms. */
export function computeDraftValue(adp: number | null, clockIndex: number): number | null {
  if (adp === null) return null
  return adp - (clockIndex + 1)
}

export function buildPoolPlayers(
  board: ValuationBoard,
  positionRanks: ReadonlyMap<string, number>,
  clockIndex: number,
  projectionsById: ReadonlyMap<string, PlayerProjection>,
): PoolPlayer[] {
  return board.players.map((pv) => {
    const projection = projectionsById.get(pv.player_id)
    if (!projection) throw new Error(`no projection found for player_id ${pv.player_id}`)

    return {
      player_id: pv.player_id,
      position: pv.position,
      points: pv.points,
      par: pv.par,
      vona: pv.vona,
      adp: projection.adp,
      position_rank: positionRanks.get(pv.player_id) ?? 0,
      draft_value: computeDraftValue(projection.adp, clockIndex),
      projection,
    }
  })
}
