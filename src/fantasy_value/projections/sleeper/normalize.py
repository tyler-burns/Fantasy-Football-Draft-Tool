from __future__ import annotations

from datetime import datetime
from typing import Any

from fantasy_value.players.store import PlayerStore
from fantasy_value.projections.models import STAT_FIELDS, PlayerProjection
from fantasy_value.projections.sleeper.aggregate import AggregatedPlayer
from fantasy_value.projections.sleeper.keys import (
    ADP_KEY,
    POS_ADP_KEY,
    REFERENCE_PPR_KEY,
    SLEEPER_TO_CANONICAL,
)


def _to_float(value: Any) -> float:
    return float(value) if value is not None else 0.0


def _identity_name(
    player_id: str, players: PlayerStore, identity_record: dict[str, Any]
) -> tuple[str | None, str | None, str | None]:
    """Returns (player_name, first_name, last_name)."""
    master = players.get(player_id)
    embedded = identity_record.get("player") or {}

    first_name = (master.first_name if master else None) or embedded.get("first_name")
    last_name = (master.last_name if master else None) or embedded.get("last_name")

    player_name = master.full_name if master else None
    if not player_name and (first_name or last_name):
        player_name = f"{first_name or ''} {last_name or ''}".strip()
    if not player_name:
        player_name = None

    return player_name, first_name, last_name


def normalize_player(
    agg: AggregatedPlayer,
    *,
    players: PlayerStore,
    season: int,
    source_name: str,
    timestamp: datetime,
) -> PlayerProjection:
    master = players.get(agg.player_id)
    identity_record = agg.identity_record
    embedded_player = identity_record.get("player") or {}

    player_name, first_name, last_name = _identity_name(agg.player_id, players, identity_record)

    team = identity_record.get("team") or (master.team if master else None) or embedded_player.get("team")
    position = embedded_player.get("position") or (master.position if master else None)
    fantasy_positions = tuple(
        embedded_player.get("fantasy_positions")
        or (master.fantasy_positions if master else ())
        or ()
    )
    search_full_name = master.search_full_name if master else None

    stat_kwargs = {
        canonical: _to_float(agg.totals.get(sleeper_key)) for sleeper_key, canonical in SLEEPER_TO_CANONICAL.items()
    }

    adp = agg.latest.get(ADP_KEY)
    pos_adp = agg.latest.get(POS_ADP_KEY)
    reference_pts_ppr = agg.totals.get(REFERENCE_PPR_KEY) if agg.reference_weeks_missing == 0 else None

    return PlayerProjection(
        player_id=agg.player_id,
        player_name=player_name,
        first_name=first_name,
        last_name=last_name,
        team=team,
        position=position,
        fantasy_positions=fantasy_positions,
        season=season,
        source=source_name,
        projection_company=agg.company,
        timestamp=timestamp,
        weeks_included=agg.weeks_included,
        adp=adp,
        pos_adp=pos_adp,
        reference_pts_ppr=reference_pts_ppr,
        search_full_name=search_full_name,
        **stat_kwargs,
    )


def normalize_all(
    aggregates: dict[str, AggregatedPlayer],
    *,
    players: PlayerStore,
    season: int,
    source_name: str,
    timestamp: datetime,
) -> list[PlayerProjection]:
    return [
        normalize_player(agg, players=players, season=season, source_name=source_name, timestamp=timestamp)
        for agg in aggregates.values()
    ]


def _assert_mapping_covers_stat_fields() -> None:
    mapped = set(SLEEPER_TO_CANONICAL.values())
    expected = set(STAT_FIELDS)
    if mapped != expected:
        missing = expected - mapped
        extra = mapped - expected
        raise AssertionError(
            f"SLEEPER_TO_CANONICAL does not exactly cover STAT_FIELDS: missing={missing} extra={extra}"
        )


_assert_mapping_covers_stat_fields()
