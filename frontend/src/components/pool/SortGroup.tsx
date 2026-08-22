import { POOL_SORTS, type PoolSort } from '../../lib/view/pool-rows'
import styles from './Pool.module.css'

const LABELS: Record<PoolSort, string> = { adp: 'ADP', vona: 'VONA', par: 'PAR' }

interface SortGroupProps {
  readonly sort: PoolSort
  readonly onChange: (sort: PoolSort) => void
}

export function SortGroup({ sort, onChange }: SortGroupProps) {
  return (
    <div className={styles.sortGroup}>
      {POOL_SORTS.map((s) => (
        <button key={s} type="button" className={styles.sortButton} aria-pressed={sort === s} onClick={() => onChange(s)}>
          {LABELS[s]}
        </button>
      ))}
    </div>
  )
}
