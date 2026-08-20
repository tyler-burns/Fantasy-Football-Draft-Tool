import { describe, expect, it } from 'vitest'
import type { RankedPlayer } from '../ranking/modes'
import type { PlayerProjection } from '../projections/types'
import { applyFilters, applySort, buildRows, DEFAULT_FILTERS, DEFAULT_SORT } from './rows'

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
    pass_att: 0, pass_cmp: 0, pass_yds: 0, pass_tds: 0, pass_int: 0,
    rush_att: 0, rush_yds: 0, rush_tds: 0,
    receptions: 0, rec_yds: 0, rec_tds: 0, rec_tgt: 0,
    fumbles_lost: 0, games_proj: 17,
    adp: null, pos_adp: null, reference_pts_ppr: null,
    search_full_name: 'joshallen',
    ...overrides,
  }
}

function makeRanked(overrides: Partial<RankedPlayer> = {}): RankedPlayer {
  const projection = overrides.projection ?? makeProj({ player_id: overrides.player_id ?? '1' })
  return {
    player_id: '1',
    position: 'QB',
    points: 300,
    par: 60,
    vona: 10,
    adp: 5,
    adp_value: 2,
    overall_value: 70,
    value: 10,
    model_rank: 3,
    overall_rank: 1,
    position_rank: 1,
    projection,
    ...overrides,
  }
}

describe('applyFilters', () => {
  const players = [
    makeRanked({ player_id: '1', position: 'QB', projection: makeProj({ player_id: '1', team: 'BUF', name: 'Josh Allen' }) }),
    makeRanked({ player_id: '2', position: 'RB', projection: makeProj({ player_id: '2', team: 'SF', name: 'Christian McCaffrey' }) }),
    makeRanked({ player_id: '3', position: 'RB', projection: makeProj({ player_id: '3', team: 'ATL', name: 'Bijan Robinson' }) }),
  ]

  it('no filters returns everyone', () => {
    expect(applyFilters(players, DEFAULT_FILTERS).length).toBe(3)
  })

  it('position filter', () => {
    expect(applyFilters(players, { ...DEFAULT_FILTERS, position: 'RB' }).map((p) => p.player_id)).toEqual(['2', '3'])
  })

  it('team filter', () => {
    expect(applyFilters(players, { ...DEFAULT_FILTERS, team: 'ATL' }).map((p) => p.player_id)).toEqual(['3'])
  })

  it('text query matches name, case/punctuation-insensitive', () => {
    expect(applyFilters(players, { ...DEFAULT_FILTERS, query: "mccaffrey" }).map((p) => p.player_id)).toEqual(['2'])
  })

  it('filters compose', () => {
    expect(applyFilters(players, { position: 'RB', team: 'ATL', query: 'bijan' }).map((p) => p.player_id)).toEqual(['3'])
  })
})

describe('applySort', () => {
  const players = [
    makeRanked({ player_id: 'a', points: 100, adp: null }),
    makeRanked({ player_id: 'b', points: 300, adp: 5 }),
    makeRanked({ player_id: 'c', points: 200, adp: 2 }),
  ]

  it('sorts descending by a numeric column', () => {
    expect(applySort(players, { column: 'points', direction: 'desc' }).map((p) => p.player_id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts ascending', () => {
    expect(applySort(players, { column: 'points', direction: 'asc' }).map((p) => p.player_id)).toEqual(['a', 'c', 'b'])
  })

  it('nulls always sort last, regardless of direction', () => {
    expect(applySort(players, { column: 'adp', direction: 'asc' }).map((p) => p.player_id)).toEqual(['c', 'b', 'a'])
    expect(applySort(players, { column: 'adp', direction: 'desc' }).map((p) => p.player_id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input array', () => {
    const before = [...players]
    applySort(players, DEFAULT_SORT)
    expect(players).toEqual(before)
  })
})

describe('buildRows', () => {
  it('composes filter then sort', () => {
    const players = [
      makeRanked({ player_id: '1', position: 'RB', points: 100 }),
      makeRanked({ player_id: '2', position: 'RB', points: 300 }),
      makeRanked({ player_id: '3', position: 'WR', points: 500 }),
    ]
    const rows = buildRows(players, { ...DEFAULT_FILTERS, position: 'RB' }, { column: 'points', direction: 'desc' })
    expect(rows.map((p) => p.player_id)).toEqual(['2', '1'])
  })
})
