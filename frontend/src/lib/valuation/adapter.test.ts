import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from '../projections/types'
import { PPR, STANDARD } from '../scoring/presets'
import { toScoredPlayers } from './adapter'

function makeProj(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    player_id: '1',
    name: 'Josh Allen',
    first_name: 'Josh',
    last_name: 'Allen',
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
    search_full_name: 'joshallen',
    ...overrides,
  }
}

describe('toScoredPlayers', () => {
  it('points match the scoring engine', () => {
    const proj = makeProj({ pass_yds: 4000, pass_tds: 28, pass_int: 10, rush_yds: 500, rush_tds: 7 })
    const [scored] = toScoredPlayers([proj], PPR)
    expect(scored?.points).toBe(344.0)
  })

  it('FB resolves to RB and competes in the RB pool', () => {
    // position="FB" isn't itself a recognized valuation position; eligible
    // positions come from fantasy_positions only -- FB carries no separate
    // flex-eligibility meaning once resolved.
    const proj = makeProj({ player_id: '2', position: 'FB', fantasy_positions: ['RB'] })
    const [scored] = toScoredPlayers([proj], PPR)
    expect(scored?.position).toBe('RB')
    expect(scored?.eligible_positions).toEqual(new Set(['RB']))
  })

  it('multi-position eligibility is retained', () => {
    const proj = makeProj({ player_id: '3', position: 'RB', fantasy_positions: ['RB', 'WR'] })
    const [scored] = toScoredPlayers([proj], PPR)
    expect(scored?.position).toBe('RB')
    expect(scored?.eligible_positions).toEqual(new Set(['RB', 'WR']))
  })

  it('no position throws, naming the player_id', () => {
    const proj = makeProj({ player_id: '4', position: null, fantasy_positions: [] })
    expect(() => toScoredPlayers([proj], PPR)).toThrow(/4/)
  })

  it('a different scoring config changes points by exactly the reception term', () => {
    const proj = makeProj({
      player_id: '5', position: 'WR', fantasy_positions: ['WR'],
      receptions: 100, rec_yds: 1000,
    })
    const pprPoints = toScoredPlayers([proj], PPR)[0]?.points
    const stdPoints = toScoredPlayers([proj], STANDARD)[0]?.points
    expect(pprPoints).not.toBe(stdPoints)
    expect((pprPoints ?? 0) - (stdPoints ?? 0)).toBe(100.0)
  })
})
