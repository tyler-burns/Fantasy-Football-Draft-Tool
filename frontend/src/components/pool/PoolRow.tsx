import type { PoolPlayer } from '../../lib/ranking/pool'
import { valueTone } from '../../lib/ranking/pool'
import { formatNumber, formatSigned } from '../../lib/format'
import { InfoIcon } from '../icons/InfoIcon'
import styles from './Pool.module.css'

interface PoolRowProps {
  readonly player: PoolPlayer
  readonly isDrafted: boolean
  readonly onDraft: (playerId: string) => void
  readonly onSelectPlayer: (playerId: string) => void
}

const VALUE_CLASS: Record<ReturnType<typeof valueTone>, string> = {
  good: styles.valueGood ?? '',
  bad: styles.valueBad ?? '',
  neutral: styles.valueNeutral ?? '',
}

export function PoolRow({ player, isDrafted, onDraft, onSelectPlayer }: PoolRowProps) {
  const p = player.projection

  return (
    <div
      className={styles.row}
      data-pos={player.position}
      data-drafted={isDrafted}
      onClick={() => {
        if (!isDrafted) onDraft(player.player_id)
      }}
    >
      <span className={styles.adpCell}>{formatNumber(player.adp, 0)}</span>
      <span className={styles.playerCell}>
        <span className={styles.playerName}>{p.name ?? '—'}</span>
        <span className={styles.playerTeam}>{p.team ?? ''}</span>
      </span>
      <span className={styles.posChip}>
        {player.position}
        {player.position_rank}
      </span>
      <span className={styles.numeric}>{formatNumber(player.points)}</span>
      <span className={`${styles.par} ${player.par !== null && player.par > 0 ? styles.parPositive : styles.parNonPositive}`}>
        {formatSigned(player.par)}
      </span>
      <span className={styles.vona}>{formatSigned(player.vona)}</span>
      <span className={`${styles.value} ${isDrafted ? styles.valueNeutral : VALUE_CLASS[valueTone(player.draft_value)]}`}>
        {isDrafted ? 'drafted' : formatSigned(player.draft_value, 0)}
      </span>
      <button
        type="button"
        className={styles.infoButton}
        aria-label={`${p.name ?? player.player_id} details`}
        onClick={(e) => {
          e.stopPropagation()
          onSelectPlayer(player.player_id)
        }}
      >
        <InfoIcon />
      </button>
    </div>
  )
}
