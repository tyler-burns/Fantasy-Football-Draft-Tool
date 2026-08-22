import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from '../projections/types'
import type { PlayerValuation, ValuationBoard } from '../valuation/models'
import { player } from '../__fixtures__/pools'
import { buildBoard } from '../valuation/board'
import { DEFAULT_LEAGUE } from '../valuation/league'
import { buildPoolPlayers, computeDraftValue, computePositionRanks, valueTone } from './pool'

function makeProj(id: string, position: string, adp: number | null): PlayerProjection {
  return {
    player_id: id, name: `Player ${id}`, first_name: 'Player', last_name: id, team: 'BUF',
    position, fantasy_positions: [position], weeks_included: 17,
    pass_att: 0, pass_cmp: 0, pass_yds: 0, pass_tds: 0, pass_int: 0,
    rush_att: 0, rush_yds: 0, rush_tds: 0,
    receptions: 0, rec_yds: 0, rec_tds: 0, rec_tgt: 0,
    fumbles_lost: 0, games_proj: 17,
    adp, pos_adp: adp, reference_pts_ppr: null, search_full_name: `player${id}`,
  }
}

describe('computeDraftValue', () => {
  it('adp 9, clock at pick 1 (index 0) -> +8', () => {
    expect(computeDraftValue(9, 0)).toBe(8)
  })
  it('adp 9, clock at pick 9 (index 8) -> 0', () => {
    expect(computeDraftValue(9, 8)).toBe(0)
  })
  it('null adp -> null', () => {
    expect(computeDraftValue(null, 0)).toBeNull()
  })
})

describe('valueTone', () => {
  it.each([
    [8, 'good'], [100, 'good'],
    [7, 'neutral'], [0, 'neutral'], [-7, 'neutral'],
    [-8, 'bad'], [-100, 'bad'],
    [null, 'neutral'],
  ] as const)('%s -> %s', (value, tone) => {
    expect(valueTone(value)).toBe(tone)
  })
})

describe('computePositionRanks', () => {
  function board(players: PlayerValuation[]): ValuationBoard {
    return { replacement_levels: new Map(), players }
  }

  it('ranks per position, 1-indexed, descending by points', () => {
    const b = board([
      { player_id: 'rb1', position: 'RB', points: 200, par: null, vona: null },
      { player_id: 'rb2', position: 'RB', points: 250, par: null, vona: null },
      { player_id: 'wr1', position: 'WR', points: 300, par: null, vona: null },
    ])
    const ranks = computePositionRanks(b)
    expect(ranks.get('rb2')).toBe(1)
    expect(ranks.get('rb1')).toBe(2)
    expect(ranks.get('wr1')).toBe(1)
  })

  it('ties broken by player_id ascending', () => {
    const b = board([
      { player_id: 'rbZ', position: 'RB', points: 200, par: null, vona: null },
      { player_id: 'rbA', position: 'RB', points: 200, par: null, vona: null },
    ])
    const ranks = computePositionRanks(b)
    expect(ranks.get('rbA')).toBe(1)
    expect(ranks.get('rbZ')).toBe(2)
  })

  it('stable across a draft only when computed from the full-pool board -- contrasted with the available board, which would renumber', () => {
    const pool = [
      player('rb1', 'RB', 250), player('rb2', 'RB', 225), player('rb3', 'RB', 220),
      player('wr1', 'WR', 200),
    ]
    const league = { ...DEFAULT_LEAGUE, teams: 1, qb_slots: 0, rb_slots: 1, wr_slots: 1, te_slots: 0, flex_slots: 0, dst_slots: 0, k_slots: 0 }
    const fullBoard = buildBoard(pool, league)
    const availableBoardAfterDraft = buildBoard(pool, league, { drafted: new Set(['rb1']) })

    // Correct usage: rank from the full-pool board before and after a pick.
    // rb2's rank must not change just because rb1 got drafted.
    const stableBefore = computePositionRanks(fullBoard)
    const stableAfter = computePositionRanks(fullBoard) // the full board never reflects draft state
    expect(stableBefore.get('rb2')).toBe(2)
    expect(stableAfter.get('rb2')).toBe(2)

    // Contrast: ranking from the AVAILABLE (post-draft) board instead would
    // renumber rb2 to rank 1 once rb1 is gone -- the exact instability this
    // function's full-pool contract exists to avoid.
    const wrongApproach = computePositionRanks(availableBoardAfterDraft)
    expect(wrongApproach.get('rb2')).toBe(1)
  })
})

describe('buildPoolPlayers', () => {
  it('attaches adp, draft_value, position_rank, and the matching projection', () => {
    const board: ValuationBoard = {
      replacement_levels: new Map([['RB', 100]]),
      players: [{ player_id: 'rb1', position: 'RB', points: 250, par: 150, vona: 25 }],
    }
    const ranks = new Map([['rb1', 1]])
    const projectionsById = new Map([['rb1', makeProj('rb1', 'RB', 5)]])
    const [pool] = buildPoolPlayers(board, ranks, 0, projectionsById)
    expect(pool).toMatchObject({
      player_id: 'rb1', position: 'RB', points: 250, par: 150, vona: 25,
      adp: 5, position_rank: 1, draft_value: 4,
    })
    expect(pool!.projection.player_id).toBe('rb1')
  })

  it('throws if a player has no matching projection', () => {
    const board: ValuationBoard = {
      replacement_levels: new Map(),
      players: [{ player_id: 'ghost', position: 'RB', points: 100, par: null, vona: null }],
    }
    expect(() => buildPoolPlayers(board, new Map(), 0, new Map())).toThrow()
  })
})
