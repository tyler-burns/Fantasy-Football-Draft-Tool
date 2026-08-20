import type { PlayerProjection } from '../projections/types'
import { SCORING_TERMS, termPoints, type ScoringTermSpec } from './terms'
import type { ScoringConfig } from './types'

/** Hot path: called once per player per recompute (~300x). Port of
 * scoring/calculator.py::score_projection -- same fixed term order, so
 * totals are bit-identical to the Python engine's. */
export function scoreProjection(projection: PlayerProjection, config: ScoringConfig): number {
  let total = 0
  for (const spec of SCORING_TERMS) {
    total += termPoints(spec, projection, config)
  }
  return total
}

export interface ScoringTerm extends ScoringTermSpec {
  readonly statValue: number
  readonly weightValue: number
  readonly points: number
}

export interface ScoringBreakdown {
  readonly terms: readonly ScoringTerm[]
  readonly total: number
}

/** Cold path: spec Section 19.5's arithmetic breakdown, computed for one
 * player on demand (detail view). Routes through the same SCORING_TERMS
 * table as scoreProjection so there is exactly one place a scoring bug can
 * hide -- tested by asserting sum(terms.points) === scoreProjection(...). */
export function scoreBreakdown(projection: PlayerProjection, config: ScoringConfig): ScoringBreakdown {
  const terms = SCORING_TERMS.map((spec) => ({
    ...spec,
    statValue: projection[spec.stat],
    weightValue: config[spec.weight],
    points: termPoints(spec, projection, config),
  }))
  return { terms, total: scoreProjection(projection, config) }
}
