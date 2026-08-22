import { useEffect, useMemo, useState } from 'react'
import styles from './components/DraftRoom.module.css'
import boardStyles from './components/board/Board.module.css'
import poolStyles from './components/pool/Pool.module.css'
import railStyles from './components/rail/Rail.module.css'
import { DraftRoom } from './components/DraftRoom'
import { BoardHeader, type BoardMode } from './components/board/BoardHeader'
import { PoolHeader } from './components/pool/PoolHeader'
import { PoolTable } from './components/pool/PoolTable'
import { BoardControl } from './components/rail/BoardControl'
import { NoticeStrip } from './components/rail/NoticeStrip'
import { RailHeader } from './components/rail/RailHeader'
import { useAppState } from './hooks/useAppState'
import { usePlayerPool } from './hooks/usePlayerPool'
import { clockState } from './lib/draft/view'
import { draftShape } from './lib/draft/snake'
import { loadSnapshot, SnapshotError } from './lib/projections/load'
import type { PlayerProjection, Snapshot } from './lib/projections/types'
import type { PresetName } from './lib/scoring/presets'
import { pruneStaleDraftedIds } from './lib/storage/persistence'
import { DEFAULT_FILTERS, DEFAULT_SORT, type PoolSort, type RowFilters } from './lib/view/pool-rows'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; snapshot: Snapshot }

const NO_PLAYERS: readonly PlayerProjection[] = []

const PRESET_LABELS: Record<PresetName | 'custom', string> = {
  ppr: 'PPR',
  half_ppr: 'Half PPR',
  standard: 'Standard',
  custom: 'Custom',
}

function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const { state, dispatch, draftedSet, loadWarnings } = useAppState()
  const [filters, setFilters] = useState<RowFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<PoolSort>(DEFAULT_SORT)
  const [availableOnly, setAvailableOnly] = useState(true)
  const [boardMode, setBoardMode] = useState<BoardMode>('grid')
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
  // ids harmlessly, but the pool joins against real projections -- prune
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

  const clockIndex = state.draftedIds.length

  const pool = usePlayerPool(
    players,
    state.scoring.config,
    state.league,
    draftedSet,
    clockIndex,
    filters,
    sort,
    availableOnly,
  )

  const teams = useMemo(
    () => [...new Set(players.map((p) => p.team).filter((t): t is string => t !== null))].sort(),
    [players],
  )

  const shape = useMemo(() => draftShape(state.league), [state.league])
  const clock = useMemo(
    () => clockState({ picks: state.draftedIds, shape, mySlot: state.mySlot, playersById: pool.boardPlayersById }),
    [state.draftedIds, shape, state.mySlot, pool.boardPlayersById],
  )

  const leagueLine = `${state.league.teams} teams · snake · ${PRESET_LABELS[state.scoring.preset]} · ${shape.rounds} rounds`

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

  return (
    <DraftRoom
      rail={
        <>
          <RailHeader leagueLine={leagueLine} />
          <div className={railStyles.scroll}>
            <NoticeStrip notices={notices} onDismiss={(i) => setNotices((prev) => prev.filter((_, j) => j !== i))} />
            <BoardControl
              canUndo={state.draftedIds.length > 0}
              canReset={state.draftedIds.length > 0}
              onUndo={() => dispatch({ type: 'undoLastPick' })}
              onResetDraft={() => dispatch({ type: 'resetDraft' })}
              onResetAll={() => dispatch({ type: 'resetAll' })}
            />
          </div>
        </>
      }
      board={
        <section className={boardStyles.pane}>
          <BoardHeader mode={boardMode} onModeChange={setBoardMode} clockLabel={clock.label} />
          <div className={boardStyles.body}>The Board arrives in Sitting 3</div>
        </section>
      }
      pool={
        <section className={poolStyles.pane}>
          <PoolHeader
            filters={filters}
            onFiltersChange={setFilters}
            positionCounts={pool.positionCounts}
            teams={teams}
            sort={sort}
            onSortChange={setSort}
            availableOnly={availableOnly}
            onAvailableOnlyChange={setAvailableOnly}
          />
          <PoolTable players={pool.rows} draftedIds={draftedSet} onDraft={(id) => dispatch({ type: 'draft', playerId: id })} />
        </section>
      }
    />
  )
}

export default App
