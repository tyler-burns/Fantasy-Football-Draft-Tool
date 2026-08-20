import { useEffect, useMemo, useState } from 'react'
import styles from './App.module.css'
import { LeagueConfigForm } from './components/LeagueConfigForm'
import { PlayerTable } from './components/PlayerTable'
import { ReplacementLevelsPanel } from './components/ReplacementLevelsPanel'
import { ScoringConfigForm } from './components/ScoringConfigForm'
import { TableToolbar } from './components/TableToolbar'
import { INITIAL_APP_STATE, useAppState } from './hooks/useAppState'
import { useValuationBoards } from './hooks/useValuationBoards'
import type { RankingMode } from './lib/ranking/modes'
import { loadSnapshot, SnapshotError } from './lib/projections/load'
import type { PlayerProjection, Snapshot } from './lib/projections/types'
import { DEFAULT_FILTERS, DEFAULT_SORT, type RowFilters, type SortState } from './lib/view/rows'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; snapshot: Snapshot }

const NO_PLAYERS: readonly PlayerProjection[] = []

function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const { state, dispatch, draftedSet } = useAppState(INITIAL_APP_STATE)
  const [rankingMode, setRankingMode] = useState<RankingMode>('vona') // spec 19.4: default to VONA
  const [filters, setFilters] = useState<RowFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT) // spec 19.3: available sorted by VONA

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
  const boards = useValuationBoards(players, state.scoring.config, state.league, draftedSet, rankingMode, filters, sort)

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter((p): p is string => p !== null))].sort(),
    [players],
  )
  const teams = useMemo(
    () => [...new Set(players.map((p) => p.team).filter((t): t is string => t !== null))].sort(),
    [players],
  )

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
        <h1>Fantasy Football Draft Value</h1>
        <p className={styles.meta}>
          {metadata.season} · {metadata.source}/{metadata.projection_company ?? 'unknown'} ·{' '}
          {metadata.player_count} players · generated {metadata.generated_at}
        </p>
      </header>

      <aside className={styles.sidebar}>
        <ReplacementLevelsPanel levels={boards.fullBoard.replacement_levels} />
        <ScoringConfigForm scoring={state.scoring} dispatch={dispatch} />
        <LeagueConfigForm league={state.league} dispatch={dispatch} />
      </aside>

      <main className={styles.main}>
        <TableToolbar
          rankingMode={rankingMode}
          onRankingModeChange={setRankingMode}
          filters={filters}
          onFiltersChange={setFilters}
          positions={positions}
          teams={teams}
        />
        <PlayerTable rows={boards.rows} sort={sort} valueLabel={valueLabel} onSortChange={setSort} />
      </main>
    </div>
  )
}

export default App
