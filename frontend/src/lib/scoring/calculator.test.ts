import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from '../projections/types'
import { scoreBreakdown, scoreProjection } from './calculator'
import { HALF_PPR, PPR, STANDARD } from './presets'
import { assertValidScoringConfig, validateScoringConfig, type ScoringConfig } from './types'

function makeProj(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    player_id: '1',
    name: 'Test Player',
    first_name: 'Test',
    last_name: 'Player',
    team: 'BUF',
    position: 'QB',
    fantasy_positions: ['QB'],
    weeks_included: 17,
    pass_att: 0,
    pass_cmp: 0,
    pass_yds: 0,
    pass_tds: 0,
    pass_int: 0,
    rush_att: 0,
    rush_yds: 0,
    rush_tds: 0,
    receptions: 0,
    rec_yds: 0,
    rec_tds: 0,
    rec_tgt: 0,
    fumbles_lost: 0,
    games_proj: 0,
    adp: null,
    pos_adp: null,
    reference_pts_ppr: null,
    search_full_name: 'testplayer',
    ...overrides,
  }
}

function makeConfig(overrides: Partial<ScoringConfig> = {}): ScoringConfig {
  return { ...PPR, ...overrides }
}

describe('ScoringConfig validation', () => {
  it('accepts a valid config', () => {
    expect(validateScoringConfig(PPR)).toEqual([])
    expect(() => assertValidScoringConfig(PPR)).not.toThrow()
  })

  it.each(['pass_yds_per_point', 'rush_yds_per_point', 'rec_yds_per_point'] as const)(
    'rejects zero %s',
    (field) => {
      const config = makeConfig({ [field]: 0 })
      expect(validateScoringConfig(config).length).toBeGreaterThan(0)
      expect(() => assertValidScoringConfig(config)).toThrow()
    },
  )

  it.each(['pass_yds_per_point', 'rush_yds_per_point', 'rec_yds_per_point'] as const)(
    'rejects negative %s',
    (field) => {
      expect(validateScoringConfig(makeConfig({ [field]: -10 })).length).toBeGreaterThan(0)
    },
  )

  it.each([NaN, Infinity, -Infinity])('rejects non-finite weight %f', (bad) => {
    expect(validateScoringConfig(makeConfig({ pass_td_points: bad })).length).toBeGreaterThan(0)
  })

  it('allows negative per-event point values', () => {
    const config = makeConfig({ pass_int_points: -6, fumble_lost_points: -5 })
    expect(validateScoringConfig(config)).toEqual([])
  })
})

describe('worked examples from the spec', () => {
  it('Section 13.4: Josh Allen -> 344.0 exactly', () => {
    const proj = makeProj({ pass_yds: 4000, pass_tds: 28, pass_int: 10, rush_yds: 500, rush_tds: 7 })
    expect(scoreProjection(proj, PPR)).toBe(344.0)
  })

  it('Section 21.1: 4000/20/10 -> 220.0 exactly', () => {
    const proj = makeProj({ pass_yds: 4000, pass_tds: 20, pass_int: 10 })
    expect(scoreProjection(proj, PPR)).toBe(220.0)
  })
})

describe('PPR / Half PPR / Standard', () => {
  const receiving = { receptions: 100, rec_yds: 1200, rec_tds: 8 }

  it('PPR scores one point per reception -> 268', () => {
    expect(scoreProjection(makeProj(receiving), PPR)).toBe(268.0)
  })

  it('Half PPR scores half a point per reception -> 218', () => {
    expect(scoreProjection(makeProj(receiving), HALF_PPR)).toBe(218.0)
  })

  it('Standard scores no reception points -> 168', () => {
    expect(scoreProjection(makeProj(receiving), STANDARD)).toBe(168.0)
  })

  it('presets differ only by the reception term', () => {
    const proj = makeProj({ pass_yds: 3000, pass_tds: 20, pass_int: 8, rush_yds: 200, rush_tds: 2, fumbles_lost: 1, ...receiving })
    const ppr = scoreProjection(proj, PPR)
    const half = scoreProjection(proj, HALF_PPR)
    const std = scoreProjection(proj, STANDARD)
    expect(ppr - std).toBeCloseTo(proj.receptions * 1.0, 9)
    expect(half - std).toBeCloseTo(proj.receptions * 0.5, 9)
  })
})

