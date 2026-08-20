from __future__ import annotations

from fantasy_value.players.models import Player
from fantasy_value.projections.models import PlayerProjection


class FantasyProsProjectionSource:
    """Stub only (spec Section 6) — FantasyPros' API requires a paid Hall of
    Fame subscription, so this project uses Sleeper instead. Kept as a stub
    to prove the ProjectionSource abstraction can add a second source."""

    @property
    def source_name(self) -> str:
        return "fantasypros"

    def fetch_players(self) -> dict[str, Player]:
        raise NotImplementedError("FantasyProsProjectionSource is not implemented")

    def fetch_projections(self, season: int) -> list[PlayerProjection]:
        raise NotImplementedError("FantasyProsProjectionSource is not implemented")
