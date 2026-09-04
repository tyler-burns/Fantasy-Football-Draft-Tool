import { describe, expect, it } from 'vitest'
import { draftShape, slotForPick, totalPicks } from './snake'
import {
  buildGridRows,
  buildListRounds,
  buildTeamColumns,
  clockState,
  overflowPickCount,
  type BoardInput,
  type BoardPlayer,
} from './view'
import { DEFAULT_LEAGUE } from '../valuation/league'

function player(id: string, position: string, posRank: number): BoardPlayer {
  return {
    player_id: id, name: `Player ${id}`, team: 'BUF', position, position_rank: posRank,
    points: 100, adp: 1, isPlaceholder: false, isIgnored: false,
  }
}

const SHAPE = { teams: 12, rounds: 3 }
const PLAYERS = new Map<string, BoardPlayer>([
  ['p0', player('p0', 'RB', 1)],
  ['p1', player('p1', 'WR', 1)],
])

function input(picks: readonly string[], overrides: Partial<BoardInput> = {}): BoardInput {
  return { picks, shape: SHAPE, mySlot: 4, playersById: PLAYERS, ...overrides }
}

describe('buildTeamColumns', () => {
  it('one column per team, "My Team" only at mySlot', () => {
    const cols = buildTeamColumns(SHAPE, 4)
    expect(cols.length).toBe(12)
    expect(cols[3]).toMatchObject({ slot: 3, slotLabel: 'SLOT 4', name: 'My Team', mine: true })
    expect(cols[0]).toMatchObject({ slot: 0, slotLabel: 'SLOT 1', name: 'Team 1', mine: false })
  })
})

describe('buildGridRows', () => {
  it('one row per round, `teams` cells per row', () => {
    const rows = buildGridRows(input([]))
    expect(rows.length).toBe(3)
    for (const row of rows) expect(row.cells.length).toBe(12)
  })

  it('grid column identity: slotForPick(cell.pickIndex) === column index k', () => {
    const rows = buildGridRows(input([]))
    rows.forEach((row) => {
      row.cells.forEach((cell, k) => {
        expect(slotForPick(cell.pickIndex, 12)).toBe(k)
      })
    })
  })

  it('round 2 (index 1) pick indices are strictly descending across the row', () => {
    const rows = buildGridRows(input([]))
    const round2 = rows[1]!.cells.map((c) => c.pickIndex)
    for (let i = 1; i < round2.length; i++) {
      expect(round2[i]!).toBeLessThan(round2[i - 1]!)
    }
  })

  it('exactly one cell is onClock when the draft is in progress', () => {
    const rows = buildGridRows(input(['p0', 'p1']))
    const onClockCells = rows.flatMap((r) => r.cells).filter((c) => c.onClock)
    expect(onClockCells.length).toBe(1)
    expect(onClockCells[0]!.pickIndex).toBe(2)
  })

  it('zero cells are onClock when the draft is complete', () => {
    const allPicks = Array.from({ length: totalPicks(SHAPE) }, (_, i) => `p${i % 2}`)
    const rows = buildGridRows(input(allPicks))
    const onClockCells = rows.flatMap((r) => r.cells).filter((c) => c.onClock)
    expect(onClockCells.length).toBe(0)
  })

  it('a filled cell carries its player; an unfilled cell is null', () => {
    const rows = buildGridRows(input(['p0']))
    expect(rows[0]!.cells[0]!.player?.player_id).toBe('p0')
    expect(rows[0]!.cells[1]!.player).toBeNull()
  })

  it('unknown player_id renders as an empty past pick, never throws', () => {
    const rows = buildGridRows(input(['ghost']))
    expect(() => rows).not.toThrow()
    expect(rows[0]!.cells[0]!.player).toBeNull()
    expect(rows[0]!.cells[0]!.onClock).toBe(false)
  })
})

describe('buildListRounds', () => {
  it('rows are in pick order (not slot/snake order)', () => {
    const rounds = buildListRounds(input([]))
    const round2Indexes = rounds[1]!.rows.map((r) => r.pickIndex)
    expect(round2Indexes).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])
  })

  it('label and logged count', () => {
    const rounds = buildListRounds(input(['p0', 'p1']))
    expect(rounds[0]!.label).toBe('Round 1')
    expect(rounds[0]!.logged).toBe(2)
    expect(rounds[1]!.logged).toBe(0)
  })

  it('each row carries overallLabel and teamName', () => {
    const rounds = buildListRounds(input([], { mySlot: 1 }))
    const firstRow = rounds[0]!.rows[0]!
    expect(firstRow.overallLabel).toBe('#1')
    expect(firstRow.teamName).toBe('My Team')
  })
})

describe('clockState', () => {
  it('pre-draft: round 1, first slot', () => {
    const state = clockState(input([], { mySlot: 1 }))
    expect(state).toMatchObject({ complete: false, pickIndex: 0, round: 1, slot: 0, label: 'R1 · My Team' })
  })

  it('label uses "My Team" or "Team N"', () => {
    const state = clockState(input([], { mySlot: 4 }))
    expect(state.label).toBe('R1 · Team 1')
  })

  it('complete when picks.length >= totalPicks', () => {
    const allPicks = Array.from({ length: totalPicks(SHAPE) }, (_, i) => `p${i % 2}`)
    const state = clockState(input(allPicks))
    expect(state.complete).toBe(true)
    expect(state.label).toBe('Draft complete')
  })
})

describe('overflowPickCount', () => {
  it('zero when within capacity', () => {
    expect(overflowPickCount(input(['p0', 'p1']))).toBe(0)
  })

  it('counts picks beyond a shrunken shape', () => {
    const smallShape = { teams: 12, rounds: 1 } // capacity 12
    const picks = Array.from({ length: 20 }, (_, i) => `p${i % 2}`)
    expect(overflowPickCount(input(picks, { shape: smallShape }))).toBe(8)
  })
})

describe('draftShape sanity with DEFAULT_LEAGUE', () => {
  it('matches roundsFor', () => {
    expect(draftShape(DEFAULT_LEAGUE).rounds).toBe(16)
  })
})
