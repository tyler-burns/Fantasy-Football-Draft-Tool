import { useMemo } from 'react'
import { draftShape } from '../lib/draft/snake'
import {
  buildGridRows,
  buildListRounds,
  buildTeamColumns,
  clockState,
  type BoardInput,
  type BoardPlayer,
} from '../lib/draft/view'
import type { LeagueConfig } from '../lib/valuation/league'

/** Memoized wrapper over lib/draft/view.ts's pure derivations -- the Board
 * pane's single source of layout data for both Grid and List modes. */
export function useDraftBoard(
  picks: readonly string[],
  league: LeagueConfig,
  mySlot: number,
  playersById: ReadonlyMap<string, BoardPlayer>,
) {
  const shape = useMemo(() => draftShape(league), [league])

  const input: BoardInput = useMemo(
    () => ({ picks, shape, mySlot, playersById }),
    [picks, shape, mySlot, playersById],
  )

  const teamColumns = useMemo(() => buildTeamColumns(shape, mySlot), [shape, mySlot])
  const gridRows = useMemo(() => buildGridRows(input), [input])
  const listRounds = useMemo(() => buildListRounds(input), [input])
  const clock = useMemo(() => clockState(input), [input])

  return { shape, teamColumns, gridRows, listRounds, clock }
}
