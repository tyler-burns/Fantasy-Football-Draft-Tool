import { describe, expect, it } from 'vitest'
import { player, rbTrio } from '../__fixtures__/pools'
import { availablePlayers } from './board'
import { bestAvailable, computeVona } from './vona'

describe('Section 17.1 (required, verbatim)', () => {
  it('before draft: RB1=25, RB2=5, RB3=null', () => {
    const vona = computeVona(rbTrio())
    expect(vona).toEqual(new Map([['rb1', 25.0], ['rb2', 5.0], ['rb3', null]]))
  })

  it('best available is rb1', () => {
    expect(bestAvailable(rbTrio()).get('RB')?.player_id).toBe('rb1')
  })

  it('after rb1 is drafted: RB2=5, RB3=null', () => {
    const trio = rbTrio()
    const available = availablePlayers(trio, new Set(['rb1']))
    expect(bestAvailable(available).get('RB')?.player_id).toBe('rb2')
    expect(computeVona(available)).toEqual(new Map([['rb2', 5.0], ['rb3', null]]))
  })

  it('rb2 VONA is unchanged across the draft', () => {
    const trio = rbTrio()
    const before = computeVona(trio)
    const after = computeVona(availablePlayers(trio, new Set(['rb1'])))
    expect(before.get('rb2')).toBe(5.0)
    expect(after.get('rb2')).toBe(5.0)
  })
})

describe('computeVona', () => {
  it('positions are independent', () => {
    const trio = rbTrio()
    const wrs = Array.from({ length: 40 }, (_, i) => player(`wr${i}`, 'WR', 300.0 - i))
    const withWrs = computeVona([...trio, ...wrs])
    const rbOnly = computeVona(trio)
    expect(withWrs.get('rb1')).toBe(rbOnly.get('rb1'))
    expect(withWrs.get('rb2')).toBe(rbOnly.get('rb2'))
    expect(withWrs.get('rb3')).toBe(rbOnly.get('rb3'))
  })

  it('single player at a position is null', () => {
    expect(computeVona([player('1', 'RB', 100.0)])).toEqual(new Map([['1', null]]))
  })

  it('empty pool', () => {
    expect(computeVona([])).toEqual(new Map())
  })

  it('exact tie gives 0.0 for the id-first player', () => {
    const a = player('a', 'RB', 100.0)
    const b = player('b', 'RB', 100.0)
    for (const pool of [[a, b], [b, a]]) {
      expect(computeVona(pool).get('a')).toBe(0.0)
    }
  })

  it('drafting a mid-list player changes only the one immediately above', () => {
    const pool = Array.from({ length: 5 }, (_, i) => player(`rb${i}`, 'RB', 100.0 - i)) // rb0..rb4
    const before = computeVona(pool)
    const after = computeVona(availablePlayers(pool, new Set(['rb2'])))
    expect(after.get('rb1')).not.toBe(before.get('rb1')) // now compares to rb3
    expect(after.get('rb0')).toBe(before.get('rb0')) // unaffected
    expect(after.get('rb3')).toBe(before.get('rb3')) // unaffected
  })

  it('drafting every player at a position removes it', () => {
    const rbs = Array.from({ length: 3 }, (_, i) => player(`rb${i}`, 'RB', 100.0 - i))
    const wrs = Array.from({ length: 3 }, (_, i) => player(`wr${i}`, 'WR', 200.0 - i))
    const pool = [...rbs, ...wrs]
    const drafted = new Set(rbs.map((p) => p.player_id))
    const available = availablePlayers(pool, drafted)
    const vona = computeVona(available)
    for (const p of rbs) expect(vona.has(p.player_id)).toBe(false)
  })

  it('unknown drafted ids are ignored', () => {
    const trio = rbTrio()
    expect(availablePlayers(trio, new Set(['nonexistent'])).length).toBe(3)
  })

  it('availablePlayers does not mutate the input', () => {
    const trio = rbTrio()
    const before = [...trio]
    availablePlayers(trio, new Set(['rb1']))
    expect(trio).toEqual(before)
  })
})
