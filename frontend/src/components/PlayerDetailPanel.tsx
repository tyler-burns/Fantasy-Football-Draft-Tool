import { Fragment, useEffect } from 'react'
import { formatNumber, formatSigned } from '../lib/format'
import type { RankedPlayer } from '../lib/ranking/modes'
import type { PlayerProjection } from '../lib/projections/types'
import { scoreBreakdown } from '../lib/scoring/calculator'
import type { ScoringConfig } from '../lib/scoring/types'
import styles from './PlayerDetailPanel.module.css'

interface PlayerDetailPanelProps {
  readonly projection: PlayerProjection
  readonly scoringConfig: ScoringConfig
  readonly ranked: RankedPlayer | undefined
  readonly onClose: () => void
}

function opSymbol(op: 'div' | 'mul'): string {
  return op === 'div' ? '÷' : '×'
}

function signedClass(value: number | null): string {
  if (value === null) return ''
  if (value > 0) return styles.positive ?? ''
  if (value < 0) return styles.negative ?? ''
  return ''
}

/** Spec Section 19.5: "Show the arithmetic, not just the total." A
 * right-hand slide-in panel rather than a modal or route -- keeps the table
 * interactive underneath for comparison during a live draft. */
export function PlayerDetailPanel({ projection: p, scoringConfig, ranked, onClose }: PlayerDetailPanelProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { terms, total } = scoreBreakdown(p, scoringConfig)
  const nonZeroTerms = terms.filter((t) => t.statValue !== 0)

  const hasPassing = p.pass_att !== 0 || p.pass_yds !== 0 || p.pass_tds !== 0 || p.pass_int !== 0
  const hasRushing = p.rush_att !== 0 || p.rush_yds !== 0 || p.rush_tds !== 0
  const hasReceiving = p.receptions !== 0 || p.rec_yds !== 0 || p.rec_tds !== 0 || p.rec_tgt !== 0

  return (
    <aside className={styles.panel} role="dialog" aria-label={`${p.name ?? p.player_id} detail`}>
      <div className={styles.closeRow}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.identity}>
        <h2>{p.name ?? p.player_id}</h2>
        <p>
          {p.position ?? '—'}, {p.team ?? '—'}
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.heading}>Projected Stats</div>
        {hasPassing && (
          <div className={styles.statLine}>
            <span className={styles.statLabel}>Passing:</span>
            {formatNumber(p.pass_att, 0)} att, {formatNumber(p.pass_cmp, 0)} cmp, {formatNumber(p.pass_yds, 0)} yds,{' '}
            {formatNumber(p.pass_tds, 1)} TD, {formatNumber(p.pass_int, 1)} INT
          </div>
        )}
        {hasRushing && (
          <div className={styles.statLine}>
            <span className={styles.statLabel}>Rushing:</span>
            {formatNumber(p.rush_att, 0)} att, {formatNumber(p.rush_yds, 0)} yds, {formatNumber(p.rush_tds, 1)} TD
          </div>
        )}
        {hasReceiving && (
          <div className={styles.statLine}>
            <span className={styles.statLabel}>Receiving:</span>
            {formatNumber(p.receptions, 1)} rec, {formatNumber(p.rec_tgt, 1)} tgt, {formatNumber(p.rec_yds, 0)} yds,{' '}
            {formatNumber(p.rec_tds, 1)} TD
          </div>
        )}
        <div className={styles.statLine}>
          <span className={styles.statLabel}>Games:</span>
          {formatNumber(p.games_proj, 1)}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.total}>Fantasy Points: {formatNumber(total)}</div>
        {nonZeroTerms.length === 0 ? (
          <p className={styles.termLabel}>No scored stats.</p>
        ) : (
          <div className={styles.breakdown}>
            {nonZeroTerms.map((t) => (
              <Fragment key={t.key}>
                <span className={styles.termLabel}>{t.label}</span>
                <span className={styles.termArithmetic}>
                  {formatNumber(t.statValue, t.op === 'div' ? 0 : 1)} {opSymbol(t.op)} {t.weightValue}
                </span>
                <span className={styles.termPoints}>= {formatNumber(t.points)}</span>
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.heading}>Valuation</div>
        <div className={styles.valuationGrid}>
          <div>
            PAR: <span className={signedClass(ranked?.par ?? null)}>{formatSigned(ranked?.par ?? null)}</span>
          </div>
          <div>
            VONA: <span className={signedClass(ranked?.vona ?? null)}>{formatSigned(ranked?.vona ?? null)}</span>
          </div>
          <div>Position Rank: {ranked ? `${ranked.position}${ranked.position_rank}` : '—'}</div>
          <div>Overall Rank: {ranked ? ranked.overall_rank : '—'}</div>
        </div>
      </div>
    </aside>
  )
}
