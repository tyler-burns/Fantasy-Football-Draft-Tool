import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from '../projections/types'
import type { PlayerValuation, ValuationBoard } from '../valuation/models'
import { player } from '../__fixtures__/pools'
import { buildBoard } from '../valuation/board'
import { DEFAULT_LEAGUE } from '../valuation/league'
import { buildPoolPlayers, computeDraftValue, computeDynamicVona, computePositionRanks, valueTone } from './pool'

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

describe('computeDynamicVona', () => {
  function pv(id: string, position: string, points: number): PlayerValuation {
    return { player_id: id, position, points, par: null, vona: null }
  }

  it("the worked example: gap to the best player expected to survive to the caller's next pick", () => {
    // My next pick is overall #20 (nextPickIndex = 19, 0-based). RBs with
    // ADP under 20 are assumed gone by then; the best RB left at that point
    // is the reference point for everyone else's VONA.
    const players = [
      pv('gibbs', 'RB', 360),
      pv('rb2', 'RB', 340), pv('rb3', 'RB', 320), pv('rb4', 'RB', 300),
      pv('rb5', 'RB', 270), // ADP 21 -- past the threshold, expected to survive
      pv('rb6', 'RB', 250),
    ]
    const projectionsById = new Map([
      ['gibbs', makeProj('gibbs', 'RB', 1)],
      ['rb2', makeProj('rb2', 'RB', 8)],
      ['rb3', makeProj('rb3', 'RB', 12)],
      ['rb4', makeProj('rb4', 'RB', 18)],
      ['rb5', makeProj('rb5', 'RB', 21)],
      ['rb6', makeProj('rb6', 'RB', 30)],
    ])
    const vona = computeDynamicVona(players, projectionsById, 19)
    // rb2/rb3/rb4 (ADP 8/12/18) are the 3 expected gone before pick 20;
    // rb5 (ADP 21, points 270) is the best expected to remain.
    expect(vona.get('gibbs')).toBe(90) // 360 - 270
    expect(vona.get('rb5')).toBe(0) // the boundary player himself
    expect(vona.get('rb6')).toBe(-20) // 250 - 270, expected to still be there too
  })

  it('a player with no ADP is never counted as "expected gone"', () => {
    const players = [pv('a', 'RB', 300), pv('b', 'RB', 250), pv('c', 'RB', 200)]
    const projectionsById = new Map([
      ['a', makeProj('a', 'RB', null)],
      ['b', makeProj('b', 'RB', null)],
      ['c', makeProj('c', 'RB', null)],
    ])
    // Nobody has an ADP, so nobody is ever "expected gone" -- the boundary is
    // always the best remaining player, rank 0.
    const vona = computeDynamicVona(players, projectionsById, 0)
    expect(vona.get('a')).toBe(0)
    expect(vona.get('b')).toBe(-50)
    expect(vona.get('c')).toBe(-100)
  })

  it('null with no future pick to compare against', () => {
    const players = [pv('a', 'RB', 300)]
    const projectionsById = new Map([['a', makeProj('a', 'RB', 1)]])
    const vona = computeDynamicVona(players, projectionsById, null)
    expect(vona.get('a')).toBeNull()
  })

  it("null once a position's boundary runs past the last available player", () => {
    const players = [pv('a', 'RB', 300), pv('b', 'RB', 250)]
    const projectionsById = new Map([
      ['a', makeProj('a', 'RB', 1)],
      ['b', makeProj('b', 'RB', 2)],
    ])
    // Both RBs are expected gone before pick 10 -- nobody left as a reference.
    const vona = computeDynamicVona(players, projectionsById, 9)
    expect(vona.get('a')).toBeNull()
    expect(vona.get('b')).toBeNull()
  })

  it('is computed independently per position', () => {
    const players = [pv('rb1', 'RB', 300), pv('wr1', 'WR', 200), pv('wr2', 'WR', 150)]
    const projectionsById = new Map([
      ['rb1', makeProj('rb1', 'RB', 1)],
      ['wr1', makeProj('wr1', 'WR', 5)],
      ['wr2', makeProj('wr2', 'WR', 40)],
    ])
    const vona = computeDynamicVona(players, projectionsById, 9) // next pick #10
    expect(vona.get('rb1')).toBeNull() // only RB, expected gone, nobody left
    expect(vona.get('wr1')).toBe(50) // 200 - 150, wr2 (ADP 40) expected to survive
  })
})

describe('buildPoolPlayers', () => {
  it('attaches adp, draft_value, position_rank, dynamic VONA, and the matching projection', () => {
    const board: ValuationBoard = {
      replacement_levels: new Map([['RB', 100]]),
      players: [{ player_id: 'rb1', position: 'RB', points: 250, par: 150, vona: 999 }],
    }
    const ranks = new Map([['rb1', 1]])
    const dynamicVona = new Map([['rb1', 25]])
    const projectionsById = new Map([['rb1', makeProj('rb1', 'RB', 5)]])
    const [pool] = buildPoolPlayers(board, ranks, dynamicVona, 0, projectionsById)
    expect(pool).toMatchObject({
      player_id: 'rb1', position: 'RB', points: 250, par: 150, vona: 25,
      adp: 5, position_rank: 1, draft_value: 4,
    })
    expect(pool!.projection.player_id).toBe('rb1')
  })

  it('falls back to null if a player is missing from the dynamic VONA map', () => {
    const board: ValuationBoard = {
      replacement_levels: new Map(),
      players: [{ player_id: 'rb1', position: 'RB', points: 250, par: null, vona: null }],
    }
    const projectionsById = new Map([['rb1', makeProj('rb1', 'RB', 5)]])
    const [pool] = buildPoolPlayers(board, new Map(), new Map(), 0, projectionsById)
    expect(pool!.vona).toBeNull()
  })

  it('throws if a player has no matching projection', () => {
    const board: ValuationBoard = {
      replacement_levels: new Map(),
      players: [{ player_id: 'ghost', position: 'RB', points: 100, par: null, vona: null }],
    }
    expect(() => buildPoolPlayers(board, new Map(), new Map(), 0, new Map())).toThrow()
  })
})
