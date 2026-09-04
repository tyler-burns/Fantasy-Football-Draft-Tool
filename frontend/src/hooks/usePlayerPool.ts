import { useMemo } from 'react'
import { PLACEHOLDER_NAME, parsePlaceholderPickId } from '../lib/draft/placeholder'
import { draftShape, nextPickIndexForSlot, slotForPick, totalPicks } from '../lib/draft/snake'
import type { BoardPlayer } from '../lib/draft/view'
import type { PlayerProjection } from '../lib/projections/types'
import { buildPoolPlayers, computeDynamicVona, computePositionRanks, excludeIgnored, type PoolPlayer } from '../lib/ranking/pool'
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
  ignoredSet: ReadonlySet<string>,
  draftedSet: ReadonlySet<string>,
  clockIndex: number,
  filters: RowFilters,
  sort: PoolSort,
  availableOnly: boolean,
) {
  // Unfiltered: DraftSearch and the Board need to resolve EVERY real
  // player, including ignored ones (a real draft can still take them).
  const projectionsById = useMemo(() => new Map(players.map((p) => [p.player_id, p])), [players])

  // Ignored players (injury/suspension the projection source hasn't caught
  // up with) are dropped before scoring ever sees them -- they never
  // consume a replacement-level slot, anchor anyone's VONA, or get a PAR of
  // their own. lib/valuation/adapter.ts stays untouched; this filter lives
  // entirely outside the Python-ported boundary, same as the K/DST
  // placeholder mechanism.
  const valuablePlayers = useMemo(() => excludeIgnored(players, ignoredSet), [players, ignoredSet])
  const scored = useMemo(() => toScoredPlayers(valuablePlayers, scoringConfig), [valuablePlayers, scoringConfig])

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

  // The pick VONA is measured against: not "my" next turn specifically, but
  // the next turn of whoever is CURRENTLY on the clock -- so the column
  // reads as "was this a good pick for them" for every team's turn, not
  // just mine. See lib/draft/snake.ts's nextPickIndexForSlot and
  // lib/ranking/pool.ts's computeDynamicVona.
  const currentPickerSlot = useMemo(() => slotForPick(clockIndex, league.teams) + 1, [clockIndex, league.teams])
  const nextPick = useMemo(
    () => nextPickIndexForSlot(clockIndex, league.teams, currentPickerSlot, totalPicks(draftShape(league))),
    [clockIndex, league, currentPickerSlot],
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

  const valuedById = useMemo(() => new Map(fullBoard.players.map((pv) => [pv.player_id, pv])), [fullBoard])

  // Built from EVERY real player (not just the valued ones fullBoard.players
  // carries), so an ignored player who still gets drafted for real -- or
  // just sits on someone's roster after being flagged post-pick -- renders
  // with their real name/team on the Board and My Roster instead of going
  // blank. Only points/position_rank are meaningless for one (always 0,
  // since they never entered the scored pool); isIgnored tells the Board
  // cell to skip those fields the same way it already does for a
  // placeholder.
  const boardPlayersById = useMemo(() => {
    const map = new Map<string, BoardPlayer>()
    for (const projection of players) {
      const valued = valuedById.get(projection.player_id)
      map.set(projection.player_id, {
        player_id: projection.player_id,
        name: projection.name,
        team: projection.team,
        position: valued?.position ?? projection.position ?? projection.fantasy_positions[0] ?? 'FLEX',
        position_rank: positionRanks.get(projection.player_id) ?? 0,
        points: valued?.points ?? 0,
        adp: projection.adp,
        isPlaceholder: false,
        isIgnored: ignoredSet.has(projection.player_id),
      })
    }
    // K/DST placeholders (lib/draft/placeholder.ts) never have a real
    // projection at all -- there's no player_id to iterate above -- so they
    // need a synthetic entry here to render as anything but a blank cell.
    for (const id of draftedSet) {
      const position = parsePlaceholderPickId(id)
      if (!position) continue
      map.set(id, {
        player_id: id,
        name: PLACEHOLDER_NAME[position],
        team: null,
        position,
        position_rank: 0,
        points: 0,
        adp: null,
        isPlaceholder: true,
        isIgnored: false,
      })
    }
    return map
  }, [players, valuedById, positionRanks, ignoredSet, draftedSet])

  return { fullBoard, rows, positionCounts, boardPlayersById, poolPlayersById, projectionsById }
}
