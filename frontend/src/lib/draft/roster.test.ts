import { describe, expect, it } from 'vitest'
import { DEFAULT_LEAGUE, FLEX_RB_WR_TE } from '../valuation/league'
import type { BoardPlayer } from './view'
import { fillRoster, rosterSlotCounts, slotKeyForPosition, ROSTER_SLOT_KEYS } from './roster'

function player(id: string, position: string): BoardPlayer {
  return {
    player_id: id, name: id, team: 'BUF', position, position_rank: 1,
    points: 100, adp: 1, isPlaceholder: false, isIgnored: false,
  }
}

const TEAMS = 12
const MY_SLOT = 4 // 0-based slot 3

function myPickIndex(n: number): number {
  // The nth (0-based) pick index owned by slot 3 under 12-team snake order.
  // Round 0: index 3. Round 1 (reversed): index 12 + (11-3) = 20. Round 2: 27. etc.
  const indexes: number[] = []
  for (let i = 0; indexes.length <= n; i++) {
    const round = Math.floor(i / TEAMS)
    const inRound = i % TEAMS
    const slot = round % 2 === 0 ? inRound : TEAMS - 1 - inRound
    if (slot === MY_SLOT - 1) indexes.push(i)
  }
  return indexes[n]!
}

describe('slotKeyForPosition', () => {
  it('maps real positions to their own slot key', () => {
    expect(slotKeyForPosition('QB')).toBe('QB')
    expect(slotKeyForPosition('RB')).toBe('RB')
    expect(slotKeyForPosition('K')).toBe('K')
  })
  it('maps DEF to DST', () => {
    expect(slotKeyForPosition('DEF')).toBe('DST')
  })
  it('unknown position returns null', () => {
    expect(slotKeyForPosition('FB')).toBeNull()
  })
})

describe('rosterSlotCounts', () => {
  it('matches DEFAULT_LEAGUE fields', () => {
    expect(rosterSlotCounts(DEFAULT_LEAGUE)).toEqual({
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, DST: 1, K: 1, BN: 6,
    })
  })
})

