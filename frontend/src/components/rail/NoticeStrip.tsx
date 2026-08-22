import styles from './Rail.module.css'

interface NoticeStripProps {
  readonly notices: readonly string[]
  readonly onDismiss: (index: number) => void
}

/** Storage/stale-pick warnings. The design handoff has no slot for this --
 * it's moved into the rail's scrollable section list, right after the
 * header, so it's visible without competing with the board/pool for space. */
export function NoticeStrip({ notices, onDismiss }: NoticeStripProps) {
  if (notices.length === 0) return null
  return (
    <div className={styles.section}>
      {notices.map((notice, i) => (
        <div key={`${i}-${notice}`} className={styles.notice}>
          <span>{notice}</span>
          <button type="button" onClick={() => onDismiss(i)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