describe('custom scoring', () => {
  it('scores a hand-built league end to end', () => {
    const config = makeConfig({
      pass_yds_per_point: 20,
      pass_td_points: 6,
      pass_int_points: -3,
      rush_yds_per_point: 9,
      rush_td_points: 6,
      reception_points: 0.75,
      rec_yds_per_point: 10,
      rec_td_points: 4,
      fumble_lost_points: -4,
    })
    const proj = makeProj({
      pass_yds: 4000, pass_tds: 25, pass_int: 12,
      rush_yds: 450, rush_tds: 5,
      receptions: 20, rec_yds: 180, rec_tds: 1,
      fumbles_lost: 2,
    })
    const expected =
      4000 / 20 + 25 * 6 + 12 * -3 +
      450 / 9 + 5 * 6 +
      20 * 0.75 + 180 / 10 + 1 * 4 +
      2 * -4
    expect(scoreProjection(proj, config)).toBeCloseTo(expected, 9)
  })

  it('overriding one weight does not mutate the preset', () => {
    const richerTd = { ...PPR, pass_td_points: 6.0 }
    expect(PPR.pass_td_points).toBe(4.0)
    const proj = makeProj({ pass_tds: 5 })
    expect(scoreProjection(proj, richerTd) - scoreProjection(proj, PPR)).toBeCloseTo(2.0 * 5, 9)
  })
})

describe('negative scoring values', () => {
  it('punitive interception weight', () => {
    const config = { ...PPR, pass_int_points: -6.0 }
    const proj = makeProj({ pass_yds: 4000, pass_int: 10 })
    expect(scoreProjection(proj, config)).toBe(100.0)
  })

  it('fumble penalty applied', () => {
    expect(scoreProjection(makeProj({ fumbles_lost: 3 }), PPR)).toBe(-6.0)
  })

  it('total can go negative', () => {
    expect(scoreProjection(makeProj({ pass_int: 20, fumbles_lost: 5 }), PPR)).toBeLessThan(0)
  })

  it('negative projected stat is scored through, not clamped (Cooper Rush case)', () => {
    expect(scoreProjection(makeProj({ rush_yds: -20 }), PPR)).toBe(-2.0)
  })
})

describe('fractional scoring', () => {
  it('Section 13.3 example: 4100/25 = 164.0', () => {
    expect(scoreProjection(makeProj({ pass_yds: 4100 }), PPR)).toBe(164.0)
  })

  it('fractional yardage is not truncated', () => {
    const result = scoreProjection(makeProj({ pass_yds: 4123.7 }), PPR)
    expect(result).toBeCloseTo(164.948, 9)
    expect(result).not.toBe(164.0)
  })

  it('7 receptions under Half PPR contributes exactly 3.5', () => {
    expect(scoreProjection(makeProj({ receptions: 7 }), HALF_PPR)).toBe(3.5)
  })
})

describe('zero and missing stats', () => {
  it('all-zero stats score zero under every preset', () => {
    const proj = makeProj()
    expect(scoreProjection(proj, PPR)).toBe(0.0)
    expect(scoreProjection(proj, HALF_PPR)).toBe(0.0)
    expect(scoreProjection(proj, STANDARD)).toBe(0.0)
  })

  it('unscored stats never move the total', () => {
    const baseline = scoreProjection(makeProj({ rec_yds: 100 }), PPR)
    const withUnscored = scoreProjection(
      makeProj({ rec_yds: 100, pass_att: 600, pass_cmp: 400, rush_att: 100, rec_tgt: 150, games_proj: 17 }),
      PPR,
    )
    expect(withUnscored).toBe(baseline)
  })
})

describe('scoreBreakdown', () => {
  it('sums to the same total as scoreProjection', () => {
    const proj = makeProj({ pass_yds: 4000, pass_tds: 28, pass_int: 10, rush_yds: 500, rush_tds: 7 })
    const { terms, total } = scoreBreakdown(proj, PPR)
    const summed = terms.reduce((acc, t) => acc + t.points, 0)
    expect(summed).toBe(total)
    expect(total).toBe(344.0)
  })

  it('labels match the spec 19.5 example', () => {
    const proj = makeProj({ pass_yds: 4000, pass_tds: 28, pass_int: 10, rush_yds: 500, rush_tds: 7 })
    const { terms } = scoreBreakdown(proj, PPR)
    const byKey = Object.fromEntries(terms.map((t) => [t.key, t.points]))
    expect(byKey.pass_yds).toBe(160.0)
    expect(byKey.pass_tds).toBe(112.0)
    expect(byKey.pass_int).toBe(-20.0)
    expect(byKey.rush_yds).toBe(50.0)
    expect(byKey.rush_tds).toBe(42.0)
  })
})
