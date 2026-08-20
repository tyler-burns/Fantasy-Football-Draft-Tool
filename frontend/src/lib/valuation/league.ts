// Port of src/fantasy_value/valuation/league.py.

// Spec Section 14 says "DST"; the canonical position token carried on
// PlayerProjection (and Python's constants.FETCH_POSITIONS) is "DEF".
export const DEF_POSITION = 'DEF'

export const FLEX_RB_WR: ReadonlySet<string> = new Set(['RB', 'WR'])
export const FLEX_RB_WR_TE: ReadonlySet<string> = new Set(['RB', 'WR', 'TE']) // Section 14.1 default

export interface LeagueConfig {
  readonly teams: number
  readonly qb_slots: number
  readonly rb_slots: number
  readonly wr_slots: number
  readonly te_slots: number
  readonly flex_slots: number
  readonly flex_positions: ReadonlySet<string>
  readonly dst_slots: number
  readonly k_slots: number
  readonly bench_slots: number
}

const SLOT_FIELDS = [
  'qb_slots',
  'rb_slots',
  'wr_slots',
  'te_slots',
  'flex_slots',
  'dst_slots',
  'k_slots',
] as const satisfies readonly (keyof LeagueConfig)[]

/** Normalizes flex_positions to upper/trimmed and validates. Mirrors
 * LeagueConfig.__post_init__: no field defaults (a partially specified
 * league would silently inherit FLEX assumptions the caller never stated) --
 * use DEFAULT_LEAGUE or `{ ...DEFAULT_LEAGUE, teams: 10 }`. */
export function makeLeagueConfig(config: LeagueConfig): LeagueConfig {
  const normalized: LeagueConfig = {
    ...config,
    flex_positions: new Set([...config.flex_positions].map((p) => p.trim().toUpperCase())),
  }
  const problems = validateLeagueConfig(normalized)
  if (problems.length > 0) {
    throw new Error(`invalid LeagueConfig: ${problems.join('; ')}`)
  }
  return normalized
}

export function validateLeagueConfig(config: LeagueConfig): string[] {
  const problems: string[] = []

  if (!Number.isInteger(config.teams)) problems.push(`teams must be an integer (got ${config.teams})`)
  else if (config.teams < 1) problems.push(`teams must be >= 1 (got ${config.teams})`)

  for (const field of SLOT_FIELDS) {
    const value = config[field]
    if (!Number.isInteger(value)) problems.push(`${field} must be an integer (got ${value})`)
    else if (value < 0) problems.push(`${field} must be >= 0 (got ${value})`)
  }
  if (!Number.isInteger(config.bench_slots)) {
    problems.push(`bench_slots must be an integer (got ${config.bench_slots})`)
  } else if (config.bench_slots < 0) {
    problems.push(`bench_slots must be >= 0 (got ${config.bench_slots})`)
  }

  if (config.flex_slots > 0 && config.flex_positions.size === 0) {
    problems.push('flex_slots > 0 requires a non-empty flex_positions set')
  }

  return problems
}

export function starterSlots(league: LeagueConfig): ReadonlyMap<string, number> {
  return new Map([
    ['QB', league.qb_slots],
    ['RB', league.rb_slots],
    ['WR', league.wr_slots],
    ['TE', league.te_slots],
    [DEF_POSITION, league.dst_slots],
    ['K', league.k_slots],
  ])
}

export function dedicatedDemand(league: LeagueConfig, position: string): number {
  return league.teams * (starterSlots(league).get(position) ?? 0)
}

export function flexDemand(league: LeagueConfig): number {
  return league.teams * league.flex_slots
}

export function valuesPosition(league: LeagueConfig, position: string): boolean {
  return dedicatedDemand(league, position) > 0 || (flexDemand(league) > 0 && league.flex_positions.has(position))
}

// Section 14 verbatim.
export const DEFAULT_LEAGUE: LeagueConfig = makeLeagueConfig({
  teams: 12,
  qb_slots: 1,
  rb_slots: 2,
  wr_slots: 2,
  te_slots: 1,
  flex_slots: 2,
  flex_positions: FLEX_RB_WR_TE,
  dst_slots: 1,
  k_slots: 1,
  bench_slots: 6,
})
