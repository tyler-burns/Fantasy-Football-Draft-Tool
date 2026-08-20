# Data Source Findings (Sleeper) — Phase 0

Generated: 2026-08-20T02:52:44.053640+00:00

Season under test: 2026

## Executive summary — answers to Section 4.1 questions

1. **Does the projections endpoint respond at all for 2026?** Yes. `GET /projections/nfl/2026/{week}?season_type=regular&position[]=...` returns HTTP 200 with a JSON array for every week probed (0, 1, 18).

2. **Does `week=0` return season-long totals?** **No.** At `week=0`, every counting-stat key (`pass_yd`, `rush_yd`, `rec`, `gp`, etc.) is absent/zero across all 3,269 records — only `adp_dd_ppr` is populated, and even `pos_adp_dd_ppr` is 0/3,269 there. `week=1` returns real per-game-average projections (e.g. top QB, Dak Prescott, projected for 256.9 pass yds in week 1 alone — clearly a single-week figure, not a season total). **Conclusion: weekly summation across weeks 1–18 is required (Section 7 must be implemented).** Do not call `week=0` for stats.

3. **What is the actual week range?** Per product decision, aggregation is scoped to **weeks 1–18** of `season_type=regular`; weeks beyond 18 were not probed. Week 18 responds with 200 and a full record set (3,112 records for QB/RB/WR/TE).

4. **Which stat keys are actually populated per position (at week=1, among the 578 records with real stats)?** Passing keys (`pass_att`, `pass_cmp`, `pass_yd`, `pass_td`, `pass_fd`, `pass_2pt`, `pass_inc`, `pass_sack`, `pass_cmp_40p`, `cmp_pct`): populated on 65 records (the projected-relevant QBs); `pass_int` on 64/65. Rushing keys (`rush_att`, `rush_yd`, `rush_td`, `rush_fd`): 341 records (QB+RB+some WR/TE rushers). Receiving keys (`rec`, `rec_yd`, `rec_td`, `rec_tgt`, `rec_fd`, and the bucketed `rec_0_4`...`rec_40p`): 440 records. `fum`/`fum_lost`: 506 records. `pts_ppr`/`pts_half_ppr`/`pts_std`: 575 records (3 short of the 578 with `gp` — a small missing-value edge case to handle gracefully, not an error). `pass_td_40p` never appears (0/3,301) — not used by our canonical mapping anyway, ignore it. A handful of other undocumented extra keys also appear (`bonus_rush_td_qb`, `bonus_rec_rb`/`_wr`/`_te`, `pass_int_td`, `rush_2pt`, `rec_2pt`, `def_fum_td`, `week_shard`) — out of scope, ignore them.

5. **Are `adp_dd_ppr` and `pos_adp_dd_ppr` populated?** Unevenly. At week=1: `adp_dd_ppr` is present on **all** 3,301/3,301 records; `pos_adp_dd_ppr` is present on only **578/3,301** — exactly the set of records with real stats (see point 6). At week=0, only `adp_dd_ppr` is populated at all (`pos_adp_dd_ppr` is 0/3,269). ADP appears to be a static per-season value repeated identically across weeks; source it from week 1. Handle `pos_adp` as nullable per Section 20 — most raw records won't have it, though after filtering to real-stat players (below) it should be populated for effectively all of them.

6. **Is `gp` (games projected) present?** Present on only **578/3,301** records at week=1; **confirmed by inspecting the full (untrimmed) response** that the other **2,723/3,301** records have `stats == {"adp_dd_ppr": <value>}` and nothing else — no `gp`, no yardage/reception/passing keys, nothing. These are unrostered/deep-bench players that exist only as an ADP placeholder (often a sentinel like `1000.0`, i.e. effectively "undrafted/unranked"), not players with a small-but-real projection. **578 is the true count of players Sleeper actually projects with real stats** for week 1 (QB/RB/WR/TE/K/DEF/FLEX combined). **Practical implication for Phase 1:** filter to records where `stats.gp is not None` before normalizing — don't emit ~3,300 mostly-empty player rows. Rebuild the Tier 1 "fewer than 300 players" validation check against this filtered, real-stats count (578 at week 1 is comfortably above 300, but the check should run per aggregated season, after summing all 18 weeks, since any single week's 578 could dip below 300 in a bye-heavy week). `gp` is absent/zero at week=0 entirely (consistent with week=0 carrying no real stats at all). Use week-level `gp` values, sum across weeks for `games_proj`.

