import type { AppAction, ScoringState } from '../hooks/useAppState'
import type { PresetName } from '../lib/scoring/presets'
import { PRESETS } from '../lib/scoring/presets'
import type { ScoringConfig } from '../lib/scoring/types'
import { NumberField } from './NumberField'
import styles from './ScoringConfigForm.module.css'

const PRESET_LABELS: Record<PresetName, string> = { ppr: 'PPR', half_ppr: 'Half PPR', standard: 'Standard' }

const YARDAGE_DIVISOR_FIELDS = new Set<keyof ScoringConfig>([
  'pass_yds_per_point',
  'rush_yds_per_point',
  'rec_yds_per_point',
])

// Same wording as the Python ValueError, so a user hitting the validation
// message and a developer reading scoring/models.py see the same reasoning.
function validateWeight(field: keyof ScoringConfig, value: number): string | null {
  if (YARDAGE_DIVISOR_FIELDS.has(field) && value <= 0) {
    return 'must be > 0 -- it is a yards-per-point divisor, not a per-event weight'
  }
  return null
}

const FIELD_LABELS: Record<keyof ScoringConfig, string> = {
  pass_yds_per_point: 'Pass yards per point',
  pass_td_points: 'Pass TD',
  pass_int_points: 'Interception',
  rush_yds_per_point: 'Rush yards per point',
  rush_td_points: 'Rush TD',
  reception_points: 'Reception (PPR)',
  rec_yds_per_point: 'Rec yards per point',
  rec_td_points: 'Rec TD',
  fumble_lost_points: 'Fumble lost',
}

interface ScoringConfigFormProps {
  readonly scoring: ScoringState
  readonly dispatch: (action: AppAction) => void
}

export function ScoringConfigForm({ scoring, dispatch }: ScoringConfigFormProps) {
  return (
    <div className={styles.section}>
      <div className={styles.heading}>Scoring</div>
      <div className={styles.presets} role="radiogroup" aria-label="Scoring preset">
        {(Object.keys(PRESETS) as PresetName[]).map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={scoring.preset === name}
            className={`${styles.presetButton} ${scoring.preset === name ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'setPreset', preset: name })}
          >
            {PRESET_LABELS[name]}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={scoring.preset === 'custom'}
          className={`${styles.presetButton} ${scoring.preset === 'custom' ? styles.active : ''}`}
          disabled
        >
          Custom
        </button>
      </div>
      <div className={styles.grid}>
        {(Object.keys(FIELD_LABELS) as (keyof ScoringConfig)[]).map((field) => (
          <NumberField
            key={field}
            label={FIELD_LABELS[field]}
            value={scoring.config[field]}
            validate={(v) => validateWeight(field, v)}
            onCommit={(value) => dispatch({ type: 'setScoringField', field, value })}
          />
        ))}
      </div>
    </div>
  )
}
