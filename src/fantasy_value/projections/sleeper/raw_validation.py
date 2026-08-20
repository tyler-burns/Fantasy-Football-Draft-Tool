from __future__ import annotations

from typing import Any

from fantasy_value.constants import PLAYER_COUNT_FLOOR
from fantasy_value.errors import SchemaDriftError, Tier1ValidationError
from fantasy_value.projections.sleeper.keys import CANARY_STAT_KEYS, EXPECTED_TOP_LEVEL_KEYS


def validate_raw_week(payload: Any, *, season: int, week: int) -> None:
    """Tier 1 hard-failure checks against a single week's raw response.
    Raises Tier1ValidationError (or the SchemaDriftError subclass) naming
    the specific check that failed. Returns None on success.
    """
    context = {"season": season, "week": week}

    if not isinstance(payload, list):
        raise Tier1ValidationError(
            "payload_is_array", f"expected a JSON array, got {type(payload).__name__}", context
        )

    if not payload:
        raise Tier1ValidationError("payload_non_empty", "response array was empty", context)

    for key in EXPECTED_TOP_LEVEL_KEYS:
        if not any(isinstance(record, dict) and key in record for record in payload):
            raise Tier1ValidationError(
                "top_level_keys_present",
                f"expected top-level key {key!r} missing from every record in the response",
                context,
            )

    for stat_key in CANARY_STAT_KEYS:
        found = any(stat_key in (record.get("stats") or {}) for record in payload if isinstance(record, dict))
        if not found:
            raise SchemaDriftError(
                "stat_key_canary",
                f"expected stat key {stat_key!r} absent across the entire response "
                "(Sleeper may have renamed or removed it)",
                context,
            )


def validate_aggregate_size(n_real_players: int, *, minimum: int = PLAYER_COUNT_FLOOR) -> None:
    """Tier 1 check run once, post-aggregation, on the count of real-stat
    players for the season (not per-week, since per-week counts fluctuate
    with byes and are not representative on their own)."""
    if n_real_players < minimum:
        raise Tier1ValidationError(
            "player_count_minimum",
            f"only {n_real_players} real-stat players found across the season, "
            f"fewer than the required minimum of {minimum}",
            {"n_real_players": n_real_players, "minimum": minimum},
        )
