import { pickLabel } from '../../lib/draft/snake'
import { SLOT_LABELS, type RosterEntry } from '../../lib/draft/roster'
import styles from './Rail.module.css'

interface MyRosterProps {
  readonly entries: readonly RosterEntry[]
  readonly teams: number
  readonly filledCount: number
  readonly rounds: number
}

export function MyRoster({ entries, teams, filledCount, rounds }: MyRosterProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionLabel}>My roster</div>
        <div className={styles.sectionMeta}>
          {filledCount} / {rounds}
        </div>
      </div>
      <div className={styles.rosterList}>
        {entries.map((entry) => (
          <div key={`${entry.key}-${entry.index}`} className={styles.rosterRow} data-pos={entry.player?.position}>
            <span className={styles.rosterSlot}>{SLOT_LABELS[entry.key]}</span>
            <span className={styles.rosterNameGroup}>
              <span className={styles.rosterName}>{entry.player ? (entry.player.name ?? '—') : '—'}</span>
              {entry.player && <span className={styles.rosterTeam}>{entry.player.team ?? ''}</span>}
            </span>
            <span className={styles.rosterPick}>{entry.pickIndex !== null ? pickLabel(entry.pickIndex, teams) : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
