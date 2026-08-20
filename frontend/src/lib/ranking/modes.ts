// The ranking-mode abstraction spec Section 19.4 asks for, and that Phase 3's
// Python valuation/board.py docstring deliberately deferred to "whenever a
// ranking-mode abstraction exists." That's here now.

import type { PlayerProjection } from '../projections/types'
import type { PlayerValuation, ValuationBoard } from '../valuation/models'

export type RankingMode = 'points' | 'par' | 'vona' | 'adp_value' | 'overall_value'

export const RANKING_MODES: readonly RankingMode[] = ['points', 'par', 'vona', 'adp_value', 'overall_value']

export const RANKING_MODE_LABELS: Readonly<Record<RankingMode, string>> = {
  points: 'Proj Pts',
  par: 'PAR',
  vona: 'VONA',
  adp_value: 'ADP Value',
  overall_value: 'Overall Value',
}

export interface RankedPlayer {
  readonly player_id: string
  readonly position: string
  readonly points: number
  readonly par: number | null
  readonly vona: number | null
  readonly adp: number | null
  readonly adp_value: number | null
  readonly overall_value: number | null
  readonly value: number | null // the active mode's score -- the table's "Value" column
  readonly model_rank: number | null // full-pool rank under modelRankBasis(mode); basis for adp_value
  readonly overall_rank: number // 1-indexed, among the players passed in, under the active mode
  readonly position_rank: number // 1-indexed within position, under the active mode
  readonly projection: PlayerProjection
}

/** Section 19.4's "Overall Value", otherwise undefined by the spec: PAR plus
 * VONA. Both are already in fantasy points, so they add with no hidden
 * weighting; VONA is non-negative by construction (groups are sorted
 * descending) so a null VONA (last player at a position) contributes 0 --
 * nothing lost by waiting. A null PAR (no replacement level) propagates. */
export function computeOverallValue(par: number | null, vona: number | null): number | null {
  return par === null ? null : par + (vona ?? 0)
}

/** ADP Value cannot rank by itself (circular), so it falls back to VONA --
 * the app's primary live-draft metric and 19.4's default -- for every other
 * mode "model rank" is simply that mode's own rank. */
export function modelRankBasis(mode: RankingMode): Exclude<RankingMode, 'adp_value'> {
  return mode === 'adp_value' ? 'vona' : mode
}

function scoreForBasis(pv: PlayerValuation, basis: Exclude<RankingMode, 'adp_value'>): number | null {
  switch (basis) {
    case 'points':
      return pv.points
    case 'par':
      return pv.par
    case 'vona':
      return pv.vona
    case 'overall_value':
      return computeOverallValue(pv.par, pv.vona)
  }
}

/** Descending by score; null always sorts last regardless of direction;
 * ties broken by player_id ascending (same rule used throughout the
 * valuation port, so ordering is reproducible everywhere). */
function compareByScore(
  a: { player_id: string },
  b: { player_id: string },
  scoreA: number | null,
  scoreB: number | null,
): number {
  if (scoreA === null && scoreB === null) return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
  if (scoreA === null) return 1
  if (scoreB === null) return -1
  if (scoreA !== scoreB) return scoreB - scoreA
  return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
}

/** "Model rank" = this player's 1-indexed rank if the FULL pool (not the
 * shrinking available pool) were ranked by `basis`. Full-pool, not
 * available-pool, for the same reason replacement levels are full-pool
 * (board.ts): ranking against a shrinking pool would inflate ADP Value
 * monotonically as the draft progresses, since everyone's rank number drops
 * as players are drafted regardless of their actual standing. */
function computeFullPoolRanks(
  fullBoard: ValuationBoard,
  basis: Exclude<RankingMode, 'adp_value'>,
): Map<string, number> {
  const sorted = [...fullBoard.players].sort((a, b) =>
    compareByScore(a, b, scoreForBasis(a, basis), scoreForBasis(b, basis)),
  )
  const ranks = new Map<string, number>()
  sorted.forEach((pv, i) => ranks.set(pv.player_id, i + 1))
  return ranks
}

/** Section 20: ADP Value = ADP - model rank. Null ADP or undefined model
 * rank (player absent from the full pool -- shouldn't happen, but a
 * ScoredPlayer set built from a filtered projection list could) -> null,
 * rendered as "--" and sorted last, per spec's "core functionality must not
 * depend on it." */
export function computeAdpValue(adp: number | null, modelRank: number | null): number | null {
  if (adp === null || modelRank === null) return null
  return adp - modelRank
}

/** Ranks `board`'s players (typically the available pool) under `mode`,
 * attaching per-player value/rank fields. `fullBoard` supplies the
 * draft-invariant model rank (see above) -- pass the same board for both if
 * you want a pure full-pool ranking with no draft state involved. */
export function rankPlayers(
  board: ValuationBoard,
  fullBoard: ValuationBoard,
  mode: RankingMode,
  projectionsById: ReadonlyMap<string, PlayerProjection>,
): RankedPlayer[] {
  const basis = modelRankBasis(mode)
  const modelRanks = computeFullPoolRanks(fullBoard, basis)

  const withValues = board.players.map((pv) => {
    const projection = projectionsById.get(pv.player_id)
    if (!projection) throw new Error(`no projection found for player_id ${pv.player_id}`)

    const modelRank = modelRanks.get(pv.player_id) ?? null
    const adpValue = computeAdpValue(projection.adp, modelRank)
    const overallValue = computeOverallValue(pv.par, pv.vona)
    const value = mode === 'adp_value' ? adpValue : scoreForBasis(pv, basis)

    return { pv, projection, modelRank, adpValue, overallValue, value }
  })

  const overallSorted = [...withValues].sort((a, b) => compareByScore(a.pv, b.pv, a.value, b.value))
  const overallRanks = new Map<string, number>()
  overallSorted.forEach((entry, i) => overallRanks.set(entry.pv.player_id, i + 1))

  const byPosition = new Map<string, typeof withValues>()
  for (const entry of withValues) {
    const group = byPosition.get(entry.pv.position)
    if (group) group.push(entry)
    else byPosition.set(entry.pv.position, [entry])
  }
  const positionRanks = new Map<string, number>()
  for (const group of byPosition.values()) {
    const sorted = [...group].sort((a, b) => compareByScore(a.pv, b.pv, a.value, b.value))
    sorted.forEach((entry, i) => positionRanks.set(entry.pv.player_id, i + 1))
  }

  return withValues.map((entry) => ({
    player_id: entry.pv.player_id,
    position: entry.pv.position,
    points: entry.pv.points,
    par: entry.pv.par,
    vona: entry.pv.vona,
    adp: entry.projection.adp,
    adp_value: entry.adpValue,
    overall_value: entry.overallValue,
    value: entry.value,
    model_rank: entry.modelRank,
    overall_rank: overallRanks.get(entry.pv.player_id) ?? 0,
    position_rank: positionRanks.get(entry.pv.player_id) ?? 0,
    projection: entry.projection,
  }))
}
