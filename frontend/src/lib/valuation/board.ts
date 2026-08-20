// Port of src/fantasy_value/valuation/board.py.

import type { LeagueConfig } from './league'
import type { PlayerValuation, ScoredPlayer, ValuationBoard } from './models'
import { computePar } from './par'
import { computeReplacementLevels, type ReplacementLevelFn } from './replacement'
import { computeVona } from './vona'

export function availablePlayers(pool: readonly ScoredPlayer[], drafted: ReadonlySet<string>): ScoredPlayer[] {
  return pool.filter((p) => !drafted.has(p.player_id))
}

export interface BuildBoardOptions {
  readonly drafted?: ReadonlySet<string>
  readonly replacementFn?: ReplacementLevelFn
}

/** Replacement levels come from the FULL pool -- not the post-draft one.
 * Replacement level is a function of (player universe, league config), not
 * draft state: shrinking the pool while holding starter demand constant
 * would systematically overstate scarcity as the draft progresses (in the
 * degenerate case the boundary runs past the end of the pool and PAR
 * disappears entirely). VONA is the metric meant to move every pick (spec
 * Section 19.4 defaults live-draft ranking to VONA); PAR stays stable as a
 * result. A caller wanting a dynamic baseline can call
 * computeReplacementLevels(available, league) directly -- it is pure and
 * cheap, so nothing is hidden or precluded. Do NOT "fix" this by passing
 * `available` below -- see board.test.ts's prefix-draft stability test. */
export function buildBoard(
  pool: readonly ScoredPlayer[],
  league: LeagueConfig,
  options: BuildBoardOptions = {},
): ValuationBoard {
  const { drafted = new Set<string>(), replacementFn = computeReplacementLevels } = options

  const replacementLevels = replacementFn(pool, league)
  const available = availablePlayers(pool, drafted)
  const vona = computeVona(available)

  const players: PlayerValuation[] = available.map((p) => ({
    player_id: p.player_id,
    position: p.position,
    points: p.points,
    par: computePar(p, replacementLevels),
    vona: vona.get(p.player_id) ?? null,
  }))

  return { replacement_levels: replacementLevels, players }
}
