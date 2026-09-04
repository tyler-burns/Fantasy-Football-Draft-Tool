// Spec Section 19.6 / checklist item 31. Two separate keys so a corrupted
// or schema-changed config can never destroy an in-progress draft, and
// vice versa -- losing the draft board mid-draft is the one failure this
// app cannot afford. `storage` is dependency-injected (defaulting to
// window.localStorage) so tests use a plain in-memory fake, the same
// pattern board.ts already uses for replacementFn.

import type { ScoringState } from '../../hooks/useAppState'
import { parsePlaceholderPickId } from '../draft/placeholder'
import { PRESETS, type PresetName } from '../scoring/presets'
import { validateScoringConfig, type ScoringConfig } from '../scoring/types'
import { DEFAULT_LEAGUE, makeLeagueConfig, validateLeagueConfig, type LeagueConfig } from '../valuation/league'

export const CONFIG_KEY = 'ffv.config.v1'
export const DRAFT_KEY = 'ffv.draft.v1'
const VERSION = 1

interface PersistedLeague {
  teams: number
  qb_slots: number
  rb_slots: number
  wr_slots: number
  te_slots: number
  flex_slots: number
  flex_positions: string[] // Set -> sorted array; JSON.stringify(Set) silently yields "{}"
  dst_slots: number
  k_slots: number
  bench_slots: number
}

interface PersistedConfig {
  version: number
  scoring: { preset: PresetName | 'custom'; config: ScoringConfig }
  league: PersistedLeague
  mySlot?: number
  ignoredIds?: string[]
}

interface PersistedDraft {
  version: number
  draftedIds: string[]
}

export interface LoadedConfig {
  scoring: ScoringState
  league: LeagueConfig
  mySlot: number
  ignoredIds: string[]
  warning: string | null
}

export interface LoadedDraft {
  draftedIds: string[]
  warning: string | null
}

// Design-handoff evidence (see docs/frontend.md): the handoff's sample
// export matches this player's exact Half-PPR score computed from real
// stat lines, confirming the tool's actual league runs Half PPR.
const DEFAULT_SCORING: ScoringState = { preset: 'half_ppr', config: PRESETS.half_ppr }
const DEFAULT_MY_SLOT = 1

// DEFAULT_LEAGUE (valuation/league.ts) mirrors the Python spec's Section 14
// default verbatim and must stay untouched so the engine and its golden
// cross-language fixture stay in sync. The design handoff's own roster
// defaults carry te_slots: 0 -- a real league setting, not a spec default --
// so it's layered on as a UI-level initial value here instead.
export const INITIAL_LEAGUE: LeagueConfig = { ...DEFAULT_LEAGUE, te_slots: 0 }

function serializeLeague(league: LeagueConfig): PersistedLeague {
  return {
    teams: league.teams,
    qb_slots: league.qb_slots,
    rb_slots: league.rb_slots,
    wr_slots: league.wr_slots,
    te_slots: league.te_slots,
    flex_slots: league.flex_slots,
    flex_positions: [...league.flex_positions].sort(),
    dst_slots: league.dst_slots,
    k_slots: league.k_slots,
    bench_slots: league.bench_slots,
  }
}

export function saveConfig(
  scoring: ScoringState,
  league: LeagueConfig,
  mySlot: number,
  ignoredIds: readonly string[],
  storage: Storage = window.localStorage,
): void {
  const payload: PersistedConfig = {
    version: VERSION,
    scoring,
    league: serializeLeague(league),
    mySlot,
    ignoredIds: [...ignoredIds],
  }
  try {
    storage.setItem(CONFIG_KEY, JSON.stringify(payload))
  } catch {
    // Private-browsing / quota errors must not take down a live draft.
  }
}

function isPersistedLeagueShape(value: unknown): value is PersistedLeague {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.teams === 'number' &&
    typeof v.qb_slots === 'number' &&
    typeof v.rb_slots === 'number' &&
    typeof v.wr_slots === 'number' &&
    typeof v.te_slots === 'number' &&
    typeof v.flex_slots === 'number' &&
    Array.isArray(v.flex_positions) &&
    typeof v.dst_slots === 'number' &&
    typeof v.k_slots === 'number' &&
    typeof v.bench_slots === 'number'
  )
}

function isPersistedScoringShape(value: unknown): value is { preset: PresetName | 'custom'; config: ScoringConfig } {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.preset === 'string' && typeof v.config === 'object' && v.config !== null
}

