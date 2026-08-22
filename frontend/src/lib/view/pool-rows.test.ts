import { describe, expect, it } from 'vitest'
import type { PoolPlayer } from '../ranking/pool'
import type { PlayerProjection } from '../projections/types'
import { applyFilters, applySort, buildRows, DEFAULT_FILTERS, positionCounts } from './pool-rows'

function makeProj(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    player_id: '1', name: 'Josh Allen', first_name: 'Josh', last_name: 'Allen', team: 'BUF',
    position: 'QB', fantasy_positions: ['QB'], weeks_included: 17,
    pass_att: 0, pass_cmp: 0, pass_yds: 0, pass_tds: 0, pass_int: 0,
    rush_att: 0, rush_yds: 0, rush_tds: 0,
    receptions: 0, rec_yds: 0, rec_tds: 0, rec_tgt: 0,
    fumbles_lost: 0, games_proj: 17,
    adp: null, pos_adp: null, reference_pts_ppr: null, search_full_name: 'joshallen',
    ...overrides,
  }
}

function makePool(overrides: Partial<PoolPlayer> = {}): PoolPlayer {
  const projection = overrides.projection ?? makeProj({ player_id: overrides.player_id ?? '1' })
  return {
    player_id: '1', position: 'QB', points: 300, par: 60, vona: 10, adp: 5,
    position_rank: 1, draft_value: 4, projection,
    ...overrides,
  }
}

describe('applyFilters', () => {
  const players = [
    makePool({ player_id: '1', position: 'QB', projection: makeProj({ player_id: '1', team: 'BUF', name: 'Josh Allen' }) }),
    makePool({ player_id: '2', position: 'RB', projection: makeProj({ player_id: '2', team: 'SF', name: 'Christian McCaffrey' }) }),
    makePool({ player_id: '3', position: 'RB', projection: makeProj({ player_id: '3', team: 'ATL', name: 'Bijan Robinson' }) }),
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
  it('text query', () => {
    expect(applyFilters(players, { ...DEFAULT_FILTERS, query: 'mccaffrey' }).map((p) => p.player_id)).toEqual(['2'])
  })
})

describe('applySort', () => {
  const players = [
    makePool({ player_id: 'a', adp: null, vona: 5, par: 5 }),
    makePool({ player_id: 'b', adp: 5, vona: 30, par: 10 }),
    makePool({ player_id: 'c', adp: 2, vona: 20, par: 15 }),
  ]

  it('adp sorts ascending', () => {
    expect(applySort(players, 'adp').map((p) => p.player_id)).toEqual(['c', 'b', 'a'])
  })
  it('vona sorts descending', () => {
    expect(applySort(players, 'vona').map((p) => p.player_id)).toEqual(['b', 'c', 'a'])
  })
  it('par sorts descending', () => {
    expect(applySort(players, 'par').map((p) => p.player_id)).toEqual(['c', 'b', 'a'])
  })
  it('nulls always sort last regardless of the sort key direction', () => {
    // 'a' has null adp; confirmed last under the ascending adp sort above.
    expect(applySort(players, 'adp').at(-1)?.player_id).toBe('a')
  })
  it('does not mutate the input', () => {
    const before = [...players]
    applySort(players, 'adp')
    expect(players).toEqual(before)
  })
})

describe('buildRows', () => {
  it('composes filter then sort', () => {
    const players = [
      makePool({ player_id: '1', position: 'RB', adp: 10 }),
      makePool({ player_id: '2', position: 'RB', adp: 3 }),
      makePool({ player_id: '3', position: 'WR', adp: 1 }),
    ]
    const rows = buildRows(players, { ...DEFAULT_FILTERS, position: 'RB' }, 'adp')
    expect(rows.map((p) => p.player_id)).toEqual(['2', '1'])
  })
})

describe('positionCounts', () => {
  it('counts per position plus a total under the empty-string key', () => {
    const players = [
      makePool({ player_id: '1', position: 'QB' }),
      makePool({ player_id: '2', position: 'RB' }),
      makePool({ player_id: '3', position: 'RB' }),
    ]
    const counts = positionCounts(players)
    expect(counts.get('')).toBe(3)
    expect(counts.get('QB')).toBe(1)
    expect(counts.get('RB')).toBe(2)
    expect(counts.get('WR')).toBeUndefined()
  })

  it('empty list', () => {
    expect(positionCounts([]).get('')).toBe(0)
  })
})
