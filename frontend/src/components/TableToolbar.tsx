import { RANKING_MODES, RANKING_MODE_LABELS, type RankingMode } from '../lib/ranking/modes'
import type { RowFilters } from '../lib/view/rows'
import styles from './TableToolbar.module.css'

interface TableToolbarProps {
  readonly rankingMode: RankingMode
  readonly onRankingModeChange: (mode: RankingMode) => void
  readonly filters: RowFilters
  readonly onFiltersChange: (filters: RowFilters) => void
  readonly positions: readonly string[]
  readonly teams: readonly string[]
}

export function TableToolbar({
  rankingMode,
  onRankingModeChange,
  filters,
  onFiltersChange,
  positions,
  teams,
}: TableToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <label>
        Rank by{' '}
        <select value={rankingMode} onChange={(e) => onRankingModeChange(e.target.value as RankingMode)}>
          {RANKING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {RANKING_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Position{' '}
        <select
          value={filters.position ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, position: e.target.value || null })}
        >
          <option value="">All</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label>
        Team{' '}
        <select
          value={filters.team ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, team: e.target.value || null })}
        >
          <option value="">All</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <input
        className={styles.query}
        type="search"
        placeholder="Filter table…"
        value={filters.query}
        onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
        aria-label="Filter table by player or team name"
      />
    </div>
  )
}
