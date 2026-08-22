import { describe, expect, it } from 'vitest'
import { HALF_PPR, PPR } from '../scoring/presets'
import { DEFAULT_LEAGUE, FLEX_RB_WR } from '../valuation/league'
import {
  CONFIG_KEY,
  DRAFT_KEY,
  INITIAL_LEAGUE,
  loadConfig,
  loadDraft,
  pruneStaleDraftedIds,
  saveConfig,
  saveDraft,
} from './persistence'

class FakeStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

class ThrowingStorage implements Storage {
  length = 0
  clear(): void {}
  getItem(): string | null {
    return null
  }
  key(): string | null {
    return null
  }
  removeItem(): void {}
  setItem(): void {
    throw new Error('quota exceeded')
  }
}

describe('config round-trip', () => {
  it('round-trips scoring, league, and mySlot, including flex_positions Set<->array', () => {
    const storage = new FakeStorage()
    const scoring = { preset: 'custom' as const, config: { ...PPR, pass_td_points: 5.0 } }
    const league = { ...DEFAULT_LEAGUE, teams: 10, flex_positions: FLEX_RB_WR }

    saveConfig(scoring, league, 7, storage)
    const loaded = loadConfig(storage)

    expect(loaded.warning).toBeNull()
    expect(loaded.scoring).toEqual(scoring)
    expect(loaded.league.teams).toBe(10)
    expect(loaded.league.flex_positions).toEqual(FLEX_RB_WR)
    expect(loaded.mySlot).toBe(7)
  })

  it('flex_positions is stored as a real array, not "{}" (the Set JSON.stringify trap)', () => {
    const storage = new FakeStorage()
    saveConfig({ preset: 'ppr', config: PPR }, DEFAULT_LEAGUE, 1, storage)
    const raw = JSON.parse(storage.getItem(CONFIG_KEY)!)
    expect(Array.isArray(raw.league.flex_positions)).toBe(true)
    expect(raw.league.flex_positions.length).toBeGreaterThan(0)
  })

  it('missing key returns defaults with no warning (first visit is normal)', () => {
    const loaded = loadConfig(new FakeStorage())
    expect(loaded.warning).toBeNull()
    expect(loaded.scoring.config).toEqual(HALF_PPR)
    expect(loaded.league).toEqual(INITIAL_LEAGUE)
    expect(loaded.mySlot).toBe(1)
  })

  it('corrupt JSON falls back to defaults with a warning', () => {
    const storage = new FakeStorage()
    storage.setItem(CONFIG_KEY, '{{{not json')
    const loaded = loadConfig(storage)
    expect(loaded.warning).not.toBeNull()
    expect(loaded.scoring.config).toEqual(HALF_PPR)
  })

  it('wrong version falls back to defaults with a warning', () => {
    const storage = new FakeStorage()
    storage.setItem(CONFIG_KEY, JSON.stringify({ version: 999, scoring: {}, league: {} }))
    const loaded = loadConfig(storage)
    expect(loaded.warning).not.toBeNull()
    expect(loaded.league).toEqual(INITIAL_LEAGUE)
  })

  it('invalid scoring falls back to defaults for scoring only, league survives', () => {
    const storage = new FakeStorage()
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        version: 1,
        scoring: { preset: 'custom', config: { ...PPR, pass_yds_per_point: 0 } }, // invalid: divisor must be > 0
        league: { ...DEFAULT_LEAGUE, flex_positions: [...DEFAULT_LEAGUE.flex_positions], teams: 8 },
      }),
    )
    const loaded = loadConfig(storage)
    expect(loaded.scoring.config).toEqual(HALF_PPR) // reset
    expect(loaded.league.teams).toBe(8) // survives
    expect(loaded.warning).toContain('scoring')
  })

  it('invalid league falls back to defaults for league only, scoring survives', () => {
    const storage = new FakeStorage()
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        version: 1,
        scoring: { preset: 'ppr', config: PPR },
        league: { ...DEFAULT_LEAGUE, flex_positions: [...DEFAULT_LEAGUE.flex_positions], teams: 0 }, // invalid
      }),
    )
    const loaded = loadConfig(storage)
    expect(loaded.league).toEqual(INITIAL_LEAGUE) // reset
    expect(loaded.scoring.config).toEqual(PPR)
    expect(loaded.warning).toContain('league')
  })

  it('a throwing setItem does not propagate', () => {
    expect(() => saveConfig({ preset: 'ppr', config: PPR }, DEFAULT_LEAGUE, 1, new ThrowingStorage())).not.toThrow()
  })

  it('a payload from before mySlot existed loads with the default and no warning', () => {
    const storage = new FakeStorage()
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        version: 1,
        scoring: { preset: 'ppr', config: PPR },
        league: { ...DEFAULT_LEAGUE, flex_positions: [...DEFAULT_LEAGUE.flex_positions] },
        // no mySlot field
      }),
    )
    const loaded = loadConfig(storage)
    expect(loaded.mySlot).toBe(1)
    expect(loaded.warning).toBeNull()
  })

  it('mySlot is clamped to the loaded league.teams', () => {
    const storage = new FakeStorage()
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        version: 1,
        scoring: { preset: 'ppr', config: PPR },
        league: { ...DEFAULT_LEAGUE, teams: 8, flex_positions: [...DEFAULT_LEAGUE.flex_positions] },
        mySlot: 12,
      }),
    )
    const loaded = loadConfig(storage)
    expect(loaded.mySlot).toBe(8)
  })

  it('a non-integer or sub-1 mySlot falls back to the default', () => {
    const storage = new FakeStorage()
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        version: 1,
        scoring: { preset: 'ppr', config: PPR },
        league: { ...DEFAULT_LEAGUE, flex_positions: [...DEFAULT_LEAGUE.flex_positions] },
        mySlot: 0,
      }),
    )
    expect(loadConfig(storage).mySlot).toBe(1)
  })
})

