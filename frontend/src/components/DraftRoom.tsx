import type { ReactNode } from 'react'
import styles from './DraftRoom.module.css'

interface DraftRoomProps {
  readonly rail: ReactNode
  readonly board: ReactNode
  readonly pool: ReactNode
}

/** The three-pane shell: a fixed-width settings rail, and a main column
 * split into the Board (top) and Player pool (bottom). Pure layout --
 * every pane owns its own scroller, per the handoff's explicit layout
 * constraints. */
export function DraftRoom({ rail, board, pool }: DraftRoomProps) {
  return (
    <div className={styles.root}>
      <aside className={styles.rail}>{rail}</aside>
      <main className={styles.main}>
        {board}
        {pool}
      </main>
    </div>
  )
}
