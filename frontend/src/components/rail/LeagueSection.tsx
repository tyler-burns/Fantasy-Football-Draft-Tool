import styles from './Rail.module.css'

const TEAM_OPTIONS = [8, 10, 12, 14] as const

interface LeagueSectionProps {
  readonly teams: number
  readonly mySlot: number
  readonly onTeamsChange: (teams: (typeof TEAM_OPTIONS)[number]) => void
  readonly onMySlotChange: (slot: number) => void
}

export function LeagueSection({ teams, mySlot, onTeamsChange, onMySlotChange }: LeagueSectionProps) {
  const slotOptions = Array.from({ length: teams }, (_, i) => i + 1)

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>League</div>
      <div className={styles.twoCol}>
        <label className={styles.fieldLabel}>
          Teams
          <select
            className={styles.select}
            value={teams}
            onChange={(e) => onTeamsChange(Number(e.target.value) as (typeof TEAM_OPTIONS)[number])}
          >
            {TEAM_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          My draft slot
          <select className={styles.select} value={mySlot} onChange={(e) => onMySlotChange(Number(e.target.value))}>
            {slotOptions.map((s) => (
              <option key={s} value={s}>
                #{s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
