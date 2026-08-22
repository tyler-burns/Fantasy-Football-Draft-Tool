import { describe, expect, it } from 'vitest'
import { DEFAULT_LEAGUE } from '../valuation/league'
import {
  draftShape,
  isMyPick,
  myPickIndexes,
  nextMyPickIndex,
  overallLabel,
  pickLabel,
  roundForPick,
  roundsFor,
  slotForPick,
  teamLabel,
  totalPicks,
} from './snake'

describe('roundsFor', () => {
  it('sums every roster slot field', () => {
    // 1 + 2 + 2 + 1 + 2 + 1 + 1 + 6 = 16
    expect(roundsFor(DEFAULT_LEAGUE)).toBe(16)
  })

  it('reflects a changed slot', () => {
    expect(roundsFor({ ...DEFAULT_LEAGUE, te_slots: 0 })).toBe(15)
  })

  it('an all-zero roster still returns 1, not 0', () => {
    const empty = {
      ...DEFAULT_LEAGUE,
      qb_slots: 0, rb_slots: 0, wr_slots: 0, te_slots: 0,
      flex_slots: 0, dst_slots: 0, k_slots: 0, bench_slots: 0,
    }
    expect(roundsFor(empty)).toBe(1)
  })
})

describe('draftShape / totalPicks', () => {
  it('composes teams and rounds', () => {
    const shape = draftShape({ ...DEFAULT_LEAGUE, te_slots: 0 })
    expect(shape).toEqual({ teams: 12, rounds: 15 })
    expect(totalPicks(shape)).toBe(180)
  })
})

describe('slotForPick — snake order', () => {
  it.each([12, 8, 14, 10])('teams=%i: round boundaries reverse direction', (teams) => {
    // Round 0 (even): left to right.
    expect(slotForPick(0, teams)).toBe(0)
    expect(slotForPick(teams - 1, teams)).toBe(teams - 1)
    // Round 1 (odd): right to left -- the first pick of round 2 goes to
    // the LAST team, not the first.
    expect(slotForPick(teams, teams)).toBe(teams - 1)
    expect(slotForPick(teams * 2 - 1, teams)).toBe(0)
    // Round 2 (even again): back to left-to-right.
    expect(slotForPick(teams * 2, teams)).toBe(0)
  })

  it('exact table for teams=12', () => {
    expect(slotForPick(0, 12)).toBe(0)
    expect(slotForPick(11, 12)).toBe(11)
    expect(slotForPick(12, 12)).toBe(11)
    expect(slotForPick(23, 12)).toBe(0)
    expect(slotForPick(24, 12)).toBe(0)
  })

  it('grid column identity: every cell in position k of a snake row belongs to team k', () => {
    // This is the property that makes a Grid column a stable "team column"
    // regardless of round parity.
    for (const teams of [8, 10, 12, 14]) {
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < teams; k++) {
          const pickIndex = r % 2 === 0 ? r * teams + k : r * teams + (teams - 1 - k)
          expect(slotForPick(pickIndex, teams)).toBe(k)
        }
      }
    }
  })
})

describe('roundForPick', () => {
  it('0-based round number', () => {
    expect(roundForPick(0, 12)).toBe(0)
    expect(roundForPick(11, 12)).toBe(0)
    expect(roundForPick(12, 12)).toBe(1)
  })
})

describe('pickLabel', () => {
  it('formats round.pick zero-padded to two digits', () => {
    expect(pickLabel(0, 12)).toBe('1.01')
    expect(pickLabel(13, 12)).toBe('2.02')
    expect(pickLabel(11, 12)).toBe('1.12')
  })
})

describe('overallLabel', () => {
  it('1-indexed overall pick number', () => {
    expect(overallLabel(0)).toBe('#1')
    expect(overallLabel(30)).toBe('#31')
  })
})

describe('isMyPick / myPickIndexes', () => {
  it('isMyPick matches slotForPick against mySlot-1', () => {
    for (let i = 0; i < 24; i++) {
      expect(isMyPick(i, 12, 4)).toBe(slotForPick(i, 12) === 3)
    }
  })

  it('myPickIndexes is exactly the set where isMyPick is true', () => {
    const indexes = myPickIndexes(180, 12, 4)
    for (let i = 0; i < 180; i++) {
      expect(indexes.includes(i)).toBe(isMyPick(i, 12, 4))
    }
    expect(indexes.length).toBe(15) // one per round
  })
})

describe('nextMyPickIndex', () => {
  it('skips the current pick even if it is mine, and finds the next one', () => {
    // 12 teams, mySlot=1 (slot 0): picks 0, 23, 24, 47, ...
    expect(nextMyPickIndex(0, 12, 1, 180)).toBe(23)
  })

  it('finds the very next mySlot pick when it is not currently my turn', () => {
    expect(nextMyPickIndex(5, 12, 1, 180)).toBe(23)
    expect(nextMyPickIndex(20, 12, 1, 180)).toBe(23)
  })

  it('is null once mySlot has no remaining pick', () => {
    // mySlot=1's last pick in a 180-pick, 12-team draft is index 168.
    expect(nextMyPickIndex(168, 12, 1, 180)).toBe(null)
    expect(nextMyPickIndex(179, 12, 1, 180)).toBe(null)
  })

  it('agrees with isMyPick/myPickIndexes for an exhaustive scan', () => {
    const totalPicksCount = 180
    for (const mySlot of [1, 4, 12]) {
      const owned = myPickIndexes(totalPicksCount, 12, mySlot)
      for (let clockIndex = -1; clockIndex < totalPicksCount; clockIndex++) {
        const expected = owned.find((i) => i > clockIndex) ?? null
        expect(nextMyPickIndex(clockIndex, 12, mySlot, totalPicksCount)).toBe(expected)
      }
    }
  })
})

describe('teamLabel', () => {
  it('"My Team" only at mySlot, "Team N" (1-indexed) elsewhere', () => {
    expect(teamLabel(3, 4)).toBe('My Team')
    expect(teamLabel(0, 4)).toBe('Team 1')
    expect(teamLabel(6, 4)).toBe('Team 7')
  })
})
