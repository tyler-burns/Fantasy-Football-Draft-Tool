// "My roster" slot-fill algorithm, ported from the design handoff's
// expanded/rosterRows construction (Draft Room.dc.html ~lines 518-539).

import { DEF_POSITION, type LeagueConfig } from '../valuation/league'
import { isMyPick } from './snake'
import type { BoardPlayer } from './view'

export const ROSTER_SLOT_KEYS = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K', 'BN'] as const
export type RosterSlotKey = (typeof ROSTER_SLOT_KEYS)[number]

export const LEAGUE_FIELD_FOR_SLOT: Readonly<Record<RosterSlotKey, keyof LeagueConfig>> = {
  QB: 'qb_slots',
  RB: 'rb_slots',
  WR: 'wr_slots',
  TE: 'te_slots',
  FLEX: 'flex_slots',
  DST: 'dst_slots',
  K: 'k_slots',
  BN: 'bench_slots',
}

export const SLOT_LABELS: Readonly<Record<RosterSlotKey, string>> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX',
  DST: 'DST',
  K: 'K',
  BN: 'BENCH',
}

/** The canonical position token on PlayerProjection/ScoredPlayer for
 * defenses is "DEF" (see valuation/league.ts); the design's roster slot key
 * is "DST". Nothing in the current dataset has DEF players, so this is
 * inert today -- it exists so a future DEF player fills the DST row instead
 * of falling through to bench. */
export function slotKeyForPosition(position: string): RosterSlotKey | null {
  if (position === DEF_POSITION) return 'DST'
  const key = position as RosterSlotKey
  return (ROSTER_SLOT_KEYS as readonly string[]).includes(key) && key !== 'FLEX' && key !== 'BN' ? key : null
}

export function rosterSlotCounts(league: LeagueConfig): Record<RosterSlotKey, number> {
  return {
    QB: league.qb_slots,
    RB: league.rb_slots,
    WR: league.wr_slots,
    TE: league.te_slots,
    FLEX: league.flex_slots,
    DST: league.dst_slots,
    K: league.k_slots,
    BN: league.bench_slots,
  }
}

export interface RosterEntry {
  readonly key: RosterSlotKey
  readonly index: number // 0-based position within this slot key, for stable React keys
  readonly player: BoardPlayer | null
  readonly pickIndex: number | null
}

export interface FillRosterArgs {
  readonly picks: readonly string[]
  readonly teams: number
  readonly mySlot: number
  readonly counts: Record<RosterSlotKey, number>
  readonly flexPositions: ReadonlySet<string>
  readonly playersById: ReadonlyMap<string, BoardPlayer>
}

/** Expands `counts` into an ordered, empty slot list (ROSTER_SLOT_KEYS
 * order), then walks MY picks in draft order, placing each into the first
 * empty slot of its own position, else the first empty eligible FLEX, else
 * the first empty bench slot. A pick that fits nowhere (every matching slot
 * full) is simply not shown on the roster -- it still exists on the Board. */
export function fillRoster(args: FillRosterArgs): RosterEntry[] {
  const { picks, teams, mySlot, counts, flexPositions, playersById } = args

  const entries: RosterEntry[] = []
  for (const key of ROSTER_SLOT_KEYS) {
    for (let i = 0; i < counts[key]; i++) {
      entries.push({ key, index: i, player: null, pickIndex: null })
    }
  }

  for (let pickIndex = 0; pickIndex < picks.length; pickIndex++) {
    if (!isMyPick(pickIndex, teams, mySlot)) continue
    const playerId = picks[pickIndex]
    if (playerId === undefined) continue
    const player = playersById.get(playerId)
    if (!player) continue

    const ownKey = slotKeyForPosition(player.position)
    let target = ownKey ? entries.find((e) => e.key === ownKey && e.player === null) : undefined

    if (!target && flexPositions.has(player.position)) {
      target = entries.find((e) => e.key === 'FLEX' && e.player === null)
    }
    if (!target) {
      target = entries.find((e) => e.key === 'BN' && e.player === null)
    }
    if (!target) continue // every matching slot is full; pick stays off the roster view

    const targetIndex = entries.indexOf(target)
    entries[targetIndex] = { ...target, player, pickIndex }
  }

  return entries
}
