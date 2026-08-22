import styles from './Rail.module.css'

interface RailHeaderProps {
  readonly leagueLine: string // "12 teams · snake · Half PPR · 15 rounds"
}

export function RailHeader({ leagueLine }: RailHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.title}>Draft Value</div>
      <div className={styles.leagueLine}>{leagueLine}</div>
    </div>
  )
}
