"""
Phase 0 endpoint discovery script (throwaway).

Answers the questions in Section 4.1 of the spec by hitting Sleeper's
documented player endpoint and the UNDOCUMENTED projections endpoint,
and writes:

  - data/sample/*.json           raw sample responses (test fixtures)
  - docs/data-source-findings.md human-readable findings report

Usage:
    python scripts/explore_endpoints.py
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DIR = ROOT / "data" / "sample"
DOCS_DIR = ROOT / "docs"
SEASON = 2026
COURTESY_DELAY_SECONDS = 0.25
USER_AGENT = "fantasy-football-value-poc/0.1 (endpoint discovery script)"

EXPECTED_STAT_KEYS = [
    "pass_att", "pass_cmp", "pass_yd", "pass_td", "pass_int",
    "pass_2pt", "pass_fd", "pass_inc", "pass_sack",
    "pass_cmp_40p", "pass_td_40p", "cmp_pct",
    "rush_att", "rush_yd", "rush_td", "rush_fd",
    "rec", "rec_yd", "rec_td", "rec_tgt", "rec_fd",
    "rec_0_4", "rec_5_9", "rec_10_19", "rec_20_29",
    "rec_30_39", "rec_40p", "bonus_rec_wr",
    "fum", "fum_lost", "gp",
    "pts_ppr", "pts_half_ppr", "pts_std",
    "adp_dd_ppr", "pos_adp_dd_ppr",
]


def http_get_json(url: str) -> tuple[int, object | None, str | None]:
    """Returns (status_code, parsed_json_or_None, raw_text_or_None_on_success)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, None, e.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return -1, None, str(e.reason)

    try:
        return status, json.loads(raw), raw
    except json.JSONDecodeError:
        return status, None, raw


def save_sample(name: str, payload: object) -> Path:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    path = SAMPLE_DIR / name
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def summarize_bytes(raw_len: int) -> str:
    kb = raw_len / 1024
    if kb > 1024:
        return f"{kb / 1024:.2f} MB"
    return f"{kb:.1f} KB"


def find_populated_stat_keys(records: list[dict]) -> dict[str, int]:
    """Count, across all records, how many have each expected stat key present
    (present AND non-null) inside record['stats']."""
    counts = {k: 0 for k in EXPECTED_STAT_KEYS}
    for rec in records:
        stats = rec.get("stats") or {}
        for k in EXPECTED_STAT_KEYS:
            if stats.get(k) is not None:
                counts[k] += 1
    return counts


