import styles from './Board.module.css'

export type BoardMode = 'grid' | 'list'

interface BoardHeaderProps {
  readonly mode: BoardMode
  readonly onModeChange: (mode: BoardMode) => void
  readonly clockLabel: string
}

export function BoardHeader({ mode, onModeChange, clockLabel }: BoardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.title}>The Board</div>
      <div className={styles.modeToggle}>
        <button type="button" className={styles.modeButton} aria-pressed={mode === 'grid'} onClick={() => onModeChange('grid')}>
          Grid
        </button>
        <button type="button" className={styles.modeButton} aria-pressed={mode === 'list'} onClick={() => onModeChange('list')}>
          List
        </button>
      </div>
      <div className={styles.spacer} />
      <div className={styles.clockPlate}>
        <span className={styles.clockLabel}>On the clock</span>
        <span className={styles.clockValue}>{clockLabel}</span>
      </div>
    </header>
  )
}
