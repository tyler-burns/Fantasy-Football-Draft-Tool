import { useMemo, useReducer } from 'react'
import { DEFAULT_LEAGUE, type LeagueConfig } from '../lib/valuation/league'
import { PPR, type PresetName, getPreset } from '../lib/scoring/presets'
import type { ScoringConfig } from '../lib/scoring/types'

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

    case 'replaceState':
      return action.state
  }
}

/** League field updates go through the validator (mirrors makeLeagueConfig's
 * __post_init__-equivalent) so an invalid intermediate state never reaches
 * the valuation engine -- callers should catch and show the raw string
 * pattern (see components/ConfigSidebar's numeric-input handling) rather
 * than dispatching unvalidated values. */
export function useAppState(initial: AppState = INITIAL_APP_STATE) {
  const [state, dispatch] = useReducer(appReducer, initial)

  const draftedSet = useMemo(() => new Set(state.draftedIds), [state.draftedIds])

  return { state, dispatch, draftedSet }
}
