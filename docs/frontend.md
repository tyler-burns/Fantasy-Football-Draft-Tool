# Frontend

React + TypeScript + Vite, deployed as a static site (spec Section 19). Everything
— scoring, replacement level, PAR, VONA, filtering, ranking, persistence — runs in
the browser. There is no backend at request time; the frontend reads the same
`data/processed/projections.json` the Python pipeline publishes and never calls
an API.

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
| (none — Phase 3 deliberately deferred this) | `lib/ranking/modes.ts` — the ranking-mode abstraction (see below) |

Faithfulness is checked two ways: every exact-value Python test case (the
344.0/220.0 scoring worked examples, the 240/110/109/108 replacement-level
example, the Section 17.1 VONA case) is ported verbatim, and a **golden
cross-language fixture** (`scripts/dump_valuation_fixture.py` + `lib/valuation/golden.test.ts`)
asserts the TS pipeline reproduces a real 300-player Python run bit-for-bit
across two different scoring/league configurations.

## Resolved ambiguities

The base spec underspecifies three things; Phase 4 resolves them concretely
(see `lib/ranking/modes.ts` for the code and reasoning):

- **The table's "Value" column** = the score of whichever ranking mode is
  currently active (the header relabels to match, e.g. "Value (VONA)").
- **ADP Value** = `adp − model_rank`, where `model_rank` is the player's rank
  under the active mode's basis, computed over the **full** player pool (not
  the shrinking available pool) — mirrors `board.ts`'s "replacement levels
  from the full pool" policy, so the metric doesn't drift as players are
  drafted. ADP Value itself falls back to a VONA basis (can't rank by itself).
- **Overall Value** = `PAR + (VONA ?? 0)` — both already in fantasy points, no
  hidden weighting, labeled in the UI as a POC heuristic.

## State management

No state library. `useReducer` (persisted domain state: scoring config,
league config, ordered drafted-id list) + `useState` (ephemeral UI: filters,
sort, ranking mode, selected player) + `useMemo` (the derived score → board →
rank → filter/sort pipeline). Justification: a full recompute over ~300
players is on the order of 10⁴ elementary operations, sub-millisecond in V8 —
rendering the table dominates. See `hooks/useValuationBoards.ts`.

Two boards are computed on every recompute: a **full-pool** board (drafted
state ignored) and an **available-pool** board. Replacement levels are
identical between them (both derive from the same full player pool); they
differ only in which players are listed. This is what makes PAR stable across
a draft while VONA is the metric that moves with every pick (spec 19.4
defaults live-draft ranking to VONA) — worked through in `lib/valuation/board.ts`'s
docstring, and pinned by `board.test.ts`'s "PAR/VONA byte-identical after a
top-prefix draft" property.

## Persistence (spec 19.6)

Two independent `localStorage` keys — `ffv.config.v1` (scoring + league) and
`ffv.draft.v1` (ordered drafted player ids) — so a corrupted or
schema-changed config can never destroy an in-progress draft. Projections
data is never persisted; it's always re-fetched fresh. See
`lib/storage/persistence.ts`.

**Versioning: no migrations, by design (documented risk).** The version is
bumped only on a genuinely incompatible schema change; an unrecognized
version resets that key's section to defaults. A user mid-draft when a
schema change ships would lose their config (never their draft — the two
keys are independent). Mitigated by a visible "Reset all settings" button
rather than engineered around, since this is a POC. A stale drafted `player_id`
(absent from a refreshed `projections.json`) is pruned once on load with a
dismissible notice — the valuation layer already tolerates unknown ids
harmlessly, but the drafted panel needs real projections to join against.

## Offline capability (spec Section 25)

The app fetches `data/projections.json` at load rather than bundling it, so
refreshing the dataset needs no rebuild. This satisfies the spec's actual
guarantee ("after the snapshot is downloaded, the app works with no internet
connection") on the same terms a bundled copy would — a cold load with no
network can't proceed either way, since the JS bundle itself needs
downloading. A genuine offline-first reload (no network, page already
visited) would need a service worker or explicit cache headers; that is a
deliberate Phase 5 (deployment) decision, not built here.

## Testing

Vitest, `environment: 'node'` (nothing is rendered in tests — see below).
Tests are colocated (`replacement.test.ts` next to `replacement.ts`).

**No component/React Testing Library tests this phase, deliberately.** The
correctness that matters is the port, which has a free oracle (the passing
Python suite) — component tests would be the lowest-yield tests available
right now, and the UI will change shape before it stabilizes. The mitigation
is architectural: every non-trivial behavior (filter/sort/rank, search
matching, persistence serialization) is a pure function in `lib/`, not
component-internal logic, so it's unit-tested without rendering anything.
Revisit RTL once the UI stabilizes.

## Directory layout

```
src/
  lib/
    projections/   types + load/verify (mirrors snapshot.py's verify_snapshot)
    scoring/        the scoring port
    valuation/      the valuation port
    ranking/        modes.ts -- the ranking-mode abstraction (new in Phase 4)
    storage/        persistence.ts
    view/           rows.ts -- pure filter/sort pipeline
    search.ts        shared text-search matching (DraftSearch + table filter)
    format.ts         number/em-dash formatting
    __fixtures__/     test fixtures, incl. the golden cross-language fixture
  hooks/            useAppState (reducer), useValuationBoards (derived pipeline)
  components/       presentational; App.tsx is the only stateful component
```
