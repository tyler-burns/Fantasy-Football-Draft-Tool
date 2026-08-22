import { useMemo } from 'react'
import { draftShape, nextMyPickIndex, totalPicks } from '../lib/draft/snake'
import type { BoardPlayer } from '../lib/draft/view'
import type { PlayerProjection } from '../lib/projections/types'
import { buildPoolPlayers, computeDynamicVona, computePositionRanks, type PoolPlayer } from '../lib/ranking/pool'
import { toScoredPlayers } from '../lib/valuation/adapter'
import { buildBoard } from '../lib/valuation/board'
import type { LeagueConfig } from '../lib/valuation/league'
import type { ScoringConfig } from '../lib/scoring/types'
import { applyFilters, applySort, positionCounts as computePositionCounts, type PoolSort, type RowFilters } from '../lib/view/pool-rows'

/** The derived pipeline: score -> two boards -> pool players -> filtered
 * rows. A full recompute over ~300 players is on the order of 10^4
 * elementary operations, sub-millisecond in V8 -- rendering the table
 * dominates. The useMemo chain here is a correctness-of-identity
 * convenience (so e.g. typing in the filter box only re-runs the cheap
 * last step), not a performance necessity. */
export function usePlayerPool(
  players: readonly PlayerProjection[],
  scoringConfig: ScoringConfig,
  league: LeagueConfig,
  mySlot: number,
  draftedSet: ReadonlySet<string>,
  clockIndex: number,
  filters: RowFilters,
  sort: PoolSort,
  availableOnly: boolean,
) {
  const projectionsById = useMemo(() => new Map(players.map((p) => [p.player_id, p])), [players])

  const scored = useMemo(() => toScoredPlayers(players, scoringConfig), [players, scoringConfig])

  // Replacement levels are identical between these two boards (both derive
  // from the same full `scored` pool -- see valuation/board.ts's
  // docstring); they differ only in which players are listed. fullBoard is
  // also the draft-invariant basis for position ranks (lib/ranking/pool.ts)
  // and the source for drafted players' "what he was worth in the
  // undrafted universe" PAR/(dynamic) VONA.
  const fullBoard = useMemo(() => buildBoard(scored, league), [scored, league])
  const availableBoard = useMemo(
    () => buildBoard(scored, league, { drafted: draftedSet }),
    [scored, league, draftedSet],
  )

  const positionRanks = useMemo(() => computePositionRanks(fullBoard), [fullBoard])

  // The pick VONA is measured against: the caller's next turn, not the
  // current one -- see lib/draft/snake.ts's nextMyPickIndex and
  // lib/ranking/pool.ts's computeDynamicVona.
  const nextPick = useMemo(
    () => nextMyPickIndex(clockIndex, league.teams, mySlot, totalPicks(draftShape(league))),
    [clockIndex, league, mySlot],
  )

  const availableDynamicVona = useMemo(
    () => computeDynamicVona(availableBoard.players, projectionsById, nextPick),
    [availableBoard, projectionsById, nextPick],
  )
  // Drafted players' VONA, like their PAR, is shown as "what it would have
  // been in the undrafted universe" -- computed from the full board so a
  // drafted player's VONA doesn't reflect other players' absences.
  const fullDynamicVona = useMemo(
    () => computeDynamicVona(fullBoard.players, projectionsById, nextPick),
    [fullBoard, projectionsById, nextPick],
  )

  const availablePlayers = useMemo(
    () => buildPoolPlayers(availableBoard, positionRanks, availableDynamicVona, clockIndex, projectionsById),
    [availableBoard, positionRanks, availableDynamicVona, clockIndex, projectionsById],
  )
  const draftedPlayers = useMemo(() => {
    const draftedInFullBoard = fullBoard.players.filter((pv) => draftedSet.has(pv.player_id))
    return buildPoolPlayers(
      { replacement_levels: fullBoard.replacement_levels, players: draftedInFullBoard },
      positionRanks,
      fullDynamicVona,
      clockIndex,
      projectionsById,
    )
  }, [fullBoard, draftedSet, positionRanks, fullDynamicVona, clockIndex, projectionsById])

  const poolSource: readonly PoolPlayer[] = useMemo(
    () => (availableOnly ? availablePlayers : [...availablePlayers, ...draftedPlayers]),
    [availableOnly, availablePlayers, draftedPlayers],
  )

  const rows = useMemo(() => applySort(applyFilters(poolSource, filters), sort), [poolSource, filters, sort])

  const positionCounts = useMemo(() => computePositionCounts(availablePlayers), [availablePlayers])

  // Independent of availableOnly/filters/sort, so the detail panel can still
  // resolve a selected player after a filter change hides their row.
  const poolPlayersById = useMemo(() => {
    const map = new Map<string, PoolPlayer>()
    for (const p of availablePlayers) map.set(p.player_id, p)
    for (const p of draftedPlayers) map.set(p.player_id, p)
    return map
  }, [availablePlayers, draftedPlayers])

  const boardPlayersById = useMemo(() => {
    const map = new Map<string, BoardPlayer>()
    for (const pv of fullBoard.players) {
      const projection = projectionsById.get(pv.player_id)
      map.set(pv.player_id, {
        player_id: pv.player_id,
        name: projection?.name ?? null,
        team: projection?.team ?? null,
        position: pv.position,
        position_rank: positionRanks.get(pv.player_id) ?? 0,
        points: pv.points,
        adp: projection?.adp ?? null,
      })
    }
    return map
  }, [fullBoard, positionRanks, projectionsById])

  return { fullBoard, rows, positionCounts, boardPlayersById, poolPlayersById, projectionsById }
}
