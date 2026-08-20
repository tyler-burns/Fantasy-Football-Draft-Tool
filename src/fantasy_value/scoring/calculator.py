from __future__ import annotations

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.scoring.models import ScoringConfig


def score_projection(projection: PlayerProjection, config: ScoringConfig) -> float:
    """Section 13. Term order is fixed (passing, rushing, receiving, misc) --
    float addition isn't associative, so a stable order keeps a total
    bit-reproducible across refactors and matches the Tier 3 baseline."""
    return (
        projection.pass_yds / config.pass_yds_per_point
        + projection.pass_tds * config.pass_td_points
        + projection.pass_int * config.pass_int_points
        + projection.rush_yds / config.rush_yds_per_point
        + projection.rush_tds * config.rush_td_points
        + projection.receptions * config.reception_points
        + projection.rec_yds / config.rec_yds_per_point
        + projection.rec_tds * config.rec_td_points
        + projection.fumbles_lost * config.fumble_lost_points
    )
