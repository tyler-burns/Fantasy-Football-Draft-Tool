import type { RankedPlayer } from '../lib/ranking/modes'
import { formatNumber, formatRank, formatSigned } from '../lib/format'
import styles from './PlayerTable.module.css'

interface PlayerRowProps {
  readonly player: RankedPlayer
}

function signedClass(value: number | null): string {
  if (value === null) return ''
  if (value > 0) return styles.positive ?? ''
  if (value < 0) return styles.negative ?? ''
  return ''
}

export function PlayerRow({ player }: PlayerRowProps) {
  const p = player.projection
  return (
    <tr>
      <td className={styles.numeric}>{formatRank(player.overall_rank)}</td>
      <td>{p.name ?? '—'}</td>
      <td>{p.team ?? '—'}</td>
      <td>{player.position}</td>
      <td className={styles.numeric}>{formatNumber(player.points)}</td>
      <td className={`${styles.numeric} ${signedClass(player.par)}`}>{formatSigned(player.par)}</td>
      <td className={`${styles.numeric} ${signedClass(player.vona)}`}>{formatSigned(player.vona)}</td>
      <td className={styles.numeric}>{formatNumber(player.adp, 0)}</td>
      <td className={`${styles.numeric} ${signedClass(player.value)}`}>{formatSigned(player.value)}</td>
    </tr>
  )
}
