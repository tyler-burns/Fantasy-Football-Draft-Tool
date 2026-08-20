import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from '../projections/types'
import { player as makePlayer } from '../__fixtures__/pools'
import { buildBoard } from '../valuation/board'
import { DEFAULT_LEAGUE } from '../valuation/league'
import { computeAdpValue, computeOverallValue, modelRankBasis, rankPlayers } from './modes'

function makeProj(id: string, position: string, adp: number | null): PlayerProjection {
  return {
    player_id: id,
    name: `Player ${id}`,
    first_name: 'Player',
    last_name: id,
    team: 'BUF',
    position,
    fantasy_positions: [position],
    weeks_included: 17,
    pass_att: 0, pass_cmp: 0, pass_yds: 0, pass_tds: 0, pass_int: 0,
    rush_att: 0, rush_yds: 0, rush_tds: 0,
    receptions: 0, rec_yds: 0, rec_tds: 0, rec_tgt: 0,
    fumbles_lost: 0, games_proj: 17,
    adp,
    pos_adp: adp,
    reference_pts_ppr: null,
    search_full_name: `player${id}`,
  }
}

describe('computeOverallValue', () => {
  it('adds PAR and VONA', () => {
    expect(computeOverallValue(70, 18.4)).toBeCloseTo(88.4, 9)
  })
  it('null VONA contributes 0', () => {
    expect(computeOverallValue(70, null)).toBe(70)
  })
  it('null PAR propagates', () => {
    expect(computeOverallValue(null, 5)).toBeNull()
  })
})

describe('modelRankBasis', () => {
  it('adp_value falls back to vona', () => {
    expect(modelRankBasis('adp_value')).toBe('vona')
  })
  it('every other mode is its own basis', () => {
    expect(modelRankBasis('points')).toBe('points')
    expect(modelRankBasis('par')).toBe('par')
    expect(modelRankBasis('vona')).toBe('vona')
    expect(modelRankBasis('overall_value')).toBe('overall_value')
  })
})

describe('computeAdpValue', () => {
  it('Section 20 example: adp 50, rank 25 -> +25 (undervalued)', () => {
    expect(computeAdpValue(50, 25)).toBe(25)
  })
  it('null adp -> null', () => {
    expect(computeAdpValue(null, 25)).toBeNull()
  })
  it('null model rank -> null', () => {
    expect(computeAdpValue(50, null)).toBeNull()
  })
})

describe('rankPlayers', () => {
  const pool = [
    makePlayer('rb1', 'RB', 250.0),
    makePlayer('rb2', 'RB', 225.0),
    makePlayer('rb3', 'RB', 220.0),
    makePlayer('wr1', 'WR', 200.0),
  ]
  const projectionsById = new Map<string, PlayerProjection>([
    ['rb1', makeProj('rb1', 'RB', 5)],
    ['rb2', makeProj('rb2', 'RB', 1)], // ADP says #1 but model has him #2 -> negative ADP value
    ['rb3', makeProj('rb3', 'RB', null)], // no ADP
    ['wr1', makeProj('wr1', 'WR', 10)],
  ])
  const league = { ...DEFAULT_LEAGUE, teams: 1, qb_slots: 0, rb_slots: 1, wr_slots: 1, te_slots: 0, flex_slots: 0, dst_slots: 0, k_slots: 0 }
  const board = buildBoard(pool, league)

  it('overall_rank and position_rank under VONA mode', () => {
    const ranked = rankPlayers(board, board, 'vona', projectionsById)
    const rb1 = ranked.find((r) => r.player_id === 'rb1')!
    const rb2 = ranked.find((r) => r.player_id === 'rb2')!
    expect(rb1.value).toBe(25.0) // rb1 vona per 17.1's numbers
    expect(rb2.value).toBe(5.0)
    expect(rb1.position_rank).toBe(1)
    expect(rb2.position_rank).toBe(2)
  })

  it('the Value column reflects the active mode', () => {
    const byPoints = rankPlayers(board, board, 'points', projectionsById)
    const rb1Points = byPoints.find((r) => r.player_id === 'rb1')!
    expect(rb1Points.value).toBe(250.0)
  })

  it('ADP Value: rb2 has model rank 2 (by VONA) but ADP 1 -> negative (overvalued by the market)', () => {
    const ranked = rankPlayers(board, board, 'adp_value', projectionsById)
    const rb2 = ranked.find((r) => r.player_id === 'rb2')!
    expect(rb2.model_rank).toBe(2)
    expect(rb2.adp_value).toBe(1 - 2)
    expect(rb2.value).toBe(rb2.adp_value)
  })

  it('null ADP produces null ADP Value regardless of mode', () => {
    const ranked = rankPlayers(board, board, 'adp_value', projectionsById)
    const rb3 = ranked.find((r) => r.player_id === 'rb3')!
    expect(rb3.adp_value).toBeNull()
  })

  it('null-value players sort last in ADP Value mode', () => {
    const ranked = rankPlayers(board, board, 'adp_value', projectionsById)
    const rb3 = ranked.find((r) => r.player_id === 'rb3')!
    const nonNullCount = ranked.filter((r) => r.value !== null).length
    expect(rb3.overall_rank).toBeGreaterThan(nonNullCount - 1)
  })

  it('model rank comes from the full pool and does not drift when players are drafted', () => {
    const availableBoard = buildBoard(pool, league, { drafted: new Set(['rb1']) })
    const rankedFull = rankPlayers(board, board, 'adp_value', projectionsById)
    const rankedAfterDraft = rankPlayers(availableBoard, board, 'adp_value', projectionsById)
    const rb2Before = rankedFull.find((r) => r.player_id === 'rb2')!
    const rb2After = rankedAfterDraft.find((r) => r.player_id === 'rb2')!
    expect(rb2Before.model_rank).toBe(rb2After.model_rank)
  })

  it('throws if a player has no matching projection', () => {
    expect(() => rankPlayers(board, board, 'points', new Map())).toThrow()
  })
})
