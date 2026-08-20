import type { AppAction } from '../hooks/useAppState'
import type { LeagueConfig } from '../lib/valuation/league'
import { NumberField } from './NumberField'
import styles from './LeagueConfigForm.module.css'

const FLEX_OPTIONS = ['RB', 'WR', 'TE'] as const

const SLOT_FIELDS: { field: Exclude<keyof LeagueConfig, 'flex_positions'>; label: string }[] = [
  { field: 'teams', label: 'Teams' },
  { field: 'qb_slots', label: 'QB' },
  { field: 'rb_slots', label: 'RB' },
  { field: 'wr_slots', label: 'WR' },
  { field: 'te_slots', label: 'TE' },
  { field: 'flex_slots', label: 'FLEX' },
  { field: 'dst_slots', label: 'DST' },
  { field: 'k_slots', label: 'K' },
  { field: 'bench_slots', label: 'Bench' },
]

interface LeagueConfigFormProps {
  readonly league: LeagueConfig
  readonly dispatch: (action: AppAction) => void
}

export function LeagueConfigForm({ league, dispatch }: LeagueConfigFormProps) {
  function toggleFlexPosition(position: string) {
    const next = new Set(league.flex_positions)
    if (next.has(position)) next.delete(position)
    else next.add(position)
    dispatch({ type: 'setFlexPositions', positions: next })
  }

  return (
    <div className={styles.section}>
      <div className={styles.heading}>League</div>
      <div className={styles.grid}>
        {SLOT_FIELDS.map(({ field, label }) => (
          <NumberField
            key={field}
            label={label}
            value={league[field]}
            step={1}
            validate={(v) => {
              if (!Number.isInteger(v)) return 'must be a whole number'
              if (field === 'teams' ? v < 1 : v < 0) return field === 'teams' ? 'must be >= 1' : 'must be >= 0'
              return null
            }}
            onCommit={(value) => dispatch({ type: 'setLeagueField', field, value })}
          />
        ))}
      </div>

      <div className={styles.flexRow} role="group" aria-label="FLEX-eligible positions">
        FLEX eligible:
        {FLEX_OPTIONS.map((position) => (
          <label key={position}>
            <input
              type="checkbox"
              checked={league.flex_positions.has(position)}
              onChange={() => toggleFlexPosition(position)}
            />{' '}
            {position}
          </label>
        ))}
      </div>
      {league.flex_slots > 0 && league.flex_positions.size === 0 && (
        <p className={styles.note}>FLEX slots &gt; 0 requires at least one eligible position checked.</p>
      )}

      <p className={styles.note}>No K/DST projections in this dataset -- these slots don't affect valuation.</p>
      <p className={styles.note}>Bench slots don't affect replacement level (no starter demand).</p>
    </div>
  )
}
