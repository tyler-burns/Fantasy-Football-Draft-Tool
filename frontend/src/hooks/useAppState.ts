import { useEffect, useMemo, useReducer, useState } from 'react'
import { DEFAULT_LEAGUE, type LeagueConfig } from '../lib/valuation/league'
import { PPR, type PresetName, getPreset } from '../lib/scoring/presets'
import type { ScoringConfig } from '../lib/scoring/types'
import { loadConfig, loadDraft, saveConfig, saveDraft } from '../lib/storage/persistence'

export interface ScoringState {
  readonly preset: PresetName | 'custom'
  readonly config: ScoringConfig
}

export interface AppState {
  readonly scoring: ScoringState
  readonly league: LeagueConfig
  readonly draftedIds: readonly string[] // ordered = draft order; undo is a pop
}

export const INITIAL_APP_STATE: AppState = {
  scoring: { preset: 'ppr', config: PPR },
  league: DEFAULT_LEAGUE,
  draftedIds: [],
}

export type AppAction =
  | { type: 'setPreset'; preset: PresetName }
  | { type: 'setScoringField'; field: keyof ScoringConfig; value: number }
  | { type: 'setLeagueField'; field: Exclude<keyof LeagueConfig, 'flex_positions'>; value: number }
  | { type: 'setFlexPositions'; positions: ReadonlySet<string> }
  | { type: 'draft'; playerId: string }
  | { type: 'undraft'; playerId: string }
  | { type: 'undoLastPick' }
  | { type: 'resetDraft' }
  | { type: 'resetAll' }
  | { type: 'pruneDrafted'; keptIds: readonly string[] }
  | { type: 'replaceState'; state: AppState }

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setPreset':
      return { ...state, scoring: { preset: action.preset, config: getPreset(action.preset) } }

    case 'setScoringField':
      return {
        ...state,
        scoring: { preset: 'custom', config: { ...state.scoring.config, [action.field]: action.value } },
      }

    case 'setLeagueField':
      return { ...state, league: { ...state.league, [action.field]: action.value } }

    case 'setFlexPositions':
      return { ...state, league: { ...state.league, flex_positions: action.positions } }

    case 'draft':
      if (state.draftedIds.includes(action.playerId)) return state // dedupe
      return { ...state, draftedIds: [...state.draftedIds, action.playerId] }

    case 'undraft':
      return { ...state, draftedIds: state.draftedIds.filter((id) => id !== action.playerId) }

    case 'undoLastPick':
      return { ...state, draftedIds: state.draftedIds.slice(0, -1) }

    case 'resetDraft':
      return { ...state, draftedIds: [] }

    case 'resetAll':
      return INITIAL_APP_STATE

    case 'pruneDrafted':
      return { ...state, draftedIds: action.keptIds }

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
    draftedIds: draftResult.draftedIds,
  }
  const warnings = [configResult.warning, draftResult.warning].filter((w): w is string => w !== null)
  return { state, warnings }
}

/** League/scoring field updates go through a validator at the form boundary
 * (components/NumberField) before ever reaching dispatch, so the reducer
 * itself can trust its inputs -- mirrors the Python side's constructor
 * validation without the app crashing mid-keystroke. State is persisted to
 * localStorage (see lib/storage/persistence.ts) on every change; the
 * initial value is read synchronously before first paint via useReducer's
 * lazy-init argument, so there's no flash of defaults. */
export function useAppState(storage: Storage = window.localStorage) {
  const [{ state: initialState, warnings: loadWarnings }] = useState(() => initAppState(storage))
  const [state, dispatch] = useReducer(appReducer, initialState)

  const draftedSet = useMemo(() => new Set(state.draftedIds), [state.draftedIds])

  useEffect(() => {
    saveConfig(state.scoring, state.league, storage)
  }, [state.scoring, state.league, storage])

  useEffect(() => {
    saveDraft(state.draftedIds, storage)
  }, [state.draftedIds, storage])

  return { state, dispatch, draftedSet, loadWarnings }
}
