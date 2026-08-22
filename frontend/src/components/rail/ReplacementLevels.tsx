import { formatNumber } from '../../lib/format'
import styles from './Rail.module.css'

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const

interface ReplacementLevelsProps {
  readonly levels: ReadonlyMap<string, number | null>
}

export function ReplacementLevels({ levels }: ReplacementLevelsProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Replacement levels</div>
      <div className={styles.replGrid}>
        {POSITIONS.map((pos) => (
          <div key={pos} className={styles.replCell} data-pos={pos}>
            <span className={styles.replPos}>{pos}</span>
            <span className={styles.replValue}>{formatNumber(levels.get(pos) ?? null)}</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>PAR is each player's projected points above this level -- the last starter-worthy player at their position, given current roster settings.</div>
    </div>
  )
}
