// Port of src/fantasy_value/valuation/models.py.

export interface ScoredPlayer {
  readonly player_id: string
  readonly position: string
  readonly points: number
  readonly eligible_positions: ReadonlySet<string>
}

/** The only production site where ScoredPlayers are born (mirrors what
 * ScoredPlayer.__post_init__ did in Python -- normalization moves here
 * since a TS interface has no constructor hook). Also used by test fixtures
 * (__fixtures__/pools.ts) as the single other construction site. */
export function makeScoredPlayer(input: {
  player_id: string
  position: string
  points: number
  eligible_positions?: Iterable<string>
}): ScoredPlayer {
  const position = input.position.trim().toUpperCase()
  if (!position) throw new Error('position must not be empty')
  if (!Number.isFinite(input.points)) throw new Error(`points must be a finite number (got ${input.points})`)

  const eligible = new Set([...(input.eligible_positions ?? [])].map((p) => p.trim().toUpperCase()))
  eligible.add(position)

  return { player_id: input.player_id, position, points: input.points, eligible_positions: eligible }
}

export interface PlayerValuation {
  readonly player_id: string
  readonly position: string
  readonly points: number
  readonly par: number | null
  readonly vona: number | null
}

export interface ValuationBoard {
  readonly replacement_levels: ReadonlyMap<string, number | null>
  readonly players: readonly PlayerValuation[]
}

/** Port of models.py::rank_key -> (-points, player_id).
 * Array.prototype.sort has no default numeric ordering (the default
 * comparator stringifies), so every sort in this package passes this
 * comparator explicitly. Ids compare with < / > (UTF-16 code-unit order),
 * matching Python's code-point ordering for Sleeper's ASCII ids -- not
 * localeCompare, which is locale-dependent and would make the documented
 * tie-break non-deterministic across machines. */
export function compareRank(a: ScoredPlayer, b: ScoredPlayer): number {
  if (a.points !== b.points) return b.points - a.points
  return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0
}

export function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  for (const item of smaller) {
    if (larger.has(item)) return true
  }
  return false
}

/** Port of models.py::group_by_position. Returns NEW arrays -- never sorts
 * the caller's array (Python's sorted() copies; JS's .sort() mutates in
 * place -- this asymmetry is the most likely mechanical port bug). */
export function groupByPosition(pool: readonly ScoredPlayer[]): Map<string, ScoredPlayer[]> {
  const groups = new Map<string, ScoredPlayer[]>()
  for (const p of pool) {
    const group = groups.get(p.position)
    if (group) group.push(p)
    else groups.set(p.position, [p])
  }
  for (const group of groups.values()) {
    group.sort(compareRank)
  }
  return groups
}
