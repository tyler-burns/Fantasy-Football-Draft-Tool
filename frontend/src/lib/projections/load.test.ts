// TypeScript analogue of the Python pipeline's Tier 1 canary: fails loudly
// the day the published schema and these types drift apart.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { verifySnapshot, SnapshotError } from './load'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(readFileSync(resolve(here, '../../../public/data/projections.json'), 'utf-8'))

describe('the real published projections.json', () => {
  it('parses under verifySnapshot', () => {
    expect(() => verifySnapshot(raw)).not.toThrow()
  })

  it('has the expected player count', () => {
    const snapshot = verifySnapshot(raw)
    expect(snapshot.players.length).toBe(300)
    expect(snapshot.metadata.player_count).toBe(snapshot.players.length)
  })

  it('every player is QB/RB/WR/TE', () => {
    const snapshot = verifySnapshot(raw)
    for (const p of snapshot.players) {
      expect(['QB', 'RB', 'WR', 'TE']).toContain(p.position)
    }
  })

  it('no duplicate player_id', () => {
    const snapshot = verifySnapshot(raw)
    const ids = snapshot.players.map((p) => p.player_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every stat field is finite', () => {
    const snapshot = verifySnapshot(raw)
    const statFields = [
      'pass_att', 'pass_cmp', 'pass_yds', 'pass_tds', 'pass_int',
      'rush_att', 'rush_yds', 'rush_tds',
      'receptions', 'rec_yds', 'rec_tds', 'rec_tgt',
      'fumbles_lost', 'games_proj',
    ] as const
    for (const p of snapshot.players) {
      for (const field of statFields) {
        expect(Number.isFinite(p[field]), `${field} on ${p.player_id}`).toBe(true)
      }
    }
  })
})

describe('verifySnapshot rejects malformed input', () => {
  it('non-object', () => {
    expect(() => verifySnapshot('not an object')).toThrow(SnapshotError)
  })

  it('missing metadata/players', () => {
    expect(() => verifySnapshot({})).toThrow(SnapshotError)
  })

  it('player_count mismatch', () => {
    expect(() => verifySnapshot({ metadata: { player_count: 5 }, players: [] })).toThrow(SnapshotError)
  })

  it('player missing a required field', () => {
    expect(() =>
      verifySnapshot({
        metadata: { player_count: 1 },
        players: [{ player_id: '1', name: null, position: 'QB', team: 'BUF' }],
      }),
    ).toThrow(SnapshotError)
  })
})
