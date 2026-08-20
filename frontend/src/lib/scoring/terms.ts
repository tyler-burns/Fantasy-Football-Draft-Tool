import type { PlayerProjection } from '../projections/types'
import type { ScoringConfig } from './types'

type ScoredStatField =
  | 'pass_yds'
  | 'pass_tds'
  | 'pass_int'
  | 'rush_yds'
  | 'rush_tds'
  | 'receptions'
  | 'rec_yds'
  | 'rec_tds'
  | 'fumbles_lost'

export interface ScoringTermSpec {
  readonly key: ScoredStatField
  readonly label: string // spec Section 19.5 display
  readonly stat: ScoredStatField
  readonly weight: keyof ScoringConfig
  readonly op: 'div' | 'mul'
}

// ORDER IS LOAD-BEARING. Identical to scoring/calculator.py's expression
// (passing, rushing, receiving, misc). Float addition is not associative;
// keeping the order identical is what makes TS totals bit-identical to
// Python's -- the basis for the cross-language golden fixture test.
export const SCORING_TERMS: readonly ScoringTermSpec[] = [
  { key: 'pass_yds', label: 'Pass yards', stat: 'pass_yds', weight: 'pass_yds_per_point', op: 'div' },
  { key: 'pass_tds', label: 'Pass TD', stat: 'pass_tds', weight: 'pass_td_points', op: 'mul' },
  { key: 'pass_int', label: 'Interception', stat: 'pass_int', weight: 'pass_int_points', op: 'mul' },
  { key: 'rush_yds', label: 'Rush yards', stat: 'rush_yds', weight: 'rush_yds_per_point', op: 'div' },
  { key: 'rush_tds', label: 'Rush TD', stat: 'rush_tds', weight: 'rush_td_points', op: 'mul' },
  { key: 'receptions', label: 'Reception', stat: 'receptions', weight: 'reception_points', op: 'mul' },
  { key: 'rec_yds', label: 'Rec yards', stat: 'rec_yds', weight: 'rec_yds_per_point', op: 'div' },
  { key: 'rec_tds', label: 'Rec TD', stat: 'rec_tds', weight: 'rec_td_points', op: 'mul' },
  { key: 'fumbles_lost', label: 'Fumble lost', stat: 'fumbles_lost', weight: 'fumble_lost_points', op: 'mul' },
] as const

export function termPoints(spec: ScoringTermSpec, projection: PlayerProjection, config: ScoringConfig): number {
  const stat = projection[spec.stat]
  const weight = config[spec.weight]
  return spec.op === 'div' ? stat / weight : stat * weight
}
