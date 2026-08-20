from __future__ import annotations

from typing import Iterable, Mapping

from fantasy_value.valuation.models import ScoredPlayer


def compute_par(player: ScoredPlayer, replacement_levels: Mapping[str, float | None]) -> float | None:
    """Section 16: PAR = points - replacement level. Propagates None (an
    undefined replacement level) rather than crashing or defaulting to 0."""
    level = replacement_levels.get(player.position)
    return None if level is None else player.points - level


def compute_par_by_id(
    pool: Iterable[ScoredPlayer], replacement_levels: Mapping[str, float | None]
) -> dict[str, float | None]:
    return {p.player_id: compute_par(p, replacement_levels) for p in pool}
