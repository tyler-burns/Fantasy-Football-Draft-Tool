from __future__ import annotations

from typing import Iterable

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.scoring.calculator import score_projection
from fantasy_value.scoring.models import ScoringConfig
from fantasy_value.valuation.models import ScoredPlayer


def to_scored_players(projections: Iterable[PlayerProjection], config: ScoringConfig) -> list[ScoredPlayer]:
    """The only bridge between real projection/scoring data and the
    valuation algorithms -- everything downstream of this stays
    schema-independent (the frontend re-implements it in TypeScript)."""
    scored: list[ScoredPlayer] = []
    for projection in projections:
        fantasy_positions = projection.fantasy_positions
        position = projection.position if projection.position in fantasy_positions else (
            fantasy_positions[0] if fantasy_positions else projection.position
        )
        if not position:
            raise ValueError(f"player {projection.player_id!r} has no position or fantasy_positions")

        points = score_projection(projection, config)
        scored.append(
            ScoredPlayer(
                player_id=projection.player_id,
                position=position,
                points=points,
                eligible_positions=frozenset(fantasy_positions) | {position},
            )
        )
    return scored
