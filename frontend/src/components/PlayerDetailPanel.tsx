import { Fragment, useEffect } from 'react'
import { formatNumber, formatSigned } from '../lib/format'
import type { PoolPlayer } from '../lib/ranking/pool'
import { valueTone } from '../lib/ranking/pool'
import { scoreBreakdown } from '../lib/scoring/calculator'
import type { ScoringConfig } from '../lib/scoring/types'
import { Blueprint } from './Blueprint'
import styles from './PlayerDetailPanel.module.css'

interface PlayerDetailPanelProps {
  readonly player: PoolPlayer
  readonly isDrafted: boolean
  readonly scoringConfig: ScoringConfig
  readonly onClose: () => void
}

function opSymbol(op: 'div' | 'mul'): string {
  return op === 'div' ? '÷' : '×'
}

const VALUE_CLASS: Record<ReturnType<typeof valueTone>, string> = {
  good: styles.valueGood ?? '',
  bad: styles.valueBad ?? '',
  neutral: styles.valueNeutral ?? '',
}

/** Spec Section 19.5: "Show the arithmetic, not just the total." A
 * right-hand slide-in panel rather than a modal or route -- keeps the board
 * and pool interactive underneath for comparison during a live draft.
 * Opened from a pool row's info-icon affordance (new in the Draft Room
 * redesign -- the handoff's own screens have no such panel). */
export function PlayerDetailPanel({ player, isDrafted, scoringConfig, onClose }: PlayerDetailPanelProps) {
  const p = player.projection

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
    <Blueprint className={styles.panel ?? ''}>
      <aside role="dialog" aria-label={`${p.name ?? p.player_id} detail`} data-pos={player.position}>
        <div className={styles.closeRow}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.identity}>
          <h2 className={styles.name}>{p.name ?? p.player_id}</h2>
          <p className={styles.meta}>
            <span className={styles.posChip}>
              {player.position}
              {player.position_rank}
            </span>
            {p.team ?? '—'}
            {isDrafted && <span className={styles.draftedTag}>drafted</span>}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.heading}>Projected stats</div>
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
          <div className={styles.total}>Fantasy points: {formatNumber(total)}</div>
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
              PAR <span className={styles.valuationValue}>{formatSigned(player.par)}</span>
            </div>
            <div>
              VONA <span className={styles.valuationValue}>{formatSigned(player.vona)}</span>
            </div>
            <div>
              Position rank <span className={styles.valuationValue}>{player.position_rank}</span>
            </div>
            <div>
              Value{' '}
              <span className={`${styles.valuationValue} ${isDrafted ? styles.valueNeutral : VALUE_CLASS[valueTone(player.draft_value)]}`}>
                {isDrafted ? 'drafted' : formatSigned(player.draft_value, 0)}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </Blueprint>
  )
}
