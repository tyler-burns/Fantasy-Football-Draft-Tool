import { useEffect, useMemo, useReducer, useState } from 'react'
import { totalPicks as computeTotalPicks, draftShape } from '../lib/draft/snake'
import { LEAGUE_FIELD_FOR_SLOT, type RosterSlotKey } from '../lib/draft/roster'
import { type LeagueConfig } from '../lib/valuation/league'
import { getPreset, type PresetName } from '../lib/scoring/presets'
import type { ScoringConfig } from '../lib/scoring/types'
import { INITIAL_LEAGUE, loadConfig, loadDraft, saveConfig, saveDraft } from '../lib/storage/persistence'

export interface ScoringState {
  readonly preset: PresetName | 'custom'
  readonly config: ScoringConfig
}

export interface AppState {
  readonly scoring: ScoringState
  readonly league: LeagueConfig
  readonly mySlot: number // 1-based, 1..league.teams
  readonly draftedIds: readonly string[] // ordered = draft order; undo is a pop
  // Real players excluded from scoring/valuation entirely -- an injury or
  // suspension the projection source hasn't caught up with. Independent of
  // draftedIds (a player can be ignored and never drafted, or drafted then
  // later flagged) and survives 'resetDraft' -- real-world injury status
  // doesn't change just because a mock draft gets reset -- but not
  // 'resetAll', which is a genuine fresh start.
  readonly ignoredIds: readonly string[]
}

const TEAM_OPTIONS = [8, 10, 12, 14] as const

export type AppAction =
  | { type: 'setPreset'; preset: PresetName }
  | { type: 'setScoringField'; field: keyof ScoringConfig; value: number }
  | { type: 'setTeams'; teams: (typeof TEAM_OPTIONS)[number] }
  | { type: 'setMySlot'; slot: number }
  | { type: 'bumpSlot'; key: RosterSlotKey; delta: 1 | -1 }
  | { type: 'toggleFlexPosition'; position: string }
  | { type: 'draft'; playerId: string }
  | { type: 'undoLastPick' }
  | { type: 'resetDraft' }
  | { type: 'resetAll' }
  | { type: 'pruneDrafted'; keptIds: readonly string[] }
  | { type: 'ignorePlayer'; playerId: string }
  | { type: 'unignorePlayer'; playerId: string }
  | { type: 'replaceState'; state: AppState }

function appReducer(state: AppState, action: AppAction, initial: AppState): AppState {
  switch (action.type) {
    case 'setPreset':
      return { ...state, scoring: { preset: action.preset, config: getPreset(action.preset) } }

    case 'setScoringField':
      return {
        ...state,
        scoring: { preset: 'custom', config: { ...state.scoring.config, [action.field]: action.value } },
      }

    case 'setTeams':
      // Team count is the denominator of every pick's derived ownership;
      // keeping stale picks would silently reassign them to different
      // teams. Clamp mySlot into range and clear the draft.
      return {
        ...state,
        league: { ...state.league, teams: action.teams },
        mySlot: Math.min(state.mySlot, action.teams),
        draftedIds: [],
      }

    case 'setMySlot':
      return { ...state, mySlot: Math.max(1, Math.min(action.slot, state.league.teams)) }

    case 'bumpSlot': {
      const field = LEAGUE_FIELD_FOR_SLOT[action.key]
      const next = Math.max(0, Math.min(9, state.league[field] + action.delta))
      return { ...state, league: { ...state.league, [field]: next } }
    }

    case 'toggleFlexPosition': {
      const current = state.league.flex_positions
      const next = new Set(current)
      if (next.has(action.position)) next.delete(action.position)
      else next.add(action.position)
      // Refuse to leave FLEX slots with no eligible position -- a FLEX slot
      // nobody can fill is always a configuration mistake, never intent
      // (mirrors LeagueConfig's own validation rule).
      if (state.league.flex_slots > 0 && next.size === 0) return state
      return { ...state, league: { ...state.league, flex_positions: next } }
    }

    case 'draft': {
      if (state.draftedIds.includes(action.playerId)) return state // dedupe
      const shape = draftShape(state.league)
      if (state.draftedIds.length >= computeTotalPicks(shape)) return state // draft already complete
      return { ...state, draftedIds: [...state.draftedIds, action.playerId] }
    }

    case 'undoLastPick':
      return { ...state, draftedIds: state.draftedIds.slice(0, -1) }

    case 'resetDraft':
      return { ...state, draftedIds: [] }

    case 'resetAll':
      return initial

    case 'pruneDrafted':
      return { ...state, draftedIds: action.keptIds }

    case 'ignorePlayer':
      if (state.ignoredIds.includes(action.playerId)) return state // dedupe
      return { ...state, ignoredIds: [...state.ignoredIds, action.playerId] }

    case 'unignorePlayer':
      return { ...state, ignoredIds: state.ignoredIds.filter((id) => id !== action.playerId) }

    case 'replaceState':
      return action.state
  }
}

function initAppState(storage: Storage): { state: AppState; warnings: string[] } {
  const configResult = loadConfig(storage)
  const draftResult = loadDraft(storage)
  const state: AppState = {
    scoring: configResult.scoring,
    league: configResult.league,
    mySlot: configResult.mySlot,
    draftedIds: draftResult.draftedIds,
    ignoredIds: configResult.ignoredIds,
  }
  const warnings = [configResult.warning, draftResult.warning].filter((w): w is string => w !== null)
  return { state, warnings }
}

export const INITIAL_APP_STATE: AppState = {
  scoring: { preset: 'half_ppr', config: getPreset('half_ppr') },
  league: INITIAL_LEAGUE,
  mySlot: 1,
  draftedIds: [],
  ignoredIds: [],
}

/** League/scoring field updates that need free-form validation (numeric
 * inputs) go through the form boundary (components/rail's NumberField-style
 * fields) before ever reaching dispatch; bumpSlot/setTeams/setMySlot here
 * are all pre-constrained by their own UI (steppers, a fixed-option
 * select), so the reducer can trust its inputs without re-validating. State
 * is persisted to localStorage on every change; the initial value is read
 * synchronously before first paint via a lazy useState initializer, so
 * there's no flash of defaults. */
export function useAppState(storage: Storage = window.localStorage) {
  const [{ state: initialState, warnings: loadWarnings }] = useState(() => initAppState(storage))
  const [state, dispatch] = useReducer(
    (s: AppState, action: AppAction) => appReducer(s, action, INITIAL_APP_STATE),
    initialState,
  )

  const draftedSet = useMemo(() => new Set(state.draftedIds), [state.draftedIds])
  const ignoredSet = useMemo(() => new Set(state.ignoredIds), [state.ignoredIds])

  useEffect(() => {
    saveConfig(state.scoring, state.league, state.mySlot, state.ignoredIds, storage)
  }, [state.scoring, state.league, state.mySlot, state.ignoredIds, storage])

  useEffect(() => {
    saveDraft(state.draftedIds, storage)
  }, [state.draftedIds, storage])

  return { state, dispatch, draftedSet, ignoredSet, loadWarnings }
}

export { TEAM_OPTIONS }
