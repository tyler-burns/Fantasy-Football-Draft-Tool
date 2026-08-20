"""Reference PPR scoring for the Tier 3 cross-check (spec Section 9.3).

# PHASE 2 SEAM: this module exists only so Phase 1's validator can catch a
# mistyped raw-stat field mapping by comparing an independently-computed
# point total against Sleeper's own precomputed reference PPR total. Once
# Phase 2's real scoring engine exists, tier3.py should call it with a PPR
# preset instead of compute_reference_ppr(), and this module should be
# deleted. A test asserts REFERENCE_PPR_WEIGHTS matches the Section 13
# defaults so the two can't silently diverge in the interim.
"""

from __future__ import annotations

from fantasy_value.projections.models import PlayerProjection

# Section 13 default PPR weights.
REFERENCE_PPR_WEIGHTS: dict[str, float] = {
    "pass_yds_per_point": 25.0,
    "pass_td_points": 4.0,
    "pass_int_points": -2.0,
    "rush_yds_per_point": 10.0,
    "rush_td_points": 6.0,
    "reception_points": 1.0,
    "rec_yds_per_point": 10.0,
    "rec_td_points": 6.0,
    "fumble_lost_points": -2.0,
}


def compute_reference_ppr(projection: PlayerProjection) -> float:
    w = REFERENCE_PPR_WEIGHTS
    return (
        projection.pass_yds / w["pass_yds_per_point"]
        + projection.pass_tds * w["pass_td_points"]
        + projection.pass_int * w["pass_int_points"]
        + projection.rush_yds / w["rush_yds_per_point"]
        + projection.rush_tds * w["rush_td_points"]
        + projection.receptions * w["reception_points"]
        + projection.rec_yds / w["rec_yds_per_point"]
        + projection.rec_tds * w["rec_td_points"]
        + projection.fumbles_lost * w["fumble_lost_points"]
    )
