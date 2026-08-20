import { describe, expect, it } from 'vitest'
import { makePool, rbTrio } from '../__fixtures__/pools'
import { availablePlayers, buildBoard } from './board'
import { DEFAULT_LEAGUE } from './league'
import { computeReplacementLevels } from './replacement'

describe('buildBoard on the canonical fixture', () => {
  it('replacement levels and player count', () => {
    const pool = makePool({ teCurve: 'steep' })
    const board = buildBoard(pool, DEFAULT_LEAGUE)
    expect(board.replacement_levels.get('QB')).toBe(240.0)
    expect(board.replacement_levels.get('RB')).toBe(110.0)
    expect(board.replacement_levels.get('WR')).toBe(109.0)
    expect(board.replacement_levels.get('TE')).toBe(108.0)
    expect(board.players.length).toBe(130)
    expect(board.players.every((pv) => pv.par !== null)).toBe(true)
  })
})

describe('replacement and PAR/VONA stability across a top-prefix draft', () => {
  it('every survivor is byte-identical; replacement levels are unchanged', () => {
    const pool = makePool({ teCurve: 'steep' })
    const rbIdsByRank = pool
      .filter((p) => p.position === 'RB')
      .sort((a, b) => b.points - a.points)
      .map((p) => p.player_id)
    const top10 = new Set(rbIdsByRank.slice(0, 10))

    const before = buildBoard(pool, DEFAULT_LEAGUE)
    const after = buildBoard(pool, DEFAULT_LEAGUE, { drafted: top10 })

    expect(before.replacement_levels).toEqual(after.replacement_levels)

    const beforeById = new Map(before.players.map((pv) => [pv.player_id, pv]))
    const afterById = new Map(after.players.map((pv) => [pv.player_id, pv]))
    const survivors = rbIdsByRank.filter((id) => !top10.has(id))
    for (const id of survivors) {
      expect(beforeById.get(id)?.par).toBe(afterById.get(id)?.par)
      expect(beforeById.get(id)?.vona).toBe(afterById.get(id)?.vona)
    }

    expect([...top10].every((id) => !afterById.has(id))).toBe(true)
  })

  it('contrast: a dynamic baseline computed on the shrunken pool does move', () => {
    const pool = makePool({ teCurve: 'steep' })
    const rbIdsByRank = pool
      .filter((p) => p.position === 'RB')
      .sort((a, b) => b.points - a.points)
      .map((p) => p.player_id)
    const drafted = new Set(rbIdsByRank.slice(0, 20))
    const remaining = availablePlayers(pool, drafted)

    const dynamicLevels = computeReplacementLevels(remaining, DEFAULT_LEAGUE)
    const stableLevels = buildBoard(pool, DEFAULT_LEAGUE, { drafted }).replacement_levels
    expect(dynamicLevels.get('RB')).not.toBe(stableLevels.get('RB'))
  })

  it('statelessness: repeated calls agree', () => {
    const pool = makePool({ teCurve: 'steep' })
    const drafted = new Set(['rb1', 'wr1'])
    expect(buildBoard(pool, DEFAULT_LEAGUE, { drafted })).toEqual(buildBoard(pool, DEFAULT_LEAGUE, { drafted }))
  })

  it('replacementFn injection point', () => {
    const trio = rbTrio()
    const board = buildBoard(trio, DEFAULT_LEAGUE, {
      replacementFn: () => new Map([['RB', 100.0]]),
    })
    const byId = new Map(board.players.map((pv) => [pv.player_id, pv]))
    expect(byId.get('rb1')?.par).toBe(150.0)
    expect(byId.get('rb2')?.par).toBe(125.0)
  })
})
