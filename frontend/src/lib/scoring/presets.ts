import type { ScoringConfig } from './types'

// Spec Section 13 YAML verbatim.
export const PPR: ScoringConfig = Object.freeze({
  pass_yds_per_point: 25.0,
  pass_td_points: 4.0,
  pass_int_points: -2.0,
  rush_yds_per_point: 10.0,
  rush_td_points: 6.0,
  reception_points: 1.0,
  rec_yds_per_point: 10.0,
  rec_td_points: 6.0,
  fumble_lost_points: -2.0,
})

// Section 13 gives no separate Half-PPR/Standard tables; by universal league
// convention they differ from PPR in reception_points alone. Derived rather
// than retyped so that invariant can't drift (presets.py's same reasoning).
export const HALF_PPR: ScoringConfig = Object.freeze({ ...PPR, reception_points: 0.5 })
export const STANDARD: ScoringConfig = Object.freeze({ ...PPR, reception_points: 0.0 })

export type PresetName = 'ppr' | 'half_ppr' | 'standard'

export const PRESETS: Readonly<Record<PresetName, ScoringConfig>> = Object.freeze({
  ppr: PPR,
  half_ppr: HALF_PPR,
  standard: STANDARD,
})

export function getPreset(name: string): ScoringConfig {
  const key = name.trim().toLowerCase() as PresetName
  const preset = PRESETS[key]
  if (!preset) {
    throw new Error(`unknown scoring preset ${JSON.stringify(name)}; known presets: ${Object.keys(PRESETS).sort().join(', ')}`)
  }
  return preset
}
