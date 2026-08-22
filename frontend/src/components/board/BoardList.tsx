import type { BoardListRound } from '../../lib/draft/view'
import { formatNumber } from '../../lib/format'
import { cellState } from './boardCellState'
import styles from './Board.module.css'

interface BoardListProps {
  readonly listRounds: readonly BoardListRound[]
}

export function BoardList({ listRounds }: BoardListProps) {
  return (
    <div className={styles.listPad}>
      {listRounds.map((round) => (
        <div key={round.round}>
          <div className={styles.listRoundHeader}>
            <span className={styles.listRoundLabel}>{round.label}</span>
            <span className={styles.listRoundMeta}>
              {round.logged} of {round.teams} logged
            </span>
          </div>
          {round.rows.map((row) => (
            <div key={row.pickIndex} className={styles.listRow} data-pos={row.player?.position} data-state={cellState(row)}>
              <span className={styles.listNum}>
                {row.overallLabel} {row.label}
              </span>
              <span className={styles.listTeamName} data-mine={row.mine}>
                {row.teamName}
              </span>
              <span className={styles.listPos}>
                {row.player ? `${row.player.position}${row.player.isPlaceholder ? '' : row.player.position_rank}` : ''}
              </span>
              <span className={styles.listName}>
                {row.player ? (row.player.name ?? '—') : row.onClock ? 'On the clock' : '—'}
              </span>
              <span className={styles.listMeta}>
                {row.player && !row.player.isPlaceholder ? `${row.player.team ?? ''} · ADP ${formatNumber(row.player.adp, 0)}` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
