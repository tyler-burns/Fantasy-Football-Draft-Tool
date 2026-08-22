import styles from './Rail.module.css'

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const

export function PositionKey() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Position key</div>
      <div className={styles.legendRow}>
        {POSITIONS.map((pos) => (
          <span key={pos} className={styles.legendChip} data-pos={pos}>
            {pos}
          </span>
        ))}
      </div>
    </div>
  )
}
