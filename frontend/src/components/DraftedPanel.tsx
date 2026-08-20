import type { PlayerProjection } from '../lib/projections/types'
import styles from './DraftedPanel.module.css'

interface DraftedPanelProps {
  readonly draftedIds: readonly string[] // in draft order
  readonly projectionsById: ReadonlyMap<string, PlayerProjection>
  readonly onUndraft: (playerId: string) => void
  readonly onUndoLastPick: () => void
}

/** Satisfies spec Section 18's "provide undo/un-draft" requirement.
 * Rendered in draft order (pick 1 first) -- undo removes the most recent
 * pick regardless of any table sort/filter state. */
export function DraftedPanel({ draftedIds, projectionsById, onUndraft, onUndoLastPick }: DraftedPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>
        <span>Drafted ({draftedIds.length})</span>
        <button type="button" className={styles.undo} onClick={onUndoLastPick} disabled={draftedIds.length === 0}>
          Undo last pick
        </button>
      </div>
      {draftedIds.length === 0 ? (
        <p className={styles.empty}>No players drafted yet.</p>
      ) : (
        <ol className={styles.list}>
          {draftedIds.map((id) => {
            const projection = projectionsById.get(id)
            return (
              <li key={id} className={styles.item}>
                <span>
                  {projection ? `${projection.name} (${projection.position} ${projection.team ?? '—'})` : id}
                </span>
                <button type="button" className={styles.remove} onClick={() => onUndraft(id)} aria-label={`Undraft ${projection?.name ?? id}`}>
                  ✕
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