describe('draft round-trip', () => {
  it('round-trips drafted ids in order', () => {
    const storage = new FakeStorage()
    saveDraft(['rb1', 'wr1', 'qb1'], storage)
    expect(loadDraft(storage)).toEqual({ draftedIds: ['rb1', 'wr1', 'qb1'], warning: null })
  })

  it('missing key returns an empty draft with no warning', () => {
    expect(loadDraft(new FakeStorage())).toEqual({ draftedIds: [], warning: null })
  })

  it('corrupt JSON resets with a warning', () => {
    const storage = new FakeStorage()
    storage.setItem(DRAFT_KEY, 'not json')
    const loaded = loadDraft(storage)
    expect(loaded.draftedIds).toEqual([])
    expect(loaded.warning).not.toBeNull()
  })

  it('wrong version resets with a warning', () => {
    const storage = new FakeStorage()
    storage.setItem(DRAFT_KEY, JSON.stringify({ version: 2, draftedIds: ['rb1'] }))
    const loaded = loadDraft(storage)
    expect(loaded.draftedIds).toEqual([])
    expect(loaded.warning).not.toBeNull()
  })

  it('a throwing setItem does not propagate', () => {
    expect(() => saveDraft(['rb1'], new ThrowingStorage())).not.toThrow()
  })
})

describe('pruneStaleDraftedIds', () => {
  it('removes ids not present in the current player pool', () => {
    const result = pruneStaleDraftedIds(['rb1', 'gone', 'wr1'], new Set(['rb1', 'wr1']))
    expect(result.kept).toEqual(['rb1', 'wr1'])
    expect(result.staleCount).toBe(1)
  })

  it('preserves order', () => {
    const result = pruneStaleDraftedIds(['c', 'a', 'b'], new Set(['a', 'b', 'c']))
    expect(result.kept).toEqual(['c', 'a', 'b'])
  })

  it('no stale ids -> staleCount 0', () => {
    const result = pruneStaleDraftedIds(['rb1'], new Set(['rb1']))
    expect(result.staleCount).toBe(0)
  })
})
