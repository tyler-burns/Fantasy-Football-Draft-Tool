import { useEffect, useMemo, useState } from 'react'
import styles from './App.module.css'
import { DraftedPanel } from './components/DraftedPanel'
import { DraftSearch } from './components/DraftSearch'
import { LeagueConfigForm } from './components/LeagueConfigForm'
import { PlayerDetailPanel } from './components/PlayerDetailPanel'
import { PlayerTable } from './components/PlayerTable'
import { ReplacementLevelsPanel } from './components/ReplacementLevelsPanel'
import { ScoringConfigForm } from './components/ScoringConfigForm'
import { TableToolbar } from './components/TableToolbar'
import { useAppState } from './hooks/useAppState'
import type { Availability } from './hooks/useValuationBoards'
import { useValuationBoards } from './hooks/useValuationBoards'
import type { RankingMode } from './lib/ranking/modes'
import { loadSnapshot, SnapshotError } from './lib/projections/load'
import type { PlayerProjection, Snapshot } from './lib/projections/types'
import { pruneStaleDraftedIds } from './lib/storage/persistence'
import { DEFAULT_FILTERS, DEFAULT_SORT, type RowFilters, type SortState } from './lib/view/rows'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; snapshot: Snapshot }

const NO_PLAYERS: readonly PlayerProjection[] = []

function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const { state, dispatch, draftedSet, loadWarnings } = useAppState()
  const [rankingMode, setRankingMode] = useState<RankingMode>('vona') // spec 19.4: default to VONA
  const [filters, setFilters] = useState<RowFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT) // spec 19.3: available sorted by VONA
  const [availability, setAvailability] = useState<Availability>('available')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [notices, setNotices] = useState<string[]>(loadWarnings)
  const [prunedStale, setPrunedStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) setLoadState({ status: 'loaded', snapshot })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof SnapshotError ? err.message : String(err)
        setLoadState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const players = loadState.status === 'loaded' ? loadState.snapshot.players : NO_PLAYERS

  // A drafted player_id from a previous session may no longer exist in a
  // refreshed projections.json. The valuation layer already ignores unknown
  // ids harmlessly, but the drafted panel joins against the pool -- prune
  // once, with a notice, rather than rendering a ghost row.
  useEffect(() => {
    if (loadState.status !== 'loaded' || prunedStale) return
    const validIds = new Set(players.map((p) => p.player_id))
    const { kept, staleCount } = pruneStaleDraftedIds(state.draftedIds, validIds)
    if (staleCount > 0) {
      dispatch({ type: 'pruneDrafted', keptIds: kept })
      setNotices((prev) => [
        ...prev,
        `${staleCount} previously drafted player${staleCount === 1 ? '' : 's'} ${staleCount === 1 ? "isn't" : "aren't"} in the current projection set and ${staleCount === 1 ? 'was' : 'were'} cleared.`,
      ])
    }
    setPrunedStale(true)
  }, [loadState.status, players, state.draftedIds, prunedStale, dispatch])
  const boards = useValuationBoards(
    players,
    state.scoring.config,
    state.league,
    draftedSet,
    rankingMode,
    filters,
    sort,
    availability,
  )

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter((p): p is string => p !== null))].sort(),
    [players],
  )
  const teams = useMemo(
    () => [...new Set(players.map((p) => p.team).filter((t): t is string => t !== null))].sort(),
    [players],
  )

  const selectedRanked = useMemo(() => {
    if (!selectedPlayerId) return undefined
    return (
      boards.rankedAvailable.find((p) => p.player_id === selectedPlayerId) ??
      boards.rankedDrafted.find((p) => p.player_id === selectedPlayerId)
    )
  }, [selectedPlayerId, boards.rankedAvailable, boards.rankedDrafted])
  const selectedProjection = selectedPlayerId ? boards.projectionsById.get(selectedPlayerId) : undefined

  function toggleDraft(playerId: string) {
    if (draftedSet.has(playerId)) dispatch({ type: 'undraft', playerId })
    else dispatch({ type: 'draft', playerId })
  }

  if (loadState.status === 'loading') {
    return <p className={styles.centered}>Loading projections…</p>
  }

  if (loadState.status === 'error') {
    return (
      <div className={styles.centered}>
        <h1>Couldn't load projections</h1>
        <p>{loadState.message}</p>
        <p>
          Run the pipeline and copy its output, then reload:
          <br />
          <code>.\.venv\Scripts\python scripts\build_dataset.py</code>
          <br />
          <code>npm run sync-data</code>
        </p>
      </div>
    )
  }

  const { metadata } = loadState.snapshot
  const valueLabel = `Value (${rankingMode.replace('_', ' ')})`

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1>Fantasy Football Draft Value</h1>
          <p className={styles.meta}>
            {metadata.season} · {metadata.source}/{metadata.projection_company ?? 'unknown'} ·{' '}
            {metadata.player_count} players · generated {metadata.generated_at}
          </p>
        </div>
        <DraftSearch players={players} draftedSet={draftedSet} onDraft={(id) => dispatch({ type: 'draft', playerId: id })} />
      </header>

      {notices.length > 0 && (
        <div className={styles.notices}>
          {notices.map((notice, i) => (
            <div key={`${i}-${notice}`} className={styles.notice}>
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotices((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <aside className={styles.sidebar}>
        <DraftedPanel
          draftedIds={state.draftedIds}
          projectionsById={boards.projectionsById}
          onUndraft={(id) => dispatch({ type: 'undraft', playerId: id })}
          onUndoLastPick={() => dispatch({ type: 'undoLastPick' })}
        />
        <ReplacementLevelsPanel levels={boards.fullBoard.replacement_levels} />
        <ScoringConfigForm scoring={state.scoring} dispatch={dispatch} />
        <LeagueConfigForm league={state.league} dispatch={dispatch} />
        <button type="button" className={styles.resetAll} onClick={() => dispatch({ type: 'resetAll' })}>
          Reset all settings
        </button>
      </aside>

      <main className={styles.main}>
        <TableToolbar
          rankingMode={rankingMode}
          onRankingModeChange={setRankingMode}
          filters={filters}
          onFiltersChange={setFilters}
          positions={positions}
          teams={teams}
          availability={availability}
          onAvailabilityChange={setAvailability}
        />
        <PlayerTable
          rows={boards.rows}
          sort={sort}
          valueLabel={valueLabel}
          draftedSet={draftedSet}
          onSortChange={setSort}
          onToggleDraft={toggleDraft}
          onSelectPlayer={setSelectedPlayerId}
        />
      </main>

      {selectedProjection && (
        <PlayerDetailPanel
          projection={selectedProjection}
          scoringConfig={state.scoring.config}
          ranked={selectedRanked}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  )
}

export default App
