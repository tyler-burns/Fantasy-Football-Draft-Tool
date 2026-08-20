from __future__ import annotations

from dataclasses import dataclass, field
from math import isfinite
from typing import Iterable, Mapping


@dataclass(frozen=True, slots=True)
class ScoredPlayer:
    """Minimal, scoring-agnostic value object valuation operates on --
    decoupled from PlayerProjection so the algorithm stays schema-independent
    (the frontend re-implements this logic in TypeScript, spec Section 19)."""

    player_id: str
    position: str
    points: float
    eligible_positions: frozenset[str] = field(default_factory=frozenset)

    def __post_init__(self) -> None:
        position = self.position.strip().upper()
        if not position:
            raise ValueError("position must not be empty")
        object.__setattr__(self, "position", position)

        if not isfinite(self.points):
            raise ValueError(f"points must be a finite number (got {self.points!r})")

        eligible = frozenset(p.strip().upper() for p in self.eligible_positions) | {position}
        object.__setattr__(self, "eligible_positions", eligible)


@dataclass(frozen=True, slots=True)
class PlayerValuation:
    player_id: str
    position: str
    points: float
    par: float | None
    vona: float | None


@dataclass(frozen=True, slots=True)
class ValuationBoard:
    replacement_levels: Mapping[str, float | None]
    players: tuple[PlayerValuation, ...]


def rank_key(player: ScoredPlayer) -> tuple[float, str]:
    # player_id breaks exact point ties so ordering is reproducible
    # regardless of input order.
    return (-player.points, player.player_id)


def group_by_position(pool: Iterable[ScoredPlayer]) -> dict[str, list[ScoredPlayer]]:
    groups: dict[str, list[ScoredPlayer]] = {}
    for player in pool:
        groups.setdefault(player.position, []).append(player)
    for group in groups.values():
        group.sort(key=rank_key)
    return groups