def main() -> None:
    findings: list[str] = []
    findings.append(f"# Data Source Findings (Sleeper) — Phase 0\n")
    findings.append(f"Generated: {datetime.now(timezone.utc).isoformat()}\n")
    findings.append(f"Season under test: {SEASON}\n")

    # ------------------------------------------------------------------
    # 1. Player master data endpoint (documented) — small taste only.
    #    We do NOT save the full 5MB blob repeatedly; one sample is enough.
    # ------------------------------------------------------------------
    findings.append("## 1. Player master data endpoint\n")
    players_url = "https://api.sleeper.app/v1/players/nfl"
    print(f"GET {players_url}")
    status, payload, raw = http_get_json(players_url)
    time.sleep(COURTESY_DELAY_SECONDS)

    if status == 200 and isinstance(payload, dict):
        n_players = len(payload)
        size_str = summarize_bytes(len(raw) if raw else 0)
        findings.append(f"- Status: {status} OK\n")
        findings.append(f"- Player count: {n_players}\n")
        findings.append(f"- Response size: {size_str}\n")
        # Save only a small trimmed sample (first 5 entries) as a fixture —
        # the full file is too big to commit and isn't needed for tests.
        sample_ids = list(payload.keys())[:5]
        trimmed = {pid: payload[pid] for pid in sample_ids}
        save_sample("players_sample.json", trimmed)
        findings.append(f"- Saved trimmed sample (5 players) to `data/sample/players_sample.json`\n")
        example_keys = sorted(next(iter(trimmed.values())).keys())
        findings.append(f"- Observed player object keys: {', '.join(example_keys)}\n")
    else:
        findings.append(f"- Status: {status}\n")
        findings.append(f"- FAILED to fetch or parse player master data.\n")
        findings.append(f"- Raw (truncated): {(raw or '')[:500]}\n")

    # ------------------------------------------------------------------
    # 2. Projections endpoint — season-long via week=0
    # ------------------------------------------------------------------
    findings.append("\n## 2. Projections endpoint — does week=0 return season totals?\n")
    week0_url = (
        f"https://api.sleeper.app/projections/nfl/{SEASON}/0"
        f"?season_type=regular&position[]=QB&position[]=RB&position[]=WR"
        f"&position[]=TE&position[]=K&position[]=DEF&position[]=FLEX"
    )
    print(f"GET {week0_url}")
    status0, payload0, raw0 = http_get_json(week0_url)
    time.sleep(COURTESY_DELAY_SECONDS)

    week0_is_array = isinstance(payload0, list)
    findings.append(f"- URL: `{week0_url}`\n")
    findings.append(f"- Status: {status0}\n")
    findings.append(f"- Response is a JSON array: {week0_is_array}\n")

    if status0 == 200 and week0_is_array:
        findings.append(f"- Record count: {len(payload0)}\n")
        findings.append(f"- Response size: {summarize_bytes(len(raw0) if raw0 else 0)}\n")
        save_sample("projections_week0_raw.json", payload0[:50])
        findings.append("- Saved first 50 records to `data/sample/projections_week0_raw.json`\n")
        findings.append(
            "  NOTE: week=0 records are uniformly placeholder-only (see Section 2 findings "
            "below), so no with-stats/placeholder split is needed for this fixture.\n"
        )

        if payload0:
            sample_rec = payload0[0]
            findings.append(f"- Top-level keys on a record: {sorted(sample_rec.keys())}\n")
            stats_sample = sample_rec.get("stats")
            findings.append(f"- `stats` present on first record: {stats_sample is not None}\n")

            # Does week=0 look like season totals or a single week?
            # Heuristic: season pass_yd for a starting QB should be
            # in the thousands; a single week would be in the low hundreds.
            qb_records = [r for r in payload0 if (r.get("player") or {}).get("position") == "QB"]
            if qb_records:
                qb_records.sort(
                    key=lambda r: (r.get("stats") or {}).get("pass_yd") or 0, reverse=True
                )
                top_qb = qb_records[0]
                top_qb_yds = (top_qb.get("stats") or {}).get("pass_yd")
                p = top_qb.get("player") or {}
                top_qb_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or top_qb.get("player_id")
                findings.append(
                    f"- Top QB by pass_yd at week=0: {top_qb_name} — pass_yd={top_qb_yds} "
                    f"(interpretation: >2000 strongly suggests SEASON total; "
                    f"<500 strongly suggests SINGLE WEEK)\n"
                )
            else:
                findings.append("- No QB records found at week=0 to sanity-check magnitude.\n")

            gp_present = sum(1 for r in payload0 if (r.get("stats") or {}).get("gp") is not None)
            findings.append(f"- Records with `gp` present: {gp_present} / {len(payload0)}\n")

            adp_present = sum(
                1 for r in payload0 if (r.get("stats") or {}).get("adp_dd_ppr") is not None
            )
            pos_adp_present = sum(
                1 for r in payload0 if (r.get("stats") or {}).get("pos_adp_dd_ppr") is not None
            )
            findings.append(f"- Records with `adp_dd_ppr` present: {adp_present} / {len(payload0)}\n")
            findings.append(
                f"- Records with `pos_adp_dd_ppr` present: {pos_adp_present} / {len(payload0)}\n"
            )

            companies = sorted({r.get("company") for r in payload0 if r.get("company")})
            findings.append(f"- Distinct `company` values observed: {companies}\n")

            stat_key_counts = find_populated_stat_keys(payload0)
            findings.append("\n### Populated stat key counts (out of "
                             f"{len(payload0)} records at week=0)\n")
            for k, count in stat_key_counts.items():
                findings.append(f"  - `{k}`: {count}\n")
    else:
        findings.append(f"- week=0 request FAILED or did not return an array.\n")
        findings.append(f"- Raw (truncated): {(raw0 or '')[:500]}\n")

    # ------------------------------------------------------------------
    # 3. Projections endpoint — a single real week (week=1), for comparison
    # ------------------------------------------------------------------
    findings.append("\n## 3. Projections endpoint — week=1 (for comparison / fallback)\n")
    week1_url = (
        f"https://api.sleeper.app/projections/nfl/{SEASON}/1"
        f"?season_type=regular&position[]=QB&position[]=RB&position[]=WR"
        f"&position[]=TE&position[]=K&position[]=DEF&position[]=FLEX"
    )
    print(f"GET {week1_url}")
    status1, payload1, raw1 = http_get_json(week1_url)
    time.sleep(COURTESY_DELAY_SECONDS)

    week1_is_array = isinstance(payload1, list)
    findings.append(f"- URL: `{week1_url}`\n")
    findings.append(f"- Status: {status1}\n")
    findings.append(f"- Response is a JSON array: {week1_is_array}\n")

    if status1 == 200 and week1_is_array:
        findings.append(f"- Record count: {len(payload1)}\n")
        findings.append(f"- Response size: {summarize_bytes(len(raw1) if raw1 else 0)}\n")

        # IMPORTANT: a naive payload1[:50] slice happened to be 100% "real"
        # (gp-populated) records in practice, which would make a misleading
        # fixture — the placeholder-only records (no `gp`, only `adp_dd_ppr`)
        # are the majority of the real response and tests need to see both
        # shapes. Build a deliberately mixed sample instead.
        with_gp = [r for r in payload1 if (r.get("stats") or {}).get("gp") is not None]
        without_gp = [r for r in payload1 if (r.get("stats") or {}).get("gp") is None]
        mixed_sample = with_gp[:40] + without_gp[:10]
        save_sample("projections_week1_raw.json", mixed_sample)
        findings.append(
            f"- Saved mixed sample (40 real-stat + 10 placeholder-only records, "
            f"of {len(with_gp)} real / {len(without_gp)} placeholder-only total) "
            f"to `data/sample/projections_week1_raw.json`\n"
        )

        if payload1:
            qb_records = [r for r in payload1 if (r.get("player") or {}).get("position") == "QB"]
            if qb_records:
                qb_records.sort(
                    key=lambda r: (r.get("stats") or {}).get("pass_yd") or 0, reverse=True
                )
                top_qb = qb_records[0]
                top_qb_yds = (top_qb.get("stats") or {}).get("pass_yd")
                p = top_qb.get("player") or {}
                top_qb_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or top_qb.get("player_id")
                findings.append(
                    f"- Top QB by pass_yd at week=1: {top_qb_name} — pass_yd={top_qb_yds}\n"
                )

            stat_key_counts_w1 = find_populated_stat_keys(payload1)
            findings.append("\n### Populated stat key counts (out of "
                             f"{len(payload1)} records at week=1)\n")
            for k, count in stat_key_counts_w1.items():
                findings.append(f"  - `{k}`: {count}\n")

            gp_present_w1 = sum(1 for r in payload1 if (r.get("stats") or {}).get("gp") is not None)
            adp_present_w1 = sum(1 for r in payload1 if (r.get("stats") or {}).get("adp_dd_ppr") is not None)
            pos_adp_present_w1 = sum(1 for r in payload1 if (r.get("stats") or {}).get("pos_adp_dd_ppr") is not None)
            findings.append(f"\n- Records with `gp` present at week=1: {gp_present_w1} / {len(payload1)}\n")
            findings.append(f"- Records with `adp_dd_ppr` present at week=1: {adp_present_w1} / {len(payload1)}\n")
            findings.append(f"- Records with `pos_adp_dd_ppr` present at week=1: {pos_adp_present_w1} / {len(payload1)}\n")

            player_keys = sorted((payload1[0].get("player") or {}).keys())
            findings.append(f"\n- Keys on embedded `player` object (in projections endpoint): {player_keys}\n")
            findings.append(
                "  NOTE: no `full_name` key here — only `first_name`/`last_name`. "
                "Must join against `/v1/players/nfl` by `player_id` for display name, "
                "`search_full_name`, and external ID fields (Section 5).\n"
            )
    else:
        findings.append(f"- week=1 request FAILED or did not return an array.\n")
        findings.append(f"- Raw (truncated): {(raw1 or '')[:500]}\n")

    # ------------------------------------------------------------------
    # 4. Bye-week behavior probe (only meaningful if week1 succeeded):
    #    check a known player present in week 1 against a later week
    #    where they might be on bye — left as a manual follow-up note,
    #    since bye weeks aren't knowable a priori without a schedule.
    # ------------------------------------------------------------------
    findings.append("\n## 4. Bye-week behavior\n")
    findings.append(
        "- Not automatically probed here (requires knowing each team's bye week in advance).\n"
        "- Manual follow-up: compare a player's presence/absence across two weeks known to "
        "span their bye once the 2026 schedule is public, or check for a `null`/`0` `gp` "
        "combined with omitted `stats` keys.\n"
    )

    # ------------------------------------------------------------------
    # 5. Week range check — probe week 18 to confirm it responds
    # ------------------------------------------------------------------
    findings.append("\n## 5. Week range — does week=18 respond?\n")
    week18_url = (
        f"https://api.sleeper.app/projections/nfl/{SEASON}/18"
        f"?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE"
    )
    print(f"GET {week18_url}")
    status18, payload18, raw18 = http_get_json(week18_url)
    time.sleep(COURTESY_DELAY_SECONDS)
    findings.append(f"- URL: `{week18_url}`\n")
    findings.append(f"- Status: {status18}\n")
    findings.append(f"- Response is a JSON array: {isinstance(payload18, list)}\n")
    if isinstance(payload18, list):
        findings.append(f"- Record count: {len(payload18)}\n")

    # ------------------------------------------------------------------
    # Write findings report
    # ------------------------------------------------------------------
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    findings_path = DOCS_DIR / "data-source-findings.md"
    findings_path.write_text("\n".join(findings), encoding="utf-8")
    print(f"\nFindings written to {findings_path}")
    print(f"Sample fixtures written to {SAMPLE_DIR}")


if __name__ == "__main__":
    main()
