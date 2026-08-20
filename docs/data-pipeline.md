# Data Pipeline

Phase 1 deliverable: fetch Sleeper's player master + weekly projections,
aggregate weeks 1-18, normalize to the canonical schema, validate in three
tiers, cap to the top 300 players by PPR ADP, and publish
`data/processed/projections.json` (+ `validation-report.json`).

## Running it

```powershell
.\.venv\Scripts\python scripts\fetch_projections.py            # populate data/raw/ (network)
.\.venv\Scripts\python scripts\build_dataset.py                # fetch (or reuse cache) -> publish
.\.venv\Scripts\python scripts\build_dataset.py --offline       # cache-only, no network calls
.\.venv\Scripts\python scripts\build_dataset.py --no-tier3      # skip the reference-PPR cross-check
.\.venv\Scripts\python scripts\build_dataset.py --top-n 150     # publish fewer players
.\.venv\Scripts\python scripts\build_dataset.py --manual-csv data\raw\manual-projections.csv
```

`fetch_projections.py` is network-only — it fills `data/raw/` and does not
normalize, validate, or publish anything. `build_dataset.py` is the full
pipeline and is what actually writes `data/processed/`.

## Cache semantics (`data/raw/`)

Files are named `{key}__{UTC timestamp}.json[.gz]`. The player master
(`players_nfl`) is fetched at most once per day — a cached copy younger
than 24h is reused automatically, gzip-compressed (~14MB raw -> ~3MB on
disk), with the 3 most recent copies kept. Weekly projection files
(`projections_{season}_w{NN}`) default to **always refetching** on a live
run; pass `--max-week-age-hours N` to `fetch_projections.py` during
development to reuse a recent cached week instead of hitting the API every
time.

`--offline` on `build_dataset.py` (or `SleeperClient(offline=True)`) never
touches the network — it fails loudly naming the missing cache key if a
required week or the player master isn't already cached.

## Validation tiers

1. **Tier 1 (hard failure)** — schema shape, the stat-key "canary" (aborts
   if Sleeper silently renames/removes a field), and a 300-player floor
   checked once against the full real-stat pool (pre-cap). A Tier 1 failure
   aborts before any file is written; the previous `projections.json` is
   left untouched.
2. **Tier 2 (warn)** — non-negative stats, `pass_cmp <= pass_att`,
   `receptions <= rec_tgt`, `games_proj <= 18`, sanity ranges for the
   top-12 QB / top-24 RB by ADP (falls back to `reference_pts_ppr` ranking
   if fewer than N players at that position have an ADP).
3. **Tier 3 (reference cross-check)** — computes each player's points using
   `fantasy_value.scoring.presets.PPR` (Phase 2's scoring engine, Section 13
   defaults) and compares to Sleeper's own `pts_ppr` total (players with any
   week missing that reference value are
   excluded from the comparison, not just skipped-with-a-null). This is
   the only check that would catch a mistyped raw-stat mapping, since a
   silently-zeroed column passes every other check.

**Observed Tier 3 baseline (first real run, 2026 season, weeks 1-18):**
33/392 comparable players (8.4%) diverge more than 10% from Sleeper's
reference total, mostly at QB (e.g. Aaron Rodgers: computed 200.25 vs.
Sleeper's 252.38). Traced to real, expected causes — not a mapping bug:
Sleeper's own `pts_ppr` bakes in stats the canonical model deliberately
excludes per spec Section 13.2 (`pass_fd`/`rush_fd`/`rec_fd` first-down
bonuses, `pass_2pt`/`rec_2pt` two-point conversions, and QB/WR bonus
stats like `bonus_rush_td_qb`). This baseline is *above* the 5% "loud"
threshold, so every run currently emits a Tier 3 warning — expected, not a
regression. If you add first-downs/2pt scoring in a later phase, re-check
this baseline; until then, don't raise the threshold to silence it.

The required-fields check (non-null `player_id`, `player_name`, `position`,
`team`, `season`) removes failing records from publication entirely and is
the only validation step that changes which players get published.

## Publish cap

After validation, the survivor list is sorted by ascending PPR ADP
(`adp_dd_ppr`) and truncated to the top 300 (`--top-n`). Players with no ADP
at all are excluded from the cut — ADP ordering is undefined for them — and
counted in an `publish_cap_excluded_no_adp` INFO issue in the report.

## Manual CSV override

`scripts/build_dataset.py --manual-csv <path>` bypasses Sleeper entirely.
Tier 1 (API-payload-specific) does not apply; Tier 2/3 and the publish cap
still run. Required column headers:

```
player_id, player_name, team, position, season,
pass_att, pass_cmp, pass_yds, pass_tds, pass_int,
rush_att, rush_yds, rush_tds,
receptions, rec_yds, rec_tds, rec_tgt,
fumbles_lost, games_proj
```

Optional columns: `first_name`, `last_name`, `fantasy_positions`
(pipe-separated, e.g. `RB|WR`), `adp`, `pos_adp`, `reference_pts_ppr`,
`weeks_included`. Blank stat cells default to `0.0`; blank identity cells
become `null` (and get caught by the required-fields check if a required
column). `data/raw/manual-projections.csv` is the conventional path and is
the one exception carved out of `.gitignore`'s `data/raw/*` rule, so it can
actually be committed as the emergency fallback.

## Fallback behavior (spec Section 10)

`projections.json` is written via an atomic temp-file + readback-verify +
`os.replace` (`atomic.write_validated_json`) — a failed or invalid run never
overwrites a good snapshot, and a same-run backup (`projections.previous.json`)
is written just before each successful replace. `validation-report.json` is
written on every run, including aborted ones (`"status": "failed"`, naming
the failing check), so a scheduled run that dies at 4am still leaves a
diagnosable trail.
