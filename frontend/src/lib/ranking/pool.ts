// Replaces the old 5-mode ranking abstraction (lib/ranking/modes.ts,
// deleted) with the design handoff's simpler, live-draft-specific
// semantics: Value = ADP - (current overall pick), position rank is a
// stable, full-pool-computed number (so a drafted player's "RB12" chip
// never renumbers as the draft progresses), and VONA is pick-aware --
// see computeDynamicVona -- rather than the Python port's plain
// next-ranked-player gap.

import type { PlayerProjection } from '../projections/types'
import type { PlayerValuation, ValuationBoard } from '../valuation/models'

/** Drops any projection the user has flagged as stale (injury/suspension
 * not yet reflected in the source data) BEFORE it ever reaches scoring --
 * so an ignored player never consumes a starter/FLEX slot in replacement
 * level, never anchors anyone's VONA, and never shows a misleading PAR of
 * its own. Generic over the id field alone so it works on raw
 * PlayerProjection[] (the actual call site, in usePlayerPool.ts) without a
 * needless intermediate type. */
export function excludeIgnored<T extends { readonly player_id: string }>(
  items: readonly T[],
  ignoredIds: ReadonlySet<string>,
): T[] {
  if (ignoredIds.size === 0) return [...items]
  return items.filter((item) => !ignoredIds.has(item.player_id))
}

export interface PoolPlayer {
  readonly player_id: string
  readonly position: string
  readonly points: number
  readonly par: number | null
  readonly vona: number | null
  readonly adp: number | null
  readonly position_rank: number
  readonly draft_value: number | null
  readonly projection: PlayerProjection
}

export const VALUE_GOOD_THRESHOLD = 8
export const VALUE_BAD_THRESHOLD = -8

export type ValueTone = 'good' | 'bad' | 'neutral'

export function valueTone(value: number | null): ValueTone {
  if (value === null) return 'neutral'
  if (value >= VALUE_GOOD_THRESHOLD) return 'good'
  if (value <= VALUE_BAD_THRESHOLD) return 'bad'
  return 'neutral'
}

function comparePoints(a: PlayerValuation, b: PlayerValuation): number {
  if (a.points !== b.points) return b.points - a.points
  return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
}

/** Position rank computed over the FULL pool (not the active/available
 * board), by points, 1-indexed, ties broken by player_id ascending -- the
 * same stability property board.ts's replacement levels rely on: a drafted
 * player's rank must not renumber as other players come off the board. */
export function computePositionRanks(fullBoard: ValuationBoard): Map<string, number> {
  const byPosition = new Map<string, PlayerValuation[]>()
  for (const p of fullBoard.players) {
    const group = byPosition.get(p.position)
    if (group) group.push(p)
    else byPosition.set(p.position, [p])
  }

  const ranks = new Map<string, number>()
  for (const group of byPosition.values()) {
    const sorted = [...group].sort(comparePoints)
    sorted.forEach((p, i) => ranks.set(p.player_id, i + 1))
  }
  return ranks
}

/** Section 20-style ADP value, but tied to real draft progress rather than
 * a draft-invariant model rank: how many picks a player has fallen past (or
 * been taken ahead of) the pick currently on the clock. `clockIndex` is
 * 0-based (== draftedIds.length); the pick on the clock is `clockIndex + 1`
 * in 1-indexed ADP terms. */
export function computeDraftValue(adp: number | null, clockIndex: number): number | null {
  if (adp === null) return null
  return adp - (clockIndex + 1)
}

/** Pick-aware VONA -- supersedes lib/valuation/vona.ts's `vona` field for
 * display purposes (that Python-ported version stays untouched; it's still
 * what the golden fixture checks). Section 17's plain "gap to the very next
 * ranked player at the position" doesn't account for how many picks actually
 * separate a pick's owner from their own next turn; this does. `nextPickIndex`
 * is deliberately whoever's relevant to the caller, not always "mine" --
 * usePlayerPool.ts passes the pick belonging to whoever is CURRENTLY on the
 * clock, so the column reads as "was this pick good for them" through every
 * team's turn, not only the user's own. For each position, every available
 * player whose ADP falls before `nextPickIndex` is assumed gone by then (no
 * ADP -> assumed NOT going soon, the conservative default); the "boundary"
 * is the best-by-points player past that count, i.e. the best player
 * expected to still be on the board. VONA is this player's points minus the
 * boundary's -- positive and large for a player who'd otherwise be gone
 * before that next pick, at or below zero for one who's expected to still
 * be there regardless. Null with no future pick to compare against
 * (nextPickIndex is null) or once a position's boundary runs past the last
 * available player (everyone left is expected to be gone -- no reference
 * point). */
export function computeDynamicVona(
  players: readonly PlayerValuation[],
  projectionsById: ReadonlyMap<string, PlayerProjection>,
  nextPickIndex: number | null, // 0-based, per lib/draft/snake.ts's convention
): Map<string, number | null> {
  const result = new Map<string, number | null>()
  if (nextPickIndex === null) {
    for (const p of players) result.set(p.player_id, null)
    return result
  }
  const nextPickNumber = nextPickIndex + 1 // 1-indexed, matching ADP's own scale

  const byPosition = new Map<string, PlayerValuation[]>()
  for (const p of players) {
    const group = byPosition.get(p.position)
    if (group) group.push(p)
    else byPosition.set(p.position, [p])
  }

  for (const group of byPosition.values()) {
    const sorted = [...group].sort(comparePoints)
    const expectedGone = sorted.filter((p) => {
      const adp = projectionsById.get(p.player_id)?.adp ?? null
      return adp !== null && adp < nextPickNumber
    }).length
    const boundary = sorted[expectedGone]
    for (const p of sorted) {
      result.set(p.player_id, boundary ? p.points - boundary.points : null)
    }
  }
  return result
}

export function buildPoolPlayers(
  board: ValuationBoard,
  positionRanks: ReadonlyMap<string, number>,
  dynamicVona: ReadonlyMap<string, number | null>,
  clockIndex: number,
  projectionsById: ReadonlyMap<string, PlayerProjection>,
): PoolPlayer[] {
  return board.players.map((pv) => {
    const projection = projectionsById.get(pv.player_id)
    if (!projection) throw new Error(`no projection found for player_id ${pv.player_id}`)

    return {
      player_id: pv.player_id,
      position: pv.position,
      points: pv.points,
      par: pv.par,
      vona: dynamicVona.get(pv.player_id) ?? null,
      adp: projection.adp,
      position_rank: positionRanks.get(pv.player_id) ?? 0,
      draft_value: computeDraftValue(projection.adp, clockIndex),
      projection,
    }
  })
}
