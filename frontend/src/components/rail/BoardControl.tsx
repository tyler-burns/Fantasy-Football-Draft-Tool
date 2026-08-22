import styles from './Rail.module.css'

interface BoardControlProps {
  readonly canUndo: boolean
  readonly canReset: boolean
  readonly canLogPlaceholder: boolean
  readonly onUndo: () => void
  readonly onResetDraft: () => void
  readonly onResetAll: () => void
  readonly onLogPlaceholder: (position: 'K' | 'DST') => void
}

export function BoardControl({
  canUndo,
  canReset,
  canLogPlaceholder,
  onUndo,
  onResetDraft,
  onResetAll,
  onLogPlaceholder,
}: BoardControlProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Board control</div>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.ghostButton} onClick={onUndo} disabled={!canUndo}>
          Undo pick
        </button>
        <button type="button" className={styles.ghostButton} onClick={onResetDraft} disabled={!canReset}>
          Reset draft
        </button>
      </div>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.ghostButton}
          data-pos="K"
          onClick={() => onLogPlaceholder('K')}
          disabled={!canLogPlaceholder}
        >
          Log K taken
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          data-pos="DST"
          onClick={() => onLogPlaceholder('DST')}
          disabled={!canLogPlaceholder}
        >
          Log DST taken
        </button>
      </div>
      <div className={styles.note}>
        No K/DST projections in this dataset -- logs the pick as a placeholder so the pick count stays right.
      </div>
      <button type="button" className={styles.ghostButtonMuted} onClick={onResetAll}>
        Reset all settings
      </button>
    </div>
  )
}
