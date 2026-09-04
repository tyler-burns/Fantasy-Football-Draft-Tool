import type { CSSProperties } from 'react'
import type { BoardGridRow, TeamColumn } from '../../lib/draft/view'
import { formatNumber } from '../../lib/format'
import { cellState } from './boardCellState'
import styles from './Board.module.css'

interface BoardGridProps {
  readonly teamColumns: readonly TeamColumn[]
  readonly gridRows: readonly BoardGridRow[]
}

export function BoardGrid({ teamColumns, gridRows }: BoardGridProps) {
  const gridTemplateColumns: CSSProperties = {
    gridTemplateColumns: `38px repeat(${teamColumns.length}, minmax(124px, 1fr))`,
  }

  return (
    <div className={styles.gridWrap}>
      <div className={styles.gridHeaderRow} style={gridTemplateColumns}>
        <div className={styles.gridCorner}>RD</div>
        {teamColumns.map((t) => (
          <div key={t.slot} className={styles.gridTeamHeader}>
            <span className={styles.gridTeamSlot}>{t.slotLabel}</span>
            <span className={styles.gridTeamName} data-mine={t.mine}>
              {t.name}
            </span>
          </div>
        ))}
      </div>

      {gridRows.map((row) => (
        <div key={row.round} className={styles.gridRow} style={gridTemplateColumns}>
          <div className={styles.gridRoundCell}>{row.round}</div>
          {row.cells.map((cell) => (
            <div key={cell.pickIndex} className={styles.gridCell} data-pos={cell.player?.position} data-state={cellState(cell)}>
              <div className={styles.gridCellMeta}>
                <span className={styles.gridCellNum}>{cell.label}</span>
                {cell.player && (
                  <span className={styles.gridCellPos}>
                    {cell.player.position}
                    {!cell.player.isPlaceholder && !cell.player.isIgnored && cell.player.position_rank}
                  </span>
                )}
              </div>
              <span className={styles.gridCellName}>
                {cell.player ? (cell.player.name ?? '—') : cell.onClock ? 'On the clock' : ''}
              </span>
              {cell.player && !cell.player.isPlaceholder && (
                <span className={styles.gridCellSub}>
                  {cell.player.team ?? ''}
                  {!cell.player.isIgnored && ` · ${formatNumber(cell.player.points)}`}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
