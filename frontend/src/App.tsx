import { useEffect, useState } from 'react'
import { loadSnapshot, SnapshotError } from './lib/projections/load'
import type { Snapshot } from './lib/projections/types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; snapshot: Snapshot }

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadSnapshot()
      .then((snapshot) => {
        if (!cancelled) setState({ status: 'loaded', snapshot })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof SnapshotError ? err.message : String(err)
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <p style={{ padding: 24 }}>Loading projections…</p>
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: 24 }}>
        <h1>Couldn't load projections</h1>
        <p>{state.message}</p>
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

  const { metadata } = state.snapshot
  return (
    <div style={{ padding: 24 }}>
      <h1>Fantasy Football Draft Value</h1>
      <p>
        {metadata.season} · {metadata.source}/{metadata.projection_company ?? 'unknown'} ·{' '}
        {metadata.player_count} players · generated {metadata.generated_at}
      </p>
    </div>
  )
}

export default App
