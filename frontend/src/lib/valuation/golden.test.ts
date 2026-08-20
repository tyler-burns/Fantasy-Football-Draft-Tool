// Strongest available proof the TS port is faithful: replay the exact same
// scenarios src/../scripts/dump_valuation_fixture.py ran in Python, and
// assert bit-identical results. Both languages use IEEE-754 doubles and the
// snapshot's inputs are pre-rounded to 3 decimals identically for both, so
// exact equality (toBe, not approximate) is the correct bar.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Snapshot } from '../projections/types'
import { verifySnapshot } from '../projections/load'
import { STANDARD, PPR } from '../scoring/presets'
import { toScoredPlayers } from './adapter'
import { buildBoard } from './board'
import { DEFAULT_LEAGUE, FLEX_RB_WR } from './league'

interface GoldenScenario {
  replacement_levels: Record<string, number | null>
  players: Record<string, { position: string; points: number; par: number | null; vona: number | null }>
  drafted_ids?: string[]
}

interface GoldenFixture {
  default: GoldenScenario
  variant: GoldenScenario
}

const here = dirname(fileURLToPath(import.meta.url))
const snapshot: Snapshot = verifySnapshot(
  JSON.parse(readFileSync(resolve(here, '../../../public/data/projections.json'), 'utf-8')),
)
const golden: GoldenFixture = JSON.parse(readFileSync(resolve(here, '../__fixtures__/golden-board.json'), 'utf-8'))

function assertBoardMatches(board: ReturnType<typeof buildBoard>, expected: GoldenScenario) {
  for (const [position, level] of Object.entries(expected.replacement_levels)) {
    expect(board.replacement_levels.get(position) ?? null).toBe(level)
  }
  expect(board.players.length).toBe(Object.keys(expected.players).length)
  for (const pv of board.players) {
    const exp = expected.players[pv.player_id]
    expect(exp, `expected data for player ${pv.player_id}`).toBeDefined()
    expect(pv.position).toBe(exp!.position)
    expect(pv.points).toBe(exp!.points)
    expect(pv.par).toBe(exp!.par)
    expect(pv.vona).toBe(exp!.vona)
  }
}

describe('golden cross-language fixture', () => {
  it('default scenario: PPR + DEFAULT_LEAGUE, no drafts', () => {
    const pool = toScoredPlayers(snapshot.players, PPR)
    const board = buildBoard(pool, DEFAULT_LEAGUE)
    assertBoardMatches(board, golden.default)
  })

  it('variant scenario: STANDARD + 10 teams + RB/WR flex + 30 drafted', () => {
    const league = { ...DEFAULT_LEAGUE, teams: 10, flex_positions: FLEX_RB_WR }
    const drafted = new Set(golden.variant.drafted_ids ?? [])
    const pool = toScoredPlayers(snapshot.players, STANDARD)
    const board = buildBoard(pool, league, { drafted })
    assertBoardMatches(board, golden.variant)
  })
})