export function loadConfig(storage: Storage = window.localStorage): LoadedConfig {
  const raw = storage.getItem(CONFIG_KEY)
  if (raw === null) {
    return { scoring: DEFAULT_SCORING, league: INITIAL_LEAGUE, mySlot: DEFAULT_MY_SLOT, ignoredIds: [], warning: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      scoring: DEFAULT_SCORING,
      league: INITIAL_LEAGUE,
      mySlot: DEFAULT_MY_SLOT,
      ignoredIds: [],
      warning: 'Saved settings could not be read and were reset.',
    }
  }

  if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== VERSION) {
    return {
      scoring: DEFAULT_SCORING,
      league: INITIAL_LEAGUE,
      mySlot: DEFAULT_MY_SLOT,
      ignoredIds: [],
      warning: 'Saved settings were an unrecognized version and were reset.',
    }
  }

  const payload = parsed as Partial<PersistedConfig>
  const warnings: string[] = []

  let scoring = DEFAULT_SCORING
  if (isPersistedScoringShape(payload.scoring) && validateScoringConfig(payload.scoring.config).length === 0) {
    scoring = { preset: payload.scoring.preset, config: payload.scoring.config }
  } else if (payload.scoring !== undefined) {
    warnings.push('Saved scoring settings were invalid and were reset.')
  }

  let league = INITIAL_LEAGUE
  if (isPersistedLeagueShape(payload.league)) {
    const candidate = { ...payload.league, flex_positions: new Set(payload.league.flex_positions) }
    if (validateLeagueConfig(candidate).length === 0) {
      league = makeLeagueConfig(candidate)
    } else {
      warnings.push('Saved league settings were invalid and were reset.')
    }
  } else if (payload.league !== undefined) {
    warnings.push('Saved league settings were invalid and were reset.')
  }

  // Absent in an old payload (pre-mySlot) -> default, no warning: this
  // field's addition must never reset an existing user's settings.
  let mySlot = DEFAULT_MY_SLOT
  if (typeof payload.mySlot === 'number' && Number.isInteger(payload.mySlot) && payload.mySlot >= 1) {
    mySlot = Math.min(payload.mySlot, league.teams)
  }

  // Same backward-compat treatment as mySlot: absent (pre-ignoredIds) or
  // malformed -> silently empty, no warning. Low stakes either way -- worst
  // case a previously-ignored player quietly reappears in the pool.
  const ignoredIds =
    Array.isArray(payload.ignoredIds) && payload.ignoredIds.every((id) => typeof id === 'string')
      ? payload.ignoredIds
      : []

  return { scoring, league, mySlot, ignoredIds, warning: warnings.length > 0 ? warnings.join(' ') : null }
}

export function saveDraft(draftedIds: readonly string[], storage: Storage = window.localStorage): void {
  const payload: PersistedDraft = { version: VERSION, draftedIds: [...draftedIds] }
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // See saveConfig.
  }
}

export function loadDraft(storage: Storage = window.localStorage): LoadedDraft {
  const raw = storage.getItem(DRAFT_KEY)
  if (raw === null) return { draftedIds: [], warning: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { draftedIds: [], warning: 'Saved draft could not be read and was reset.' }
  }

  if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== VERSION) {
    return { draftedIds: [], warning: 'Saved draft was an unrecognized version and was reset.' }
  }

  const payload = parsed as Partial<PersistedDraft>
  if (!Array.isArray(payload.draftedIds) || !payload.draftedIds.every((id) => typeof id === 'string')) {
    return { draftedIds: [], warning: 'Saved draft was malformed and was reset.' }
  }

  return { draftedIds: payload.draftedIds, warning: null }
}

/** A player_id in a saved draft may no longer exist in a refreshed
 * projections.json. The valuation layer already ignores unknown ids
 * harmlessly (board.ts's availablePlayers just filters), so nothing
 * crashes -- but the drafted panel joins ids against the pool, so stale
 * ones are pruned here with a one-line notice rather than rendering a
 * ghost row or silently keeping a phantom in the pick count. A K/DST
 * placeholder id (lib/draft/placeholder.ts) is never in `validIds` --
 * there's no projection behind it by design -- so it's exempted here
 * rather than getting pruned as "stale" on every single load. */
export function pruneStaleDraftedIds(
  draftedIds: readonly string[],
  validIds: ReadonlySet<string>,
): { kept: string[]; staleCount: number } {
  const kept = draftedIds.filter((id) => validIds.has(id) || parsePlaceholderPickId(id) !== null)
  return { kept, staleCount: draftedIds.length - kept.length }
}
