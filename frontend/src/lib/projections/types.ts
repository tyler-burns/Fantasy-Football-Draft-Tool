// Field-for-field with the published JSON (src/fantasy_value/snapshot.py) and
// with src/fantasy_value/projections/models.py's PlayerProjection. Field
// names are kept snake_case (not camelCase) deliberately -- see
// docs/frontend.md: this is the wire schema and the Python schema at once,
// so there is no mapping layer for a field-name typo to hide inside.

export interface PlayerProjection {
  readonly player_id: string
  readonly name: string | null
  readonly first_name: string | null
  readonly last_name: string | null
  readonly team: string | null
  readonly position: string | null
  readonly fantasy_positions: readonly string[]
  readonly weeks_included: number

  readonly pass_att: number
  readonly pass_cmp: number
  readonly pass_yds: number
  readonly pass_tds: number
  readonly pass_int: number

  readonly rush_att: number
  readonly rush_yds: number
  readonly rush_tds: number

  readonly receptions: number
  readonly rec_yds: number
  readonly rec_tds: number
  readonly rec_tgt: number

  readonly fumbles_lost: number
  readonly games_proj: number

  readonly adp: number | null
  readonly pos_adp: number | null
  readonly reference_pts_ppr: number | null

  readonly search_full_name: string | null
}

export interface SnapshotMetadata {
  readonly season: number
  readonly source: string
  readonly projection_company: string | null
  readonly projection_type: string
  readonly aggregation: string
  readonly generated_at: string
  readonly player_count: number
  readonly validation_warnings: number
}

export interface Snapshot {
  readonly metadata: SnapshotMetadata
  readonly players: readonly PlayerProjection[]
}
