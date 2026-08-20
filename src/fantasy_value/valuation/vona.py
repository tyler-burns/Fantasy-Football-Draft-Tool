from __future__ import annotations

from typing import Sequence

from fantasy_value.valuation.models import ScoredPlayer, group_by_position


def compute_vona(available: Sequence[ScoredPlayer]) -> dict[str, float | None]:
    """Section 17: for each player, points minus the next-best available
    player at the same position. The last player at a position gets None
    (undefined) -- 0.0 stays reserved for a genuine tie, and VONA stays
    distinct from PAR ("gap to replacement level")."""
    groups = group_by_position(available)
    vona: dict[str, float | None] = {}
    for group in groups.values():
        for i, p in enumerate(group):
            vona[p.player_id] = p.points - group[i + 1].points if i + 1 < len(group) else None
    return vona


def best_available(available: Sequence[ScoredPlayer]) -> dict[str, ScoredPlayer]:
    groups = group_by_position(available)
    return {position: group[0] for position, group in groups.items() if group}
