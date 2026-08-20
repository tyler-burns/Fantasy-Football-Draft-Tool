from __future__ import annotations

from typing import Protocol, runtime_checkable

from fantasy_value.players.models import Player
from fantasy_value.projections.models import PlayerProjection


@runtime_checkable
class ProjectionSource(Protocol):
    """Interface every projection source must implement (spec Section 6).

    Everything downstream of this interface receives normalized data and
    must have no knowledge of any source's field names. All source-specific
    naming stays inside the concrete implementation.
    """

    def fetch_players(self) -> dict[str, Player]: ...

    def fetch_projections(self, season: int) -> list[PlayerProjection]: ...

    @property
    def source_name(self) -> str: ...
