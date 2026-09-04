import type { PlayerProjection } from '../../lib/projections/types'
import styles from './Rail.module.css'

interface IgnoredPlayersProps {
  readonly ignoredIds: readonly string[]
  readonly projectionsById: ReadonlyMap<string, PlayerProjection>
  readonly onUnignore: (playerId: string) => void
}

/** The only way back for a player marked ignored via PlayerDetailPanel --
 * once ignored, they no longer have a Player pool row to reopen the detail
 * panel from, so this list (name/team/restore) is their sole remaining
 * surface. Hidden entirely when empty, same as NoticeStrip. */
export function IgnoredPlayers({ ignoredIds, projectionsById, onUnignore }: IgnoredPlayersProps) {
  if (ignoredIds.length === 0) return null

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Ignored players</div>
      <div className={styles.ignoredList}>
        {ignoredIds.map((id) => {
          const projection = projectionsById.get(id)
          return (
            <div key={id} className={styles.ignoredRow} data-pos={projection?.position ?? undefined}>
              <span className={styles.ignoredNameGroup}>
                <span className={styles.ignoredName}>{projection?.name ?? id}</span>
                {projection?.team && <span className={styles.rosterTeam}>{projection.team}</span>}
              </span>
              <button type="button" className={styles.restoreButton} onClick={() => onUnignore(id)}>
                Restore
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
