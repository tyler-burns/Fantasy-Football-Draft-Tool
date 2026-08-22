import type { PresetName } from '../../lib/scoring/presets'
import type { ScoringConfig } from '../../lib/scoring/types'
import styles from './Rail.module.css'

const PRESET_BUTTONS: readonly { readonly name: PresetName; readonly label: string }[] = [
  { name: 'ppr', label: 'PPR' },
  { name: 'half_ppr', label: 'Half PPR' },
  { name: 'standard', label: 'Std' },
]

const FIELD_META: readonly { readonly key: keyof ScoringConfig; readonly label: string; readonly step: number }[] = [
  { key: 'pass_yds_per_point', label: 'Pass yd/pt', step: 1 },
  { key: 'pass_td_points', label: 'Pass TD', step: 0.5 },
  { key: 'pass_int_points', label: 'Interception', step: 0.5 },
  { key: 'rush_yds_per_point', label: 'Rush yd/pt', step: 1 },
  { key: 'rush_td_points', label: 'Rush TD', step: 0.5 },
  { key: 'reception_points', label: 'Reception', step: 0.5 },
  { key: 'rec_yds_per_point', label: 'Rec yd/pt', step: 1 },
  { key: 'rec_td_points', label: 'Rec TD', step: 0.5 },
  { key: 'fumble_lost_points', label: 'Fumble lost', step: 0.5 },
]

interface ScoringSectionProps {
  readonly preset: PresetName | 'custom'
  readonly config: ScoringConfig
  readonly onPresetChange: (preset: PresetName) => void
  readonly onFieldChange: (field: keyof ScoringConfig, value: number) => void
}

export function ScoringSection({ preset, config, onPresetChange, onFieldChange }: ScoringSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Scoring</div>
      <div className={styles.presetGroup}>
        {PRESET_BUTTONS.map((p) => (
          <button
            key={p.name}
            type="button"
            className={styles.presetButton}
            aria-pressed={preset === p.name}
            onClick={() => onPresetChange(p.name)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.fieldGrid}>
        {FIELD_META.map((f) => (
          <label key={f.key} className={styles.numberField}>
            {f.label}
            <input
              className={styles.numberInput}
              type="number"
              step={f.step}
              value={config[f.key]}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : Number(e.target.value)
                if (Number.isFinite(value)) onFieldChange(f.key, value)
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
