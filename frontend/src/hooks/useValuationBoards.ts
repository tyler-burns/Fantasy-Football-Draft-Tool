import { useMemo } from 'react'
import type { PlayerProjection } from '../lib/projections/types'
import type { RankingMode } from '../lib/ranking/modes'
import { rankPlayers } from '../lib/ranking/modes'
import { toScoredPlayers } from '../lib/valuation/adapter'
import { buildBoard } from '../lib/valuation/board'
import type { LeagueConfig } from '../lib/valuation/league'
import type { ScoringConfig } from '../lib/scoring/types'
import { applyFilters, applySort, type RowFilters, type SortState } from '../lib/view/rows'

export type Availability = 'available' | 'drafted' | 'all'

/** The derived pipeline: score -> two boards -> ranked rows. A full
 * recompute over ~300 players is on the order of 10^4 elementary
 * operations, sub-millisecond in V8 -- rendering the table dominates. The
 * useMemo chain here is a correctness-of-identity convenience (so e.g.
 * typing in the filter box only re-runs the cheap last step), not a
 * performance necessity. */
export function useValuationBoards(
  players: readonly PlayerProjection[],
  scoringConfig: ScoringConfig,
  league: LeagueConfig,
  draftedSet: ReadonlySet<string>,
  rankingMode: RankingMode,
  filters: RowFilters,
  sort: SortState,
  availability: Availability,
) {
  const projectionsById = useMemo(() => new Map(players.map((p) => [p.player_id, p])), [players])

  const scored = useMemo(() => toScoredPlayers(players, scoringConfig), [players, scoringConfig])

  // Replacement levels are identical between these two boards (both are
  // computed from the same full `scored` pool -- see board.ts's docstring);
  // they differ only in which players are listed, which is what makes
  // fullBoard the draft-invariant basis for "model rank" (ranking/modes.ts)
  // and the only self-consistent source for a drafted player's PAR/VONA
  // ("what he was worth in the undrafted universe").
  const fullBoard = useMemo(() => buildBoard(scored, league), [scored, league])
  const availableBoard = useMemo(
    () => buildBoard(scored, league, { drafted: draftedSet }),
    [scored, league, draftedSet],
  )

  const rankedAvailable = useMemo(
    () => rankPlayers(availableBoard, fullBoard, rankingMode, projectionsById),
    [availableBoard, fullBoard, rankingMode, projectionsById],
  )
  const rankedDrafted = useMemo(
    () => rankPlayers(fullBoard, fullBoard, rankingMode, projectionsById).filter((p) => draftedSet.has(p.player_id)),
    [fullBoard, rankingMode, projectionsById, draftedSet],
  )

  const source = useMemo(() => {
    if (availability === 'available') return rankedAvailable
    if (availability === 'drafted') return rankedDrafted
    return [...rankedAvailable, ...rankedDrafted]
  }, [availability, rankedAvailable, rankedDrafted])

  const rows = useMemo(() => applySort(applyFilters(source, filters), sort), [source, filters, sort])

  return { fullBoard, availableBoard, rankedAvailable, rankedDrafted, rows, projectionsById }
}
