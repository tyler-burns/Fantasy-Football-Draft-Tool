import { describe, expect, it } from 'vitest'
import { makePool, player } from '../__fixtures__/pools'
import { DEFAULT_LEAGUE } from './league'
import { computePar, computeParById } from './par'
import { computeReplacementLevels } from './replacement'

describe('computePar', () => {
  it('Section 16 example: 290 - 220 = 70', () => {
    expect(computePar(player('1', 'RB', 290.0), new Map([['RB', 220.0]]))).toBe(70.0)
  })

  it('sub-replacement is negative', () => {
    expect(computePar(player('1', 'RB', 100.0), new Map([['RB', 220.0]]))).toBe(-120.0)
  })

  it('the replacement player himself scores exactly zero', () => {
    expect(computePar(player('1', 'RB', 220.0), new Map([['RB', 220.0]]))).toBe(0.0)
  })

  it('null replacement level propagates', () => {
    expect(computePar(player('1', 'K', 100.0), new Map([['K', null]]))).toBeNull()
  })

  it('missing position in the map is null', () => {
    expect(computePar(player('1', 'K', 100.0), new Map())).toBeNull()
  })

  it('a replacement level of exactly 0 is not confused with "missing" (?? not ||)', () => {
    expect(computePar(player('1', 'RB', 5.0), new Map([['RB', 0.0]]))).toBe(5.0)
  })

  it('end to end on the canonical fixture', () => {
    const pool = makePool({ teCurve: 'steep' })
    const levels = computeReplacementLevels(pool, DEFAULT_LEAGUE)
    const rb1 = pool.find((p) => p.player_id === 'rb1')!
    const te1 = pool.find((p) => p.player_id === 'te1')!
    expect(computePar(rb1, levels)).toBeCloseTo(250.0 - 110.0, 9)
    expect(computePar(te1, levels)).toBeCloseTo(300.0 - 108.0, 9)
  })

  it('computeParById covers every player', () => {
    const pool = makePool({ teCurve: 'steep' })
    const levels = computeReplacementLevels(pool, DEFAULT_LEAGUE)
    const byId = computeParById(pool, levels)
    expect(new Set(byId.keys())).toEqual(new Set(pool.map((p) => p.player_id)))
    for (const p of pool) {
      expect(byId.get(p.player_id)).toBe(computePar(p, levels))
    }
  })
})
