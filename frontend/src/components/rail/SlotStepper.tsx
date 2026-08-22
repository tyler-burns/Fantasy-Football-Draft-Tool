import type { RosterSlotKey } from '../../lib/draft/roster'
import styles from './Rail.module.css'

interface SlotStepperProps {
  readonly slotKey: RosterSlotKey
  readonly label: string
  readonly count: number
  readonly onInc: () => void
  readonly onDec: () => void
}

export function SlotStepper({ slotKey, label, count, onInc, onDec }: SlotStepperProps) {
  return (
    <div className={styles.slotRow} data-pos={slotKey}>
      <span className={styles.slotKey}>{label}</span>
      <span className={styles.slotDivider} />
      <button type="button" className={styles.slotBtn} onClick={onDec} aria-label={`Decrease ${label}`}>
        –
      </button>
      <span className={styles.slotCount}>{count}</span>
      <button type="button" className={styles.slotBtn} onClick={onInc} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}
