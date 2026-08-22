import type { PoolPlayer } from '../../lib/ranking/pool'
import { PoolRow } from './PoolRow'
import styles from './Pool.module.css'

interface PoolTableProps {
  readonly players: readonly PoolPlayer[]
  readonly draftedIds: ReadonlySet<string>
  readonly onDraft: (playerId: string) => void
  readonly onSelectPlayer: (playerId: string) => void
}

export function PoolTable({ players, draftedIds, onDraft, onSelectPlayer }: PoolTableProps) {
  return (
    <div className={styles.scroll}>
      <div className={styles.tableHeader}>
        <span>ADP</span>
        <span>Player</span>
        <span className={styles.alignRight}>Pos</span>
        <span className={styles.alignRight}>Proj</span>
        <span className={styles.alignRight}>PAR</span>
        <span className={styles.alignRight}>VONA</span>
        <span className={styles.alignRight}>Value</span>
        <span />
      </div>
      {players.length === 0 ? (
        <div className={styles.empty}>No players match the current filters.</div>
      ) : (
        players.map((player) => (
          <PoolRow
            key={player.player_id}
            player={player}
            isDrafted={draftedIds.has(player.player_id)}
            onDraft={onDraft}
            onSelectPlayer={onSelectPlayer}
          />
        ))
      )}
    </div>
  )
}
