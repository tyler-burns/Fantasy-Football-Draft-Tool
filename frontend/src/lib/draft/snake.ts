// Snake-draft order derivations. Pure functions -- the underlying draft
// state is still just `draftedIds: readonly string[]` (ordered = overall
// pick order); everything about which team owns a given pick is derived
// from its index, never stored.
//
// Convention: `mySlot` is 1-based at every function boundary in this module
// (matching the design handoff's own "My draft slot #1..#N" UI and the
// design's own `s.mySlot - 1` comparisons). Slot indices this module
// RETURNS (from slotForPick) are 0-based. The 1-based/0-based conversion
// happens once, inside isMyPick/teamLabel -- never at call sites.

import type { LeagueConfig } from '../valuation/league'

const SLOT_COUNT_FIELDS = [
  'qb_slots',
  'rb_slots',
  'wr_slots',
  'te_slots',
  'flex_slots',
  'dst_slots',
  'k_slots',
  'bench_slots',
] as const satisfies readonly (keyof LeagueConfig)[]

export interface DraftShape {
  readonly teams: number
  readonly rounds: number
}

/** Sum of every roster slot (starters + FLEX + DST/K + bench) -- one round
 * per slot. Minimum 1: an all-zero roster still needs a defined shape so
 * downstream grid/list rendering never divides by (or loops) zero. */
export function roundsFor(league: LeagueConfig): number {
  const total = SLOT_COUNT_FIELDS.reduce((sum, field) => sum + league[field], 0)
  return Math.max(1, total)
}

export function draftShape(league: LeagueConfig): DraftShape {
  return { teams: league.teams, rounds: roundsFor(league) }
}

export function totalPicks(shape: DraftShape): number {
  return shape.teams * shape.rounds
}

/** 0-based team slot that owns overall pick `pickIndex` (0-based), under
 * standard snake order: even rounds go left-to-right, odd rounds reverse. */
export function slotForPick(pickIndex: number, teams: number): number {
  const round = Math.floor(pickIndex / teams)
  const inRound = pickIndex % teams
  return round % 2 === 0 ? inRound : teams - 1 - inRound
}

export function roundForPick(pickIndex: number, teams: number): number {
  return Math.floor(pickIndex / teams)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "1.04" -- 1-indexed round, 1-indexed pick-within-round, zero-padded. */
export function pickLabel(pickIndex: number, teams: number): string {
  const round = roundForPick(pickIndex, teams)
  const inRound = pickIndex % teams
  return `${round + 1}.${pad2(inRound + 1)}`
}

/** "#31" -- 1-indexed overall pick number. */
export function overallLabel(pickIndex: number): string {
  return `#${pickIndex + 1}`
}

export function isMyPick(pickIndex: number, teams: number, mySlot: number): boolean {
  return slotForPick(pickIndex, teams) === mySlot - 1
}

/** Every overall pick index (0-based, in draft order) owned by `mySlot`,
 * across the first `pickCount` picks. */
export function myPickIndexes(pickCount: number, teams: number, mySlot: number): number[] {
  const indexes: number[] = []
  for (let i = 0; i < pickCount; i++) {
    if (isMyPick(i, teams, mySlot)) indexes.push(i)
  }
  return indexes
}

/** "My Team" for the slot matching mySlot, else "Team N" (1-indexed). */
export function teamLabel(slot: number, mySlot: number): string {
  return slot === mySlot - 1 ? 'My Team' : `Team ${slot + 1}`
}

/** The next overall pick index (0-based) owned by `mySlot`, strictly after
 * `clockIndex` -- never `clockIndex` itself, even if it's currently my pick.
 * Answers "if I pass on a player right now, how long until I get another
 * shot," which is a different question than "is it my turn." Null once no
 * such pick remains (mySlot has already made every pick it's going to, or
 * `totalPicksCount` is 0). */
export function nextMyPickIndex(clockIndex: number, teams: number, mySlot: number, totalPicksCount: number): number | null {
  for (let i = clockIndex + 1; i < totalPicksCount; i++) {
    if (isMyPick(i, teams, mySlot)) return i
  }
  return null
}
