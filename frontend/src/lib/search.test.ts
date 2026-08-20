import { describe, expect, it } from 'vitest'
import type { PlayerProjection } from './projections/types'
import { matchesProjectionQuery, normalizeQuery, searchProjections } from './search'

function makeProj(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    player_id: '1',
    name: "Ja'Marr Chase",
    first_name: "Ja'Marr",
    last_name: 'Chase',
    team: 'CIN',
    position: 'WR',
    fantasy_positions: ['WR'],
    weeks_included: 17,
    pass_att: 0, pass_cmp: 0, pass_yds: 0, pass_tds: 0, pass_int: 0,
    rush_att: 0, rush_yds: 0, rush_tds: 0,
    receptions: 0, rec_yds: 0, rec_tds: 0, rec_tgt: 0,
    fumbles_lost: 0, games_proj: 17,
    adp: null, pos_adp: null, reference_pts_ppr: null,
    search_full_name: 'jamarrchase',
    ...overrides,
  }
}

describe('normalizeQuery', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeQuery("Ja'Marr Chase")).toBe('jamarrchase')
  })
})

describe('matchesProjectionQuery', () => {
  it('matches punctuation-insensitively against name', () => {
    expect(matchesProjectionQuery(makeProj(), 'jamarr')).toBe(true)
  })
  it('matches against team', () => {
    expect(matchesProjectionQuery(makeProj(), 'CIN')).toBe(true)
  })
  it('empty query matches everything', () => {
    expect(matchesProjectionQuery(makeProj(), '')).toBe(true)
  })
  it('non-matching query returns false', () => {
    expect(matchesProjectionQuery(makeProj(), 'mahomes')).toBe(false)
  })
})

describe('searchProjections', () => {
  const players = [makeProj({ player_id: '1', name: 'Josh Allen', team: 'BUF' }), makeProj({ player_id: '2', name: 'Josh Jacobs', team: 'GB' })]

  it('empty query returns no results', () => {
    expect(searchProjections(players, '')).toEqual([])
  })

  it('matches multiple players sharing a prefix', () => {
    expect(searchProjections(players, 'josh').map((p) => p.player_id)).toEqual(['1', '2'])
  })

  it('respects the limit', () => {
    expect(searchProjections(players, 'josh', 1).length).toBe(1)
  })
})