7. **What does a bye-week response look like?** Not directly observable in Phase 0 — the 2026 schedule isn't fully knowable this far out and this script has no bye-week ground truth to probe against yet. Treated as an open item, but low-risk: the normalization/aggregation code must already treat a player being **entirely absent** from a given week's response as zero for that week (Section 7.2), and must already treat a record present only as `{"adp_dd_ppr": ...}` (no `gp`) as contributing zero real stats (point 6 above). Between those two rules, a bye week is covered whichever way Sleeper represents it — full omission or a placeholder-only record — with no special-case code needed.

8. **How large is a single week's full response?** ~1.8–2.1 MB per week for QB/RB/WR/TE/K/DEF/FLEX combined (~3,270–3,300 records, only ~578 of which carry real stats at week 1). 18 sequential weekly calls (~35–40 MB total transfer) plus one player-master call is entirely reasonable for a scheduled pipeline run, well under the 1000 req/min rate limit even with the courtesy delay.

**One correction to the spec's size assumption:** the player master endpoint (`/v1/players/nfl`) is **~14 MB**, not ~5 MB (12,221 total players across all sports/statuses, not just active NFL). The "cache to disk, call at most once per day" guidance still applies; size the cache accordingly. Only a 5-player trimmed sample was committed as a fixture (`data/sample/players_sample.json`) — never commit the full response. The weekly projections fixture (`data/sample/projections_week1_raw.json`) is a deliberately **mixed** sample (40 real-stat + 10 placeholder-only records) rather than a naive first-N slice, specifically so tests exercise both record shapes — an initial naive `payload[:50]` slice happened to contain zero placeholder-only records, which would have been a misleading fixture.

**Identity note (relevant to Section 5):** the `player` object embedded in projection records does **not** include `full_name` or `search_full_name` — only `first_name`/`last_name`. Display name, `search_full_name`, and the external-ID block must come from joining `player_id` against `/v1/players/nfl`, exactly as Section 5 specifies. This isn't optional convenience — it's required to get a usable name at all.

## 1. Player master data endpoint

- Status: 200 OK

- Player count: 12221

- Response size: 13.96 MB

- Saved trimmed sample (5 players) to `data/sample/players_sample.json`

- Observed player object keys: active, age, birth_city, birth_country, birth_date, birth_state, college, competitions, depth_chart_order, depth_chart_position, espn_id, fantasy_data_id, fantasy_positions, first_name, full_name, gsis_id, hashtag, height, high_school, injury_body_part, injury_notes, injury_start_date, injury_status, kalshi_id, last_name, metadata, news_updated, number, oddsjam_id, opta_id, pandascore_id, player_id, player_shard, position, practice_description, practice_participation, rotowire_id, rotoworld_id, search_first_name, search_full_name, search_last_name, search_rank, sport, sportradar_id, stats_id, status, swish_id, team, team_abbr, team_changed_at, weight, yahoo_id, years_exp


## 2. Projections endpoint — does week=0 return season totals?

- URL: `https://api.sleeper.app/projections/nfl/2026/0?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&position[]=FLEX`

- Status: 200

- Response is a JSON array: True

- Record count: 3269

- Response size: 1.76 MB

- Saved first 50 records to `data/sample/projections_week0_raw.json`

  NOTE: week=0 records are uniformly placeholder-only (see Section 2 findings below), so no with-stats/placeholder split is needed for this fixture.

- Top-level keys on a record: ['category', 'company', 'date', 'game_id', 'opponent', 'player', 'player_id', 'season', 'season_type', 'sport', 'stats', 'team', 'week']

- `stats` present on first record: True

- Top QB by pass_yd at week=0: Kinkead Dent — pass_yd=None (interpretation: >2000 strongly suggests SEASON total; <500 strongly suggests SINGLE WEEK)

- Records with `gp` present: 0 / 3269

- Records with `adp_dd_ppr` present: 3269 / 3269

- Records with `pos_adp_dd_ppr` present: 0 / 3269

- Distinct `company` values observed: ['rotowire']


