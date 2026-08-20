// Port of src/fantasy_value/scoring/models.py::ScoringConfig. No field
// defaults -- a default-PPR-shaped config would smuggle back "PPR is the
// underlying model," which spec Section 13 explicitly forbids. Build one via
// a preset (presets.ts) or `{ ...preset, someField: value }`.

export interface ScoringConfig {
  readonly pass_yds_per_point: number
  readonly pass_td_points: number
  readonly pass_int_points: number
  readonly rush_yds_per_point: number
  readonly rush_td_points: number
  readonly reception_points: number
  readonly rec_yds_per_point: number
  readonly rec_td_points: number
  readonly fumble_lost_points: number
}

const YARDAGE_DIVISOR_FIELDS = [
  'pass_yds_per_point',
  'rush_yds_per_point',
  'rec_yds_per_point',
] as const satisfies readonly (keyof ScoringConfig)[]

/** Returns [] when valid; a list of human-readable problems otherwise.
 * Mirrors ScoringConfig.__post_init__: every weight must be finite, and the
 * three yards-per-point divisors must be > 0 (a config typo, not a valid
 * scoring rule -- zeroing yardage would hide the typo). */
export function validateScoringConfig(config: ScoringConfig): string[] {
  const problems: string[] = []
  for (const [key, value] of Object.entries(config) as [keyof ScoringConfig, number][]) {
    if (!Number.isFinite(value)) {
      problems.push(`${key} must be a finite number (got ${String(value)})`)
    }
  }
  for (const key of YARDAGE_DIVISOR_FIELDS) {
    const value = config[key]
    if (Number.isFinite(value) && value <= 0) {
      problems.push(`${key} must be > 0 (got ${value}); it is a yards-per-point divisor, not a per-event weight`)
    }
  }
  return problems
}

export function assertValidScoringConfig(config: ScoringConfig): void {
  const problems = validateScoringConfig(config)
  if (problems.length > 0) {
    throw new Error(`invalid ScoringConfig: ${problems.join('; ')}`)
  }
}
