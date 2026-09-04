import { useRef, useState } from 'react'
import type { PlayerProjection } from '../lib/projections/types'
import { searchProjections } from '../lib/search'
import styles from './DraftSearch.module.css'

interface DraftSearchProps {
  readonly players: readonly PlayerProjection[] // all players, so drafted matches are still visible
  readonly draftedSet: ReadonlySet<string>
  readonly ignoredSet: ReadonlySet<string>
  readonly onDraft: (playerId: string) => void
}

/** The live-draft flow (spec 19.1): type a few letters, hit Enter, the
 * highlighted player is drafted immediately. Searches the full player list
 * (not just available) so a mistyped duplicate pick is visibly a duplicate
 * -- already-drafted matches render greyed out with a tag rather than being
 * hidden, and selecting one is a no-op. Ignored (injured/suspended) players
 * stay fully searchable and draftable here -- excluded from everyone else's
 * valuation, not from the real draft log -- just tagged so a pick doesn't
 * happen by surprise. */
export function DraftSearch({ players, draftedSet, ignoredSet, onDraft }: DraftSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = searchProjections(players, query)

  function draft(player: PlayerProjection) {
    if (draftedSet.has(player.player_id)) return
    onDraft(player.player_id)
    setQuery('')
    setOpen(false)
    setHighlighted(0)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      return
    }
    if (matches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Prefer the highlighted entry; fall back to the first draftable match.
      const candidate = matches[highlighted] ?? matches.find((p) => !draftedSet.has(p.player_id))
      if (candidate) draft(candidate)
    }
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        placeholder="Draft a player…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="Draft a player by name"
      />
      {open && query.trim() !== '' && (
        <div className={styles.dropdown}>
          {matches.length === 0 && <div className={styles.empty}>No matches</div>}
          {matches.map((player, i) => {
            const drafted = draftedSet.has(player.player_id)
            const ignored = ignoredSet.has(player.player_id)
            return (
              <div
                key={player.player_id}
                className={`${styles.option} ${i === highlighted ? styles.highlighted : ''} ${drafted ? styles.disabled : ''}`}
                onMouseDown={(e) => e.preventDefault()} // keep focus on the input through the click
                onClick={() => draft(player)}
              >
                <span>
                  {player.name} · {player.position} {player.team}
                </span>
                {drafted ? <span className={styles.tag}>drafted</span> : ignored ? <span className={styles.tag}>ignored</span> : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
