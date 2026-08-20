// Port of src/fantasy_value/valuation/adapter.py -- the only bridge between
// real projection/scoring data and the valuation algorithms. Everything
// downstream stays schema-independent.

import { scoreProjection } from '../scoring/calculator'
import type { ScoringConfig } from '../scoring/types'
import type { PlayerProjection } from '../projections/types'
import { makeScoredPlayer, type ScoredPlayer } from './models'

export function toScoredPlayers(
  projections: Iterable<PlayerProjection>,
  config: ScoringConfig,
): ScoredPlayer[] {
  const scored: ScoredPlayer[] = []
  for (const projection of projections) {
    const fantasyPositions = projection.fantasy_positions
    const position =
      projection.position && fantasyPositions.includes(projection.position)
        ? projection.position
        : (fantasyPositions[0] ?? projection.position)

    if (!position) {
      throw new Error(`player ${JSON.stringify(projection.player_id)} has no position or fantasy_positions`)
    }

    const points = scoreProjection(projection, config)
    scored.push(
      makeScoredPlayer({
        player_id: projection.player_id,
        position,
        points,
        eligible_positions: fantasyPositions,
      }),
    )
  }
  return scored
}
