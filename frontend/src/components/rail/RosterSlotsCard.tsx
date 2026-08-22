import { Blueprint } from '../Blueprint'
import { ROSTER_SLOT_KEYS, rosterSlotCounts, SLOT_LABELS, type RosterSlotKey } from '../../lib/draft/roster'
import type { LeagueConfig } from '../../lib/valuation/league'
import { FlexChips } from './FlexChips'
import { SlotStepper } from './SlotStepper'
import styles from './Rail.module.css'

interface RosterSlotsCardProps {
  readonly league: LeagueConfig
  readonly rounds: number
  readonly onBumpSlot: (key: RosterSlotKey, delta: 1 | -1) => void
  readonly onToggleFlexPosition: (position: string) => void
}

export function RosterSlotsCard({ league, rounds, onBumpSlot, onToggleFlexPosition }: RosterSlotsCardProps) {
  const counts = rosterSlotCounts(league)

  return (
    <Blueprint className={styles.slotCard ?? ''}>
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionLabel}>Roster slots</div>
        <div className={styles.sectionMeta}>{rounds} rounds</div>
      </div>
      <div className={styles.slotList}>
        {ROSTER_SLOT_KEYS.map((key) => (
          <SlotStepper
            key={key}
            slotKey={key}
            label={SLOT_LABELS[key]}
            count={counts[key]}
            onInc={() => onBumpSlot(key, 1)}
            onDec={() => onBumpSlot(key, -1)}
          />
        ))}
      </div>
      <FlexChips flexPositions={league.flex_positions} onToggle={onToggleFlexPosition} />
      <div className={styles.note}>
        Bench slots don't affect replacement level. The source set carries no K/DST projections, so those slots don't
        affect valuation.
      </div>
    </Blueprint>
  )
}
