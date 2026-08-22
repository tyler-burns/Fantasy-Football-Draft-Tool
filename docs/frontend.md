# Frontend

React + TypeScript + Vite, deployed as a static site (spec Section 19). Everything
— scoring, replacement level, PAR, VONA, filtering, the snake-draft board, roster
fill, persistence — runs in the browser. There is no backend at request time; the
frontend reads the same `data/processed/projections.json` the Python pipeline
publishes and never calls an API.

The UI is the **Draft Room**: a three-pane layout (settings rail, a live
multi-team snake-draft Board, and a Player pool) built from a separate
Claude-Code-designed high-fidelity handoff, ported onto this app's existing,
tested scoring/valuation engine. See "The Draft Room" below.

## Running it

```powershell
cd frontend
npm install          # first time only
npm run dev          # copies data, starts Vite dev server
npm test              # copies data, runs the Vitest suite once
npm run test:watch    # Vitest in watch mode
npm run build          # copies data, type-checks, production build to dist/
npm run lint            # oxlint
```

`npm run sync-data` (run automatically by the above) copies
`data/processed/projections.json` into `public/data/` — it fails loudly if the
Python pipeline hasn't been run yet (`.\.venv\Scripts\python scripts\build_dataset.py`
from the repo root).

## Why this is a port, not a client for the Python backend

Spec Section 19: "All scoring and valuation runs in the browser." The Phase 2/3
Python engines (`src/fantasy_value/scoring/`, `src/fantasy_value/valuation/`) are
therefore mirrored file-for-file in `src/lib/`, not called over a network. The
Python `PlayerProjection`/`ScoringConfig`/`ScoredPlayer` types were kept
schema-independent specifically so this port could be mechanical.

| Python | TypeScript |
|---|---|
| `scoring/models.py` (`ScoringConfig`) | `lib/scoring/types.ts` |
| `scoring/calculator.py` (`score_projection`) | `lib/scoring/calculator.ts` (+ `terms.ts`, the shared term table both the scalar and breakdown functions consume) |
| `scoring/presets.py` | `lib/scoring/presets.ts` |
| `valuation/league.py` | `lib/valuation/league.ts` |
| `valuation/models.py` | `lib/valuation/models.ts` |
| `valuation/replacement.py` | `lib/valuation/replacement.ts` |
| `valuation/par.py` | `lib/valuation/par.ts` |
| `valuation/vona.py` | `lib/valuation/vona.ts` |
| `valuation/board.py` | `lib/valuation/board.ts` |
| `valuation/adapter.py` | `lib/valuation/adapter.ts` |
| (no Python equivalent -- live-draft UI concepts) | `lib/ranking/pool.ts`, `lib/draft/snake.ts`, `lib/draft/view.ts`, `lib/draft/roster.ts` |

Faithfulness on the ported half is checked two ways: every exact-value Python
test case (the 344.0/220.0 scoring worked examples, the 240/110/109/108
replacement-level example, the Section 17.1 VONA case) is ported verbatim, and a
**golden cross-language fixture** (`scripts/dump_valuation_fixture.py` +
`lib/valuation/golden.test.ts`) asserts the TS pipeline reproduces a real
300-player Python run bit-for-bit across two different scoring/league
configurations.

## The Draft Room

The UI's provenance is a separate design tool's high-fidelity handoff (a
`.dc.html` prototype + stylesheet), read as an oracle for layout and
interaction — never imported as code, and never using its own placeholder
`players.js` dataset or approximate point-scaling formula. Its own README says
as much: replace both with "a true recompute" once a real projection source
exists, which it already did here.

**Design system** (`src/theme.css`, `components/Blueprint.tsx`): a dark-only
"Industry" token set (Barlow Condensed for headings, Barlow for body,
square-cornered "blueprint" framing with corner registration marks) mapped onto
semantic aliases (`--ground`/`--panel`/`--hairline`/`--ink`/`--ink-dim`/`--accent`)
so component CSS never touches the raw Industry names. Position colors are one
`data-pos` attribute driving `color-mix()`-derived tints (`--pos-tint`,
`--pos-tint-row`, `--pos-tint-list`, `--pos-tint-hover`) rather than
precomputed hex-alpha constants — used identically by the Board's cells, the
Pool's rows, the rail's roster/replacement cards, and the detail panel.

**Layout** (`components/DraftRoom.tsx`): a fixed 316px rail beside a main
column split into the Board (top) and Player pool (bottom). Every pane owns
its own scroller (`min-height: 0` / `overflow: hidden` throughout) — these
were real bugs in early handoff iterations the handoff's own comments warn
against reintroducing.

**Snake draft** (`lib/draft/snake.ts`, pure): the only new stored state is
`mySlot` (1-based) and `league.teams`. Which team owns a given overall pick,
what round it's in, and whether it's "my" pick are all *derived* from the
pick's index in `draftedIds` — never stored redundantly. `lib/draft/view.ts`
turns that into the Board's two render modes (Grid: round × team; List:
grouped by round) plus the "on the clock" state, consumed via the memoized
`hooks/useDraftBoard.ts`.

