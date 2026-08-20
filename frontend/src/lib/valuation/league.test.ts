import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEAGUE,
  FLEX_RB_WR,
  FLEX_RB_WR_TE,
  dedicatedDemand,
  flexDemand,
  makeLeagueConfig,
  starterSlots,
} from './league'

describe('DEFAULT_LEAGUE matches Section 14', () => {
  it('has the exact verbatim values', () => {
    expect(DEFAULT_LEAGUE.teams).toBe(12)
    expect(DEFAULT_LEAGUE.qb_slots).toBe(1)
    expect(DEFAULT_LEAGUE.rb_slots).toBe(2)
    expect(DEFAULT_LEAGUE.wr_slots).toBe(2)
    expect(DEFAULT_LEAGUE.te_slots).toBe(1)
    expect(DEFAULT_LEAGUE.flex_slots).toBe(2)
    expect(DEFAULT_LEAGUE.flex_positions).toEqual(FLEX_RB_WR_TE)
    expect(DEFAULT_LEAGUE.dst_slots).toBe(1)
    expect(DEFAULT_LEAGUE.k_slots).toBe(1)
    expect(DEFAULT_LEAGUE.bench_slots).toBe(6)
  })
})

describe('validation', () => {
  it.each([{ teams: 0 }, { teams: -1 }, { rb_slots: -1 }, { flex_slots: -1 }, { bench_slots: -1 }])(
    'rejects %o',
    (overrides) => {
      expect(() => makeLeagueConfig({ ...DEFAULT_LEAGUE, ...overrides })).toThrow()
    },
  )

  it('rejects non-integer slot counts', () => {
    expect(() => makeLeagueConfig({ ...DEFAULT_LEAGUE, rb_slots: 2.5 })).toThrow()
  })

  it('rejects flex_slots > 0 with empty flex_positions', () => {
    expect(() => makeLeagueConfig({ ...DEFAULT_LEAGUE, flex_slots: 2, flex_positions: new Set() })).toThrow()
  })

  it('normalizes flex_positions casing/whitespace', () => {
    const league = makeLeagueConfig({ ...DEFAULT_LEAGUE, flex_positions: new Set(['rb', ' wr ']) })
    expect(league.flex_positions).toEqual(new Set(['RB', 'WR']))
  })
})

describe('derived API', () => {
  it('starter_slots uses canonical tokens', () => {
    expect(starterSlots(DEFAULT_LEAGUE)).toEqual(new Map([['QB', 1], ['RB', 2], ['WR', 2], ['TE', 1], ['DEF', 1], ['K', 1]]))
  })

  it('dedicated and flex demand', () => {
    expect(dedicatedDemand(DEFAULT_LEAGUE, 'RB')).toBe(24)
    expect(flexDemand(DEFAULT_LEAGUE)).toBe(24)
    expect(dedicatedDemand(DEFAULT_LEAGUE, 'XX')).toBe(0)
  })

  it('the two Section 14.1 flex options', () => {
    expect(FLEX_RB_WR).toEqual(new Set(['RB', 'WR']))
    expect(FLEX_RB_WR_TE).toEqual(new Set(['RB', 'WR', 'TE']))
  })
})
