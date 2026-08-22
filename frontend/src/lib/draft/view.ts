// Board rendering derivations (Grid + List modes), ported from the design
// handoff's renderVals() (Draft Room.dc.html). Deliberately carries only
// semantic state (position, onClock, mine), never colors -- the prototype
// returns CSS strings because it has no stylesheet; here that becomes
// data-pos/data-state attributes consumed by CSS, keeping the design system
// out of the test suite.

import type { DraftShape } from './snake'
import { overallLabel, pickLabel, roundsFor, slotForPick, teamLabel, totalPicks } from './snake'

export interface BoardPlayer {
  readonly player_id: string
  readonly name: string | null
  readonly team: string | null
  readonly position: string
  readonly position_rank: number
  readonly points: number
  readonly adp: number | null
  // True for a K/DST logged via lib/draft/placeholder.ts -- there's no real
  // per-player projection behind it, so cell rendering skips the fields
  // that would otherwise look like real (but meaningless: rank 0, 0 points)
  // data.
  readonly isPlaceholder: boolean
}

export interface BoardCell {
  readonly pickIndex: number
  readonly label: string // "1.04"
  readonly slot: number // 0-based
  readonly player: BoardPlayer | null
  readonly onClock: boolean
  readonly mine: boolean
}

export interface BoardGridRow {
  readonly round: number // 1-indexed
  readonly cells: BoardCell[]
}

export interface BoardListRow extends BoardCell {
  readonly overallLabel: string // "#31"
  readonly teamName: string
}

export interface BoardListRound {
  readonly round: number // 1-indexed
  readonly label: string // "Round 3"
  readonly logged: number
  readonly teams: number
  readonly rows: BoardListRow[]
}

export interface TeamColumn {
  readonly slot: number // 0-based
  readonly slotLabel: string // "SLOT 4"
  readonly name: string
  readonly mine: boolean
}

export interface ClockState {
  readonly complete: boolean
  readonly pickIndex: number
  readonly round: number // 1-indexed, only meaningful when !complete
  readonly slot: number // 0-based, only meaningful when !complete
  readonly teamName: string
  readonly label: string // "R3 · Team 7" | "R3 · My Team" | "Draft complete"
}

export interface BoardInput {
  readonly picks: readonly string[]
  readonly shape: DraftShape
  readonly mySlot: number
  readonly playersById: ReadonlyMap<string, BoardPlayer>
}

function cellFor(input: BoardInput, pickIndex: number): BoardCell {
  const { picks, shape, mySlot, playersById } = input
  const playerId = picks[pickIndex]
  const player = playerId === undefined ? null : (playersById.get(playerId) ?? null)
  const onClock = pickIndex === picks.length && pickIndex < totalPicks(shape)
  const slot = slotForPick(pickIndex, shape.teams)
  return {
    pickIndex,
    label: pickLabel(pickIndex, shape.teams),
    slot,
    player,
    onClock,
    mine: slot === mySlot - 1,
  }
}

export function buildTeamColumns(shape: DraftShape, mySlot: number): TeamColumn[] {
  const columns: TeamColumn[] = []
  for (let k = 0; k < shape.teams; k++) {
    columns.push({
      slot: k,
      slotLabel: `SLOT ${k + 1}`,
      name: teamLabel(k, mySlot),
      mine: k === mySlot - 1,
    })
  }
  return columns
}

export function buildGridRows(input: BoardInput): BoardGridRow[] {
  const { shape } = input
  const rows: BoardGridRow[] = []
  for (let r = 0; r < shape.rounds; r++) {
    const cells: BoardCell[] = []
    for (let k = 0; k < shape.teams; k++) {
      const pickIndex = r % 2 === 0 ? r * shape.teams + k : r * shape.teams + (shape.teams - 1 - k)
      cells.push(cellFor(input, pickIndex))
    }
    rows.push({ round: r + 1, cells })
  }
  return rows
}

export function buildListRounds(input: BoardInput): BoardListRound[] {
  const { shape, mySlot } = input
  const rounds: BoardListRound[] = []
  for (let r = 0; r < shape.rounds; r++) {
    const rows: BoardListRow[] = []
    for (let k = 0; k < shape.teams; k++) {
      const pickIndex = r * shape.teams + k
      const cell = cellFor(input, pickIndex)
      rows.push({
        ...cell,
        overallLabel: overallLabel(pickIndex),
        teamName: teamLabel(cell.slot, mySlot),
      })
    }
    rounds.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      logged: rows.filter((row) => row.player !== null).length,
      teams: shape.teams,
      rows,
    })
  }
  return rounds
}

export function clockState(input: BoardInput): ClockState {
  const { picks, shape, mySlot } = input
  const pickIndex = picks.length
  const complete = pickIndex >= totalPicks(shape)
  if (complete) {
    return { complete: true, pickIndex, round: 0, slot: 0, teamName: '', label: 'Draft complete' }
  }
  const round = Math.floor(pickIndex / shape.teams) + 1
  const slot = slotForPick(pickIndex, shape.teams)
  const teamName = teamLabel(slot, mySlot)
  return { complete: false, pickIndex, round, slot, teamName, label: `R${round} · ${teamName}` }
}

/** How many logged picks exceed the current draft shape's capacity -- e.g.
 * after shrinking roster slots mid-draft. Never throws; callers use this to
 * show a warning, not to truncate `picks` (which stays the source of truth). */
export function overflowPickCount(input: BoardInput): number {
  return Math.max(0, input.picks.length - totalPicks(input.shape))
}

// Re-exported for convenience so callers building a BoardInput don't need a
// separate import just for the rounds calculation.
export { roundsFor }
