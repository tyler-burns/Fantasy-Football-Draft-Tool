import styles from './Rail.module.css'

const FLEX_ELIGIBLE_POSITIONS = ['RB', 'WR', 'TE'] as const

interface FlexChipsProps {
  readonly flexPositions: ReadonlySet<string>
  readonly onToggle: (position: string) => void
}

export function FlexChips({ flexPositions, onToggle }: FlexChipsProps) {
  return (
    <div className={styles.flexRow}>
      <span className={styles.flexLabel}>FLEX eligible</span>
      {FLEX_ELIGIBLE_POSITIONS.map((pos) => (
        <button
          key={pos}
          type="button"
          className={styles.flexChip}
          data-pos={pos}
          aria-pressed={flexPositions.has(pos)}
          onClick={() => onToggle(pos)}
        >
          {pos}
        </button>
      ))}
    </div>
  )
}