describe('fillRoster', () => {
  const counts = { QB: 1, RB: 2, WR: 2, TE: 0, FLEX: 2, DST: 1, K: 1, BN: 6 }

  it('empty draft: every slot present, ordered by ROSTER_SLOT_KEYS, all empty', () => {
    const entries = fillRoster({
      picks: [], teams: TEAMS, mySlot: MY_SLOT, counts,
      flexPositions: FLEX_RB_WR_TE, playersById: new Map(),
    })
    expect(entries.length).toBe(15) // 1+2+2+0+2+1+1+6
    expect(entries.every((e) => e.player === null && e.pickIndex === null)).toBe(true)
    // order follows ROSTER_SLOT_KEYS
    const keys = entries.map((e) => e.key)
    expect(keys).toEqual(['QB', 'RB', 'RB', 'WR', 'WR', 'FLEX', 'FLEX', 'DST', 'K', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN'])
    expect(keys.filter((k) => k === 'TE').length).toBe(0)
  })

  it('own position fills before FLEX', () => {
    const rb1 = myPickIndex(0)
    const rb2 = myPickIndex(1)
    const rb3 = myPickIndex(2)
    const picks: string[] = []
    picks[rb1] = 'rbA'
    picks[rb2] = 'rbB'
    picks[rb3] = 'rbC'
    const playersById = new Map([
      ['rbA', player('rbA', 'RB')],
      ['rbB', player('rbB', 'RB')],
      ['rbC', player('rbC', 'RB')],
    ])
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts, flexPositions: FLEX_RB_WR_TE, playersById })
    const rbEntries = entries.filter((e) => e.key === 'RB')
    const flexEntries = entries.filter((e) => e.key === 'FLEX')
    expect(rbEntries.every((e) => e.player !== null)).toBe(true)
    expect(flexEntries.filter((e) => e.player?.player_id === 'rbC').length).toBe(1)
  })

  it('FLEX only when eligible: an ineligible position falls through to bench', () => {
    const teIndex = myPickIndex(0)
    const picks: string[] = []
    picks[teIndex] = 'te1'
    const playersById = new Map([['te1', player('te1', 'TE')]])
    // TE not in flexPositions and counts.TE === 0, so TE has no own slot either.
    const entries = fillRoster({
      picks, teams: TEAMS, mySlot: MY_SLOT, counts,
      flexPositions: new Set(['RB', 'WR']), playersById,
    })
    const flexEntries = entries.filter((e) => e.key === 'FLEX')
    const benchEntries = entries.filter((e) => e.key === 'BN')
    expect(flexEntries.every((e) => e.player === null)).toBe(true)
    expect(benchEntries.some((e) => e.player?.player_id === 'te1')).toBe(true)
  })

  it('overflow: more picks than slots drops the extra silently, never throws', () => {
    const bigCounts = { QB: 1, RB: 0, WR: 0, TE: 0, FLEX: 0, DST: 0, K: 0, BN: 0 }
    const qb1 = myPickIndex(0)
    const qb2 = myPickIndex(1)
    const picks: string[] = []
    picks[qb1] = 'qbA'
    picks[qb2] = 'qbB'
    const playersById = new Map([
      ['qbA', player('qbA', 'QB')],
      ['qbB', player('qbB', 'QB')],
    ])
    expect(() =>
      fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts: bigCounts, flexPositions: FLEX_RB_WR_TE, playersById }),
    ).not.toThrow()
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts: bigCounts, flexPositions: FLEX_RB_WR_TE, playersById })
    expect(entries.length).toBe(1)
    expect(entries[0]!.player?.player_id).toBe('qbA') // first pick wins the only slot
  })

  it('K/DST rows stay empty forever when the pool has no K/DEF players', () => {
    const entries = fillRoster({
      picks: [], teams: TEAMS, mySlot: MY_SLOT, counts,
      flexPositions: FLEX_RB_WR_TE, playersById: new Map(),
    })
    const kEntry = entries.find((e) => e.key === 'K')
    const dstEntry = entries.find((e) => e.key === 'DST')
    expect(kEntry?.player).toBeNull()
    expect(dstEntry?.player).toBeNull()
  })

  it('a placeholder K/DST pick fills its own slot, not FLEX or bench', () => {
    const kIndex = myPickIndex(0)
    const dstIndex = myPickIndex(1)
    const picks: string[] = []
    picks[kIndex] = 'placeholder:K:99'
    picks[dstIndex] = 'placeholder:DST:100'
    const playersById = new Map([
      ['placeholder:K:99', { ...player('placeholder:K:99', 'K'), isPlaceholder: true }],
      ['placeholder:DST:100', { ...player('placeholder:DST:100', 'DST'), isPlaceholder: true }],
    ])
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts, flexPositions: FLEX_RB_WR_TE, playersById })
    expect(entries.find((e) => e.key === 'K')?.player?.isPlaceholder).toBe(true)
    expect(entries.find((e) => e.key === 'DST')?.player?.isPlaceholder).toBe(true)
    expect(entries.filter((e) => e.key === 'FLEX').every((e) => e.player === null)).toBe(true)
  })

  it('a DEF player fills the DST slot', () => {
    const defIndex = myPickIndex(0)
    const picks: string[] = []
    picks[defIndex] = 'def1'
    const playersById = new Map([['def1', player('def1', 'DEF')]])
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts, flexPositions: FLEX_RB_WR_TE, playersById })
    const dstEntry = entries.find((e) => e.key === 'DST')
    expect(dstEntry?.player?.player_id).toBe('def1')
  })

  it('pickIndex on a filled entry is the overall pick index, for "3.04"-style labels', () => {
    const qbIndex = myPickIndex(0)
    const picks: string[] = []
    picks[qbIndex] = 'qb1'
    const playersById = new Map([['qb1', player('qb1', 'QB')]])
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts, flexPositions: FLEX_RB_WR_TE, playersById })
    expect(entries.find((e) => e.key === 'QB')?.pickIndex).toBe(qbIndex)
  })

  it('only my picks are considered', () => {
    // Fill picks for every slot in round 1 and 2 (24 picks), but only slot 3
    // (mySlot) should ever land on the roster.
    const picks: string[] = []
    for (let i = 0; i < TEAMS * 2; i++) picks[i] = `p${i}`
    const playersById = new Map(Array.from({ length: TEAMS * 2 }, (_, i) => [`p${i}`, player(`p${i}`, 'RB')] as const))
    const entries = fillRoster({ picks, teams: TEAMS, mySlot: MY_SLOT, counts, flexPositions: FLEX_RB_WR_TE, playersById })
    const filled = entries.filter((e) => e.player !== null)
    expect(filled.length).toBe(2) // exactly 2 of my picks logged in the first 24
  })

  it('ROSTER_SLOT_KEYS is exactly the 8 design slot keys', () => {
    expect(ROSTER_SLOT_KEYS).toEqual(['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K', 'BN'])
  })
})
