"""Helpers for building synthetic raw Sleeper-shaped weekly payloads for
aggregation tests. Not a test module itself -- imported by test files.
"""

from __future__ import annotations

from typing import Any


def make_record(
    player_id: str,
    *,
    team: str = "BUF",
    position: str = "QB",
    company: str = "rotowire",
    stats: dict[str, Any] | None = None,
    first_name: str = "Test",
    last_name: str = "Player",
) -> dict[str, Any]:
    """A real-stat record: `stats` includes `gp` (defaults to 1.0 unless
    overridden), matching a player who has projections that week."""
    stats = dict(stats or {})
    stats.setdefault("gp", 1.0)
    return {
        "player_id": player_id,
        "season": "2026",
        "season_type": "regular",
        "week": None,  # set by make_week
        "sport": "nfl",
        "team": team,
        "opponent": "XXX",
        "game_id": f"2026_{player_id}",
        "company": company,
        "date": "2026-09-06",
        "player": {
            "first_name": first_name,
            "last_name": last_name,
            "position": position,
            "fantasy_positions": [position],
            "team": team,
        },
        "stats": stats,
    }


def make_placeholder(player_id: str, *, adp: float = 150.0) -> dict[str, Any]:
    """An ADP-only placeholder record: no `gp`, no stat keys -- matches the
    ~2700/3300 records Phase 0 found in real weekly responses."""
    return {
        "player_id": player_id,
        "season": "2026",
        "season_type": "regular",
        "week": None,
        "sport": "nfl",
        "team": None,
        "opponent": None,
        "game_id": None,
        "company": None,
        "date": None,
        "player": {
            "first_name": "Test",
            "last_name": "Player",
            "position": "WR",
            "fantasy_positions": ["WR"],
            "team": None,
        },
        "stats": {"adp_dd_ppr": adp},
    }


def make_week(week: int, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for record in records:
        record = dict(record)
        record["week"] = week
        out.append(record)
    return out