### Populated stat key counts (out of 3269 records at week=0)

  - `pass_att`: 0

  - `pass_cmp`: 0

  - `pass_yd`: 0

  - `pass_td`: 0

  - `pass_int`: 0

  - `pass_2pt`: 0

  - `pass_fd`: 0

  - `pass_inc`: 0

  - `pass_sack`: 0

  - `pass_cmp_40p`: 0

  - `pass_td_40p`: 0

  - `cmp_pct`: 0

  - `rush_att`: 0

  - `rush_yd`: 0

  - `rush_td`: 0

  - `rush_fd`: 0

  - `rec`: 0

  - `rec_yd`: 0

  - `rec_td`: 0

  - `rec_tgt`: 0

  - `rec_fd`: 0

  - `rec_0_4`: 0

  - `rec_5_9`: 0

  - `rec_10_19`: 0

  - `rec_20_29`: 0

  - `rec_30_39`: 0

  - `rec_40p`: 0

  - `bonus_rec_wr`: 0

  - `fum`: 0

  - `fum_lost`: 0

  - `gp`: 0

  - `pts_ppr`: 0

  - `pts_half_ppr`: 0

  - `pts_std`: 0

  - `adp_dd_ppr`: 3269

  - `pos_adp_dd_ppr`: 0


## 3. Projections endpoint — week=1 (for comparison / fallback)

- URL: `https://api.sleeper.app/projections/nfl/2026/1?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&position[]=FLEX`

- Status: 200

- Response is a JSON array: True

- Record count: 3301

- Response size: 2.05 MB

- Saved mixed sample (40 real-stat + 10 placeholder-only records, of 578 real / 2723 placeholder-only total) to `data/sample/projections_week1_raw.json`

- Top QB by pass_yd at week=1: Dak Prescott — pass_yd=256.9


### Populated stat key counts (out of 3301 records at week=1)

  - `pass_att`: 65

  - `pass_cmp`: 65

  - `pass_yd`: 65

  - `pass_td`: 65

  - `pass_int`: 64

  - `pass_2pt`: 65

  - `pass_fd`: 65

  - `pass_inc`: 65

  - `pass_sack`: 65

  - `pass_cmp_40p`: 65

  - `pass_td_40p`: 0

  - `cmp_pct`: 65

  - `rush_att`: 341

  - `rush_yd`: 341

  - `rush_td`: 341

  - `rush_fd`: 341

  - `rec`: 440

  - `rec_yd`: 440

  - `rec_td`: 440

  - `rec_tgt`: 440

  - `rec_fd`: 440

  - `rec_0_4`: 440

  - `rec_5_9`: 440

  - `rec_10_19`: 440

  - `rec_20_29`: 440

  - `rec_30_39`: 440

  - `rec_40p`: 440

  - `bonus_rec_wr`: 197

  - `fum`: 506

  - `fum_lost`: 506

  - `gp`: 578

  - `pts_ppr`: 575

  - `pts_half_ppr`: 575

  - `pts_std`: 575

  - `adp_dd_ppr`: 3301

  - `pos_adp_dd_ppr`: 578


- Records with `gp` present at week=1: 578 / 3301

- Records with `adp_dd_ppr` present at week=1: 3301 / 3301

- Records with `pos_adp_dd_ppr` present at week=1: 578 / 3301


- Keys on embedded `player` object (in projections endpoint): ['fantasy_positions', 'first_name', 'injury_body_part', 'injury_notes', 'injury_start_date', 'injury_status', 'last_name', 'metadata', 'news_updated', 'position', 'team', 'team_abbr', 'team_changed_at', 'years_exp']

  NOTE: no `full_name` key here — only `first_name`/`last_name`. Must join against `/v1/players/nfl` by `player_id` for display name, `search_full_name`, and external ID fields (Section 5).


## 4. Bye-week behavior

- Not automatically probed here (requires knowing each team's bye week in advance).
- Manual follow-up: compare a player's presence/absence across two weeks known to span their bye once the 2026 schedule is public, or check for a `null`/`0` `gp` combined with omitted `stats` keys.


## 5. Week range — does week=18 respond?

- URL: `https://api.sleeper.app/projections/nfl/2026/18?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE`

- Status: 200

- Response is a JSON array: True

- Record count: 3112
