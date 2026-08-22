import styles from './Pool.module.css'

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'] as const

interface PositionTabsProps {
  readonly active: string // '' means ALL (matches RowFilters.position === null semantics upstream)
  readonly counts: ReadonlyMap<string, number> // '' key = ALL total
  readonly onChange: (position: string) => void
}

export function PositionTabs({ active, counts, onChange }: PositionTabsProps) {
  return (
    <div className={styles.tabGroup}>
      {POSITIONS.map((pos) => {
        const key = pos === 'ALL' ? '' : pos
        const isActive = active === key
        return (
          <button
            key={pos}
            type="button"
            className={styles.tab}
            data-pos={pos}
            aria-pressed={isActive}
            onClick={() => onChange(key)}
          >
            {pos}
            <span className={styles.tabCount}>{counts.get(key) ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
