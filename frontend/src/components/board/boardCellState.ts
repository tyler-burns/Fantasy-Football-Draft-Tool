import type { BoardCell } from '../../lib/draft/view'

export type CellState = 'clock' | 'mine' | undefined

/** Empty cells get a data-state so CSS can distinguish "on the clock" from
 * "one of my future picks" from plain filler; filled cells carry data-pos
 * instead (set by the caller) and never need this. */
export function cellState(cell: BoardCell): CellState {
  if (cell.player) return undefined
  if (cell.onClock) return 'clock'
  if (cell.mine) return 'mine'
  return undefined
}
