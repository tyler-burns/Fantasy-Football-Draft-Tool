import type { Snapshot } from './types'

export class SnapshotError extends Error {}

/** Runtime shape check mirroring src/fantasy_value/snapshot.py's
 * verify_snapshot -- the published JSON is trusted to have already passed
 * that check server-side, but the frontend re-checks it defensively rather
 * than trusting an arbitrary fetch response blindly (spec Section 25: this
 * file is the one thing the app depends on at load). */
export function verifySnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null) {
    throw new SnapshotError('snapshot is not a JSON object')
  }
  const obj = value as Record<string, unknown>
  const metadata = obj.metadata
  const players = obj.players
  if (typeof metadata !== 'object' || metadata === null || !Array.isArray(players)) {
    throw new SnapshotError('snapshot missing metadata/players')
  }
  const meta = metadata as Record<string, unknown>
  if (meta.player_count !== players.length) {
    throw new SnapshotError(
      `metadata.player_count (${String(meta.player_count)}) != players.length (${players.length})`,
    )
  }
  for (const player of players) {
    const p = player as Record<string, unknown>
    if (!p.player_id || !p.name || !p.position || !p.team) {
      throw new SnapshotError(`published player missing a required field: ${JSON.stringify(player)}`)
    }
  }
  return obj as unknown as Snapshot
}

const DATA_URL = `${import.meta.env.BASE_URL}data/projections.json`

/** Fetched at runtime (not bundled) -- see docs/frontend.md for why. No
 * retry loop, no silent fallback: a failure here must be visible, not
 * papered over, since it's the app's only data source. */
export async function loadSnapshot(): Promise<Snapshot> {
  let response: Response
  try {
    response = await fetch(DATA_URL)
  } catch (cause) {
    throw new SnapshotError(`failed to fetch ${DATA_URL}: ${String(cause)}`)
  }
  if (!response.ok) {
    throw new SnapshotError(`GET ${DATA_URL} returned HTTP ${response.status}`)
  }
  const body: unknown = await response.json()
  return verifySnapshot(body)
}
