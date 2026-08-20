import { describe, expect, it } from 'vitest'
import { makePool, player } from '../__fixtures__/pools'
import { DEFAULT_LEAGUE, FLEX_RB_WR } from './league'
import { allocateStarters, computeReplacementLevels } from './replacement'

describe('allocateStarters', () => {
  it('canonical fixture: dedicated and flex split', () => {
    const pool = makePool({ teCurve: 'steep' })
    const alloc = allocateStarters(pool, DEFAULT_LEAGUE)
    expect(alloc.dedicated).toEqual(new Map([['QB', 12], ['RB', 24], ['WR', 24], ['TE', 12]]))
    expect(alloc.flex).toEqual(new Map([['QB', 0], ['RB', 11], ['WR', 9], ['TE', 4]]))
    expect(alloc.flex_player_ids.length).toBe(24)
  })

  it('every starting slot filled exactly once', () => {
    const pool = makePool({ teCurve: 'steep' })
    const alloc = allocateStarters(pool, DEFAULT_LEAGUE)
    const sum = [...alloc.cutoff.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(96) // 12 * (1+2+2+1+2)
  })

  it('no player is double-allocated to flex', () => {
    const pool = makePool({ teCurve: 'steep' })
    const alloc = allocateStarters(pool, DEFAULT_LEAGUE)
    expect(new Set(alloc.flex_player_ids).size).toBe(alloc.flex_player_ids.length)
  })
})

describe('replacement levels with FLEX', () => {
  it('canonical assertion: QB 240 / RB 110 / WR 109 / TE 108', () => {
    const levels = computeReplacementLevels(makePool({ teCurve: 'steep' }), DEFAULT_LEAGUE)
    expect(levels.get('QB')).toBe(240.0)
    expect(levels.get('RB')).toBe(110.0)
    expect(levels.get('WR')).toBe(109.0)
    expect(levels.get('TE')).toBe(108.0)
  })

  it('naive cutoffs (154/145/156) are wrong', () => {
    const levels = computeReplacementLevels(makePool({ teCurve: 'steep' }), DEFAULT_LEAGUE)
    expect(levels.get('RB')).not.toBe(154.0)
    expect(levels.get('WR')).not.toBe(145.0)
    expect(levels.get('TE')).not.toBe(156.0)
  })

  it('RB/WR-only flex reverts TE to its naive cutoff', () => {
    const league = { ...DEFAULT_LEAGUE, flex_positions: FLEX_RB_WR }
    const levels = computeReplacementLevels(makePool({ teCurve: 'steep' }), league)
    expect(levels.get('QB')).toBe(240.0)
    expect(levels.get('RB')).toBe(102.0)
    expect(levels.get('WR')).toBe(101.0)
    expect(levels.get('TE')).toBe(156.0)
  })

  it('flex-eligible position earning zero slots keeps its naive cutoff', () => {
    const levels = computeReplacementLevels(makePool({ teCurve: 'flat' }), DEFAULT_LEAGUE)
    expect(levels.get('RB')).toBe(102.0)
    expect(levels.get('WR')).toBe(101.0)
    expect(levels.get('TE')).toBe(104.0)
  })

  it('order independence', () => {
    const pool = makePool({ teCurve: 'steep' })
    const reversed = [...pool].reverse()
    expect(computeReplacementLevels(pool, DEFAULT_LEAGUE)).toEqual(computeReplacementLevels(reversed, DEFAULT_LEAGUE))
  })

  it('does not mutate the input pool', () => {
    const pool = makePool({ teCurve: 'steep' })
    const before = [...pool]
    computeReplacementLevels(pool, DEFAULT_LEAGUE)
    expect(pool).toEqual(before)
  })
})

describe('replacement levels without FLEX', () => {
  it('exact naive cutoffs', () => {
    const league = { ...DEFAULT_LEAGUE, flex_slots: 0 }
    const levels = computeReplacementLevels(makePool({ teCurve: 'steep' }), league)
    expect(levels.get('QB')).toBe(240.0)
    expect(levels.get('RB')).toBe(154.0)
    expect(levels.get('WR')).toBe(145.0)
    expect(levels.get('TE')).toBe(156.0)
  })

  it('zero flex slots ignores flex_positions', () => {
    const league = { ...DEFAULT_LEAGUE, flex_slots: 0, flex_positions: FLEX_RB_WR }
    const levels = computeReplacementLevels(makePool({ teCurve: 'steep' }), league)
    expect(levels.get('TE')).toBe(156.0)
  })

  it('single team, no flex', () => {
    const pool = Array.from({ length: 10 }, (_, i) => player(`rb${i}`, 'RB', 100.0 - i))
    const league = { ...DEFAULT_LEAGUE, teams: 1, flex_slots: 0 }
    const levels = computeReplacementLevels(pool, league)
    expect(levels.get('RB')).toBe(pool[2]!.points) // rb_slots=2 dedicated -> 3rd player
  })
})

describe('edge cases', () => {
  it('empty pool: every configured position is null', () => {
    const levels = computeReplacementLevels([], DEFAULT_LEAGUE)
    for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
      expect(levels.get(position)).toBeNull()
    }
  })

  it('position with fewer players than dedicated demand', () => {
    const fewTe = Array.from({ length: 5 }, (_, i) => player(`te${i}`, 'TE', 100.0 - i))
    const rbs = Array.from({ length: 30 }, (_, i) => player(`rb${i}`, 'RB', 200.0 - i))
    const wrs = Array.from({ length: 30 }, (_, i) => player(`wr${i}`, 'WR', 200.0 - i))
    const qbs = Array.from({ length: 15 }, (_, i) => player(`qb${i}`, 'QB', 200.0 - i))
    const pool = [...fewTe, ...rbs, ...wrs, ...qbs]

    const alloc = allocateStarters(pool, DEFAULT_LEAGUE)
    expect(alloc.flex.get('TE')).toBe(0)

    const levels = computeReplacementLevels(pool, DEFAULT_LEAGUE)
    expect(levels.get('TE')).toBeNull()
  })

  it('exact cutoff boundary', () => {
    const rbs = Array.from({ length: 24 }, (_, i) => player(`rb${i}`, 'RB', 200.0 - i))
    const wrs = Array.from({ length: 24 }, (_, i) => player(`wr${i}`, 'WR', 500.0 - i))
    const qbs = Array.from({ length: 12 }, (_, i) => player(`qb${i}`, 'QB', 200.0 - i))
    expect(computeReplacementLevels([...rbs, ...wrs, ...qbs], DEFAULT_LEAGUE).get('RB')).toBeNull()

    // 24 WR leftovers (all beating -999) absorb every FLEX slot, leaving the
    // extra RB as the untouched 25th-player boundary.
    const extraRb = player('rb_extra', 'RB', -999.0)
    const wrLeftovers = Array.from({ length: 24 }, (_, i) => player(`wrx${i}`, 'WR', 300.0 - i))
    const levels = computeReplacementLevels([...rbs, extraRb, ...wrs, ...wrLeftovers, ...qbs], DEFAULT_LEAGUE)
    expect(levels.get('RB')).toBe(-999.0)
  })

  it('single-player position fully consumed by dedicated slot', () => {
    const levels = computeReplacementLevels([player('te1', 'TE', 100.0)], DEFAULT_LEAGUE)
    expect(levels.get('TE')).toBeNull()
  })

  it('zero-demand position returns null even with a deep pool', () => {
    const ks = Array.from({ length: 20 }, (_, i) => player(`k${i}`, 'K', 50.0 - i))
    const league = { ...DEFAULT_LEAGUE, k_slots: 0, dst_slots: 0 }
    const levels = computeReplacementLevels(ks, league)
    expect(levels.get('K')).toBeNull()
    expect(levels.get('DEF')).toBeNull()
  })

  it('nonzero-demand position gets a real replacement level', () => {
    const ks = Array.from({ length: 20 }, (_, i) => player(`k${i}`, 'K', 50.0 - i))
    const levels = computeReplacementLevels(ks, DEFAULT_LEAGUE) // k_slots=1, teams=12 -> K13
    expect(levels.get('K')).toBe(ks[12]!.points)
  })

  it('unknown position returns null, no crash', () => {
    const levels = computeReplacementLevels([player('fb1', 'FB', 90.0)], DEFAULT_LEAGUE)
    expect(levels.get('FB') ?? null).toBeNull()
  })

  it('FLEX boundary ties broken by player_id, deterministic across orderings', () => {
    const rbs = Array.from({ length: 24 }, (_, i) => player(`rb${i}`, 'RB', 200.0 - i))
    const tieA = player('rb_tie_a', 'RB', 100.0)
    const tieB = player('rb_tie_b', 'RB', 100.0)
    const wrs = Array.from({ length: 24 }, (_, i) => player(`wr${i}`, 'WR', 500.0 - i))
    const wrLeftovers = Array.from({ length: 23 }, (_, i) => player(`wrx${i}`, 'WR', 300.0 - i))
    const qbs = Array.from({ length: 12 }, (_, i) => player(`qb${i}`, 'QB', 200.0 - i))
    const pool = [...rbs, tieA, tieB, ...wrs, ...wrLeftovers, ...qbs]

    for (const shuffled of [pool, [...pool].reverse()]) {
      expect(computeReplacementLevels(shuffled, DEFAULT_LEAGUE).get('RB')).toBe(100.0)
    }
  })

  it('negative points can legitimately be the replacement level', () => {
    const rbs = Array.from({ length: 24 }, (_, i) => player(`rb${i}`, 'RB', 200.0 - i))
    const neg = player('bad', 'RB', -50.0)
    const wrs = Array.from({ length: 48 }, (_, i) => player(`wr${i}`, 'WR', 500.0 - i)) // absorbs all 24 flex slots
    const qbs = Array.from({ length: 12 }, (_, i) => player(`qb${i}`, 'QB', 200.0 - i))
    const levels = computeReplacementLevels([...rbs, neg, ...wrs, ...qbs], DEFAULT_LEAGUE)
    expect(levels.get('RB')).toBe(-50.0)
  })

  it('multi-position player is charged to his own position', () => {
    const pool = makePool({ teCurve: 'steep' })
    const flexRb = player('flex_rb', 'RB', 500.0, ['WR'])
    const alloc = allocateStarters([...pool, flexRb], DEFAULT_LEAGUE)
    expect(alloc.flex_player_ids).not.toContain('flex_rb') // takes a dedicated RB slot, not flex
    const levels = computeReplacementLevels([...pool, flexRb], DEFAULT_LEAGUE)
    expect(levels.get('RB')).not.toBeNull()
  })

  it('bench slots do not affect replacement level', () => {
    const pool = makePool({ teCurve: 'steep' })
    const noBench = { ...DEFAULT_LEAGUE, bench_slots: 0 }
    const bigBench = { ...DEFAULT_LEAGUE, bench_slots: 20 }
    expect(computeReplacementLevels(pool, noBench)).toEqual(computeReplacementLevels(pool, bigBench))
  })

  it('purity: repeated calls agree and return independent objects', () => {
    const pool = makePool({ teCurve: 'steep' })
    const first = computeReplacementLevels(pool, DEFAULT_LEAGUE)
    const second = computeReplacementLevels(pool, DEFAULT_LEAGUE)
    expect(first).toEqual(second)
    first.set('RB', 99999.0)
    expect(computeReplacementLevels(pool, DEFAULT_LEAGUE).get('RB')).not.toBe(99999.0)
  })
})
