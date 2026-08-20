from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ExternalIds:
    """Cross-reference IDs for a player, carried through unused for now so a
    second projection source can be added later without a name-matching layer."""

    espn_id: str | None = None
    yahoo_id: str | None = None
    sportradar_id: str | None = None
    rotowire_id: str | None = None
    fantasy_data_id: str | None = None
    gsis_id: str | None = None


@dataclass(frozen=True, slots=True)
class Player:
    """Canonical player identity record. `player_id` (Sleeper's id) is the
    primary key for all joins in this project — never names."""

    player_id: str
    full_name: str | None
    first_name: str | None
    last_name: str | None
    search_full_name: str | None
    team: str | None
    position: str | None
    fantasy_positions: tuple[str, ...] = field(default_factory=tuple)
    external_ids: ExternalIds = field(default_factory=ExternalIds)
