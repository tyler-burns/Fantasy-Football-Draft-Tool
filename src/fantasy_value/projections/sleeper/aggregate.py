from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from fantasy_value.projections.sleeper.keys import (
    GP_KEY,
    LATEST_KEYS,
    REFERENCE_SUM_KEYS,
    SUM_STAT_KEYS,
)


def has_real_stats(record: Mapping[str, Any]) -> bool:
    """A record carries real projections iff `stats.gp` is present
    (Phase 0 finding: the rest are ADP-only placeholders)."""
    return (record.get("stats") or {}).get(GP_KEY) is not None


@dataclass(slots=True)
class AggregatedPlayer:
    player_id: str
    totals: dict[str, float] = field(default_factory=dict)  # SUM_STAT_KEYS + REFERENCE_SUM_KEYS
    latest: dict[str, float | None] = field(default_factory=dict)  # LATEST_KEYS
    weeks_included: int = 0
    weeks_seen: tuple[int, ...] = ()
    identity_record: dict[str, Any] = field(default_factory=dict)
    company: str | None = None
    reference_weeks_missing: int = 0


def aggregate_weeks(weekly: Mapping[int, Sequence[Mapping[str, Any]]]) -> dict[str, AggregatedPlayer]:
    """Sum counting stats across weeks for every player who has real stats
    in at least one week (spec Section 7). A player absent from a given
    week, or present only as an ADP-only placeholder, contributes zero for
    that week -- neither case is an error and neither drops the player.
    """
    ordered_weeks = sorted(weekly.keys())

    real_ids: set[str] = set()
    for week in ordered_weeks:
        for record in weekly[week]:
            if has_real_stats(record):
                real_ids.add(record["player_id"])

    aggregates: dict[str, AggregatedPlayer] = {pid: AggregatedPlayer(player_id=pid) for pid in real_ids}

    for week in ordered_weeks:
        seen_this_week: set[str] = set()
        for record in weekly[week]:
            pid = record.get("player_id")
            if pid not in aggregates:
                continue
            agg = aggregates[pid]
            stats = record.get("stats") or {}

            # Latest non-null wins for rate/rank fields, from ANY record
            # (real or placeholder) -- a bye-week placeholder still carries
            # a real ADP value.
            for key in LATEST_KEYS:
                value = stats.get(key)
                if value is not None:
                    agg.latest[key] = value

            if has_real_stats(record):
                seen_this_week.add(pid)
                for key in (*SUM_STAT_KEYS, *REFERENCE_SUM_KEYS):
                    value = stats.get(key)
                    agg.totals[key] = agg.totals.get(key, 0.0) + (float(value) if value is not None else 0.0)
                if any(stats.get(k) is None for k in REFERENCE_SUM_KEYS):
                    agg.reference_weeks_missing += 1
                agg.identity_record = record
                if record.get("company"):
                    agg.company = record["company"]

        for pid in seen_this_week:
            agg = aggregates[pid]
            agg.weeks_included += 1
            agg.weeks_seen = (*agg.weeks_seen, week)

    return aggregates
