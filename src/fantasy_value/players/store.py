from __future__ import annotations

from typing import Any, Mapping

from fantasy_value.players.models import ExternalIds, Player

_EXTERNAL_ID_FIELDS: tuple[str, ...] = (
    "espn_id",
    "yahoo_id",
    "sportradar_id",
    "rotowire_id",
    "fantasy_data_id",
    "gsis_id",
)


def _clean_id(value: object) -> str | None:
    """Coerce an external-id value to a stripped string, or None if absent.
    Phase 0 found `gsis_id` values with a leading space (" 00-0035057") and
    numeric ids (espn_id, yahoo_id) that arrive as ints, not strings."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_player(record: Mapping[str, Any]) -> Player:
    external_ids = ExternalIds(**{field: _clean_id(record.get(field)) for field in _EXTERNAL_ID_FIELDS})
    fantasy_positions = tuple(record.get("fantasy_positions") or ())
    return Player(
        player_id=str(record.get("player_id") or ""),
        full_name=record.get("full_name"),
        first_name=record.get("first_name"),
        last_name=record.get("last_name"),
        search_full_name=record.get("search_full_name"),
        team=record.get("team"),
        position=record.get("position"),
        fantasy_positions=fantasy_positions,
        external_ids=external_ids,
    )


def parse_player_master(payload: Mapping[str, Mapping[str, Any]]) -> dict[str, Player]:
    """Parse the raw `/v1/players/nfl` map (player_id -> player object) into
    canonical Player records."""
    players: dict[str, Player] = {}
    for player_id, record in payload.items():
        if not isinstance(record, Mapping):
            continue
        player = parse_player(record)
        players[player_id] = player
    return players


class PlayerStore:
    def __init__(self, players: Mapping[str, Player]) -> None:
        self.players: dict[str, Player] = dict(players)

    @classmethod
    def from_master_payload(cls, payload: Mapping[str, Mapping[str, Any]]) -> "PlayerStore":
        return cls(parse_player_master(payload))

    def get(self, player_id: str) -> Player | None:
        return self.players.get(player_id)

    def display_name(self, player_id: str, fallback: Mapping[str, Any] | None = None) -> str | None:
        player = self.get(player_id)
        if player and player.full_name:
            return player.full_name
        if fallback:
            first, last = fallback.get("first_name"), fallback.get("last_name")
            if first or last:
                return f"{first or ''} {last or ''}".strip()
        if player and (player.first_name or player.last_name):
            return f"{player.first_name or ''} {player.last_name or ''}".strip()
        return None
