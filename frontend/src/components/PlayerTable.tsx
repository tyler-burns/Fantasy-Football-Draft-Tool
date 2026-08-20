import type { RankedPlayer } from '../lib/ranking/modes'
import type { SortColumn, SortState } from '../lib/view/rows'
import { PlayerRow } from './PlayerRow'
import styles from './PlayerTable.module.css'

interface ColumnDef {
  readonly key: SortColumn | null // null = not sortable (Player, Team, Pos)
  readonly label: string
}

function columns(valueLabel: string): ColumnDef[] {
  return [
    { key: 'overall_rank', label: 'Rank' },
    { key: null, label: 'Player' },
    { key: null, label: 'Team' },
    { key: null, label: 'Pos' },
    { key: 'points', label: 'Proj Pts' },
    { key: 'par', label: 'PAR' },
    { key: 'vona', label: 'VONA' },
    { key: 'adp', label: 'ADP' },
    { key: 'value', label: valueLabel },
  ]
}

interface PlayerTableProps {
  readonly rows: readonly RankedPlayer[]
  readonly sort: SortState
  readonly valueLabel: string
  readonly onSortChange: (sort: SortState) => void
}

export function PlayerTable({ rows, sort, valueLabel, onSortChange }: PlayerTableProps) {
  function handleHeaderClick(column: SortColumn) {
    if (sort.column === column) {
      onSortChange({ column, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      // Rank/ADP feel natural ascending by default; every numeric metric
      // feels natural descending (best first).
      onSortChange({ column, direction: column === 'overall_rank' || column === 'adp' ? 'asc' : 'desc' })
    }
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns(valueLabel).map((col) => {
              const isActive = col.key !== null && sort.column === col.key
              const ariaSort = isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
              return (
                <th
                  key={col.label}
                  className={col.key ? `sortable ${isActive ? styles.active : ''}` : ''}
                  aria-sort={ariaSort}
                  onClick={col.key ? () => handleHeaderClick(col.key!) : undefined}
                >
                  {col.label}
                  {isActive ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <PlayerRow key={player.player_id} player={player} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className={styles.empty}>No players match the current filters.</div>}
    </div>
  )
}
