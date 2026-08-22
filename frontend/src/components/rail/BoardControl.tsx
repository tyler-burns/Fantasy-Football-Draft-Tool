import styles from './Rail.module.css'

interface BoardControlProps {
  readonly canUndo: boolean
  readonly canReset: boolean
  readonly onUndo: () => void
  readonly onResetDraft: () => void
  readonly onResetAll: () => void
}

export function BoardControl({ canUndo, canReset, onUndo, onResetDraft, onResetAll }: BoardControlProps) {
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
      <button type="button" className={styles.ghostButtonMuted} onClick={onResetAll}>
        Reset all settings
      </button>
    </div>
  )
}
