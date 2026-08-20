import { formatNumber } from '../lib/format'
import styles from './ReplacementLevelsPanel.module.css'

const DISPLAY_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const

interface ReplacementLevelsPanelProps {
  readonly levels: ReadonlyMap<string, number | null>
}

export function ReplacementLevelsPanel({ levels }: ReplacementLevelsPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>Replacement levels</div>
      <div className={styles.list}>
        {DISPLAY_POSITIONS.map((position) => (
          <div className={styles.row} key={position}>
            <span>{position}</span>
            <span className={styles.value}>{formatNumber(levels.get(position) ?? null)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
