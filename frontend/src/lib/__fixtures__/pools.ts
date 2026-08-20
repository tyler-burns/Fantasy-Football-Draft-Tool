// Port of tests/valuation_fixtures.py. Not a test module itself -- imported
// by test files.

import { makeScoredPlayer, type ScoredPlayer } from '../valuation/models'

export function player(
  playerId: string,
  position: string,
  points: number,
  eligible: readonly string[] = [],
): ScoredPlayer {
  return makeScoredPlayer({ player_id: playerId, position, points, eligible_positions: eligible })
}

export function rbTrio(): ScoredPlayer[] {
  // Spec Section 17.1's exact required case.
  return [player('rb1', 'RB', 250.0), player('rb2', 'RB', 225.0), player('rb3', 'RB', 220.0)]
}

function curve(prefix: string, position: string, count: number, start: number, step: number): ScoredPlayer[] {
  const players: ScoredPlayer[] = []
  for (let i = 1; i <= count; i++) {
    players.push(player(`${prefix}${i}`, position, start - step * (i - 1)))
  }
  return players
}

export type TeCurve = 'steep' | 'flat'

/** Canonical worked-example pool (30 QB / 40 RB / 40 WR / 20 TE) with
 * distinct, non-colliding point curves so no tie-break is load-bearing.
 * The Python fixture shuffles with a fixed seed to prove order-independence
 * -- not reproducible in JS and not needed: build unshuffled, and assert
 * order-independence explicitly (pool vs. [...pool].reverse()) instead. */
export function makePool(options: { teCurve?: TeCurve } = {}): ScoredPlayer[] {
  const { teCurve = 'steep' } = options

  const qb = curve('qb', 'QB', 30, 300.0, 5.0) // QB1=300 ... QB13=240
  const rb = curve('rb', 'RB', 40, 250.0, 4.0) // RB1=250 ... RB25=154
  const wr = curve('wr', 'WR', 40, 241.0, 4.0) // WR1=241 ... WR25=145

  let te: ScoredPlayer[]
  if (teCurve === 'steep') {
    te = curve('te', 'TE', 20, 300.0, 12.0) // TE1=300 ... TE13=156
  } else if (teCurve === 'flat') {
    te = curve('te', 'TE', 20, 200.0, 8.0) // TE1=200 ... TE13=104
  } else {
    throw new Error(`unknown teCurve ${JSON.stringify(teCurve)}`)
  }

  return [...qb, ...rb, ...wr, ...te]
}