**My roster** (`lib/draft/roster.ts`'s `fillRoster`, pure): walks a team's
picks in draft order, placing each into its own position's first empty slot,
else the first empty eligible FLEX slot, else the first empty bench slot. A
pick that fits nowhere (every matching slot already full) simply doesn't
appear on the roster card — it's still on the Board.

**Player pool Value column**: superseded the earlier ranking-mode abstraction
(`lib/ranking/modes.ts`, deleted) with the handoff's own, simpler, live-draft
semantics in `lib/ranking/pool.ts`: `Value = ADP − (current overall pick)`.
Position ranks (`RB12`-style chips) are computed once, over the **full**
player pool, so a drafted player's rank never renumbers as the draft
progresses — the same full-pool-stability property `board.ts`'s replacement
levels already relied on, now shared by `computePositionRanks`.

**Player detail panel** (`components/PlayerDetailPanel.tsx`): a Section-19.5
requirement ("show the arithmetic, not just the total") the handoff's own
screens don't have — kept from the pre-redesign UI, restyled to the new
system, and re-pointed at a `PoolPlayer` instead of the deleted ranking
abstraction. Opened via a small info-icon button on each pool row (a new
affordance, separate from the row's own click-to-draft target so opening the
panel never drafts the player).

## State management

No state library. `useReducer` (`hooks/useAppState.ts`; persisted domain
state: scoring config, league config incl. `teams`/`mySlot`, ordered
drafted-id list) + `useState` (ephemeral UI: pool filters/sort/availableOnly,
Board mode, selected player) + `useMemo` (the derived score → board → pool →
filter/sort pipeline, in `hooks/usePlayerPool.ts`; the snake/Board layout
derivation, in `hooks/useDraftBoard.ts`). A full recompute over ~300 players
is on the order of 10⁴ elementary operations, sub-millisecond in V8 —
rendering dominates.

Two boards are computed on every recompute: a **full-pool** board (drafted
state ignored) and an **available-pool** board. Replacement levels are
identical between them (both derive from the same full player pool); they
differ only in which players are listed. This is what makes PAR (and now
position rank) stable across a draft while VONA and the pool's Value column
are the metrics that move with every pick — worked through in
`lib/valuation/board.ts`'s docstring, and pinned by `board.test.ts`'s
"PAR/VONA byte-identical after a top-prefix draft" property.

Changing team count is the one rail control that can silently corrupt data
(team count is the denominator of every pick's derived ownership), so it's
gated behind a plain `window.confirm()` when a draft is in progress before
the reducer clears `draftedIds` and clamps `mySlot`. Every other control is
freely reversible via Undo pick / Reset draft / Reset all settings.

## Persistence (spec 19.6)

Two independent `localStorage` keys — `ffv.config.v1` (scoring + league +
`mySlot`) and `ffv.draft.v1` (ordered drafted player ids) — so a corrupted or
schema-changed config can never destroy an in-progress draft. Projections
data is never persisted; it's always re-fetched fresh. See
`lib/storage/persistence.ts`. `mySlot`'s addition to the config payload is
backward-compatible: absent in an old payload, it silently defaults rather
than triggering a reset warning.

**Versioning: no migrations, by design (documented risk).** The version is
bumped only on a genuinely incompatible schema change; an unrecognized
version resets that key's section to defaults. A user mid-draft when a
schema change ships would lose their config (never their draft — the two
keys are independent). Mitigated by a visible "Reset all settings" button
rather than engineered around, since this is a POC. A stale drafted `player_id`
(absent from a refreshed `projections.json`) is pruned once on load with a
dismissible notice — the valuation layer already tolerates unknown ids
harmlessly, but the pool needs real projections to join against.

## Offline capability (spec Section 25)

The app fetches `data/projections.json` at load rather than bundling it, so
refreshing the dataset needs no rebuild. This satisfies the spec's actual
guarantee ("after the snapshot is downloaded, the app works with no internet
connection") on the same terms a bundled copy would — a cold load with no
network can't proceed either way, since the JS bundle itself needs
downloading. A genuine offline-first reload (no network, page already
visited) would need a service worker or explicit cache headers; that is a
deliberate deployment-phase decision, not built here.

## Testing

Vitest, `environment: 'node'` (nothing is rendered in tests — see below).
Tests are colocated (`replacement.test.ts` next to `replacement.ts`).

**No component/React Testing Library tests, deliberately.** The correctness
that matters is the port and the draft-state derivations, both of which have
a free oracle (the passing Python suite; the design handoff's own
`renderVals()` logic for the Board) — component tests would be the
lowest-yield tests available right now. The mitigation is architectural:
every non-trivial behavior (snake order, roster fill, position ranks,
filter/sort, search matching, persistence serialization) is a pure function
in `lib/`, not component-internal logic, so it's unit-tested without
rendering anything. Revisit RTL once the UI stabilizes.

## Directory layout

```
src/
  theme.css          Industry design-system tokens (dark-only), position color-mix system
  lib/
    projections/      types + load/verify (mirrors snapshot.py's verify_snapshot)
    scoring/           the scoring port
    valuation/         the valuation port
    ranking/            pool.ts -- live-draft Value/position-rank semantics
    draft/              snake.ts, view.ts, roster.ts -- pure Board/roster derivations
    storage/            persistence.ts
    view/                pool-rows.ts -- pure filter/sort pipeline over PoolPlayer
    search.ts             shared text-search matching (DraftSearch + pool filter)
    format.ts              number/em-dash formatting
    __fixtures__/           test fixtures, incl. the golden cross-language fixture
  hooks/              useAppState (reducer), usePlayerPool (derived pipeline),
                      useDraftBoard (Board layout)
  components/         presentational; App.tsx is the only stateful component
    DraftRoom.tsx, Blueprint.tsx, DraftSearch.tsx, PlayerDetailPanel.tsx
    rail/               League, Roster slots, Scoring, Replacement levels,
                        My roster, Board control, Position key
    board/              BoardHeader, BoardGrid, BoardList
    pool/               PoolHeader, PositionTabs, SortGroup, PoolTable, PoolRow
    icons/              InfoIcon.tsx (inline SVG, no icon package)
```
