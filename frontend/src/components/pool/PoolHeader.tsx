import type { PoolSort, RowFilters } from '../../lib/view/pool-rows'
import { PositionTabs } from './PositionTabs'
import { SortGroup } from './SortGroup'
import styles from './Pool.module.css'

interface PoolHeaderProps {
  readonly filters: RowFilters
  readonly onFiltersChange: (filters: RowFilters) => void
  readonly positionCounts: ReadonlyMap<string, number>
  readonly teams: readonly string[]
  readonly sort: PoolSort
  readonly onSortChange: (sort: PoolSort) => void
  readonly availableOnly: boolean
  readonly onAvailableOnlyChange: (value: boolean) => void
}

export function PoolHeader({
  filters,
  onFiltersChange,
  positionCounts,
  teams,
  sort,
  onSortChange,
  availableOnly,
  onAvailableOnlyChange,
}: PoolHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.title}>Player pool</div>
      <PositionTabs
        active={filters.position ?? ''}
        counts={positionCounts}
        onChange={(position) => onFiltersChange({ ...filters, position: position || null })}
      />
      <select
        className={styles.select}
        value={filters.team ?? ''}
        onChange={(e) => onFiltersChange({ ...filters, team: e.target.value || null })}
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        className={styles.filterInput}
        type="search"
        placeholder="Filter table…"
        value={filters.query}
        onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
        aria-label="Filter table by player or team name"
      />
      <SortGroup sort={sort} onChange={onSortChange} />
      <button
        type="button"
        className={styles.availButton}
        aria-pressed={availableOnly}
        onClick={() => onAvailableOnlyChange(!availableOnly)}
      >
        {availableOnly ? 'Available only' : 'Showing all'}
      </button>
    </header>
  )
}
