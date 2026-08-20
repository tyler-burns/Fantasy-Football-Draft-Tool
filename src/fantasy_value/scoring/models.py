from __future__ import annotations

from dataclasses import dataclass, fields
from math import isfinite

from fantasy_value.projections.models import STAT_FIELDS

# Section 13.1: the nine scored categories. Section 13.2's deferred ones
# (2pt, return TDs, first downs, bonuses) deliberately have no config field —
# an absent field can't be silently mis-weighted.
SCORED_STAT_FIELDS: tuple[str, ...] = (
    "pass_yds",
    "pass_tds",
    "pass_int",
    "rush_yds",
    "rush_tds",
    "receptions",
    "rec_yds",
    "rec_tds",
    "fumbles_lost",
)

# Divisors, not weights: Section 13 expresses yardage as "N yards per point".
YARDAGE_DIVISOR_FIELDS: tuple[str, ...] = (
    "pass_yds_per_point",
    "rush_yds_per_point",
    "rec_yds_per_point",
)


@dataclass(frozen=True, slots=True)
class ScoringConfig:
    """Custom scoring weights (spec Section 13). Presets are instances of
    this, never a separate code path — there is no default-PPR fallback,
    since Section 13 forbids treating any preset as the underlying model."""

    pass_yds_per_point: float
    pass_td_points: float
    pass_int_points: float
    rush_yds_per_point: float
    rush_td_points: float
    reception_points: float
    rec_yds_per_point: float
    rec_td_points: float
    fumble_lost_points: float

    def __post_init__(self) -> None:
        for f in fields(self):
            value = getattr(self, f.name)
            if not isfinite(value):
                raise ValueError(f"{f.name} must be a finite number (got {value!r})")
        for name in YARDAGE_DIVISOR_FIELDS:
            value = getattr(self, name)
            if value <= 0:
                raise ValueError(
                    f"{name} must be > 0 (got {value!r}); it is a yards-per-point divisor, "
                    "not a per-event weight"
                )


def _assert_scored_fields_are_real_stats() -> None:
    unknown = set(SCORED_STAT_FIELDS) - set(STAT_FIELDS)
    if unknown:
        raise AssertionError(f"SCORED_STAT_FIELDS references non-stat fields: {unknown}")


_assert_scored_fields_are_real_stats()
