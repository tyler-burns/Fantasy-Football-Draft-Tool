from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Sequence

from fantasy_value.constants import PUBLISH_TOP_N
from fantasy_value.projections.models import PlayerProjection

ROUND_DIGITS = 3


def _round(value: float | None) -> float | None:
    return round(value, ROUND_DIGITS) if value is not None else None


def apply_publish_cap(
    projections: Sequence[PlayerProjection], *, top_n: int = PUBLISH_TOP_N
) -> tuple[list[PlayerProjection], int]:
    """Publish cap (user requirement): keep only the top `top_n` players by
    ascending PPR ADP. Players with no ADP at all are excluded from the cut
    -- ADP ordering is undefined for them -- and the excluded count is
    returned so it can be surfaced as an INFO validation issue.
    """
    with_adp = [p for p in projections if p.adp is not None]
    without_adp = len(projections) - len(with_adp)
    ranked = sorted(with_adp, key=lambda p: p.adp)  # type: ignore[arg-type,return-value]
    return ranked[:top_n], without_adp


def _sort_key(proj: PlayerProjection) -> tuple[bool, float, str]:
    return (proj.adp is None, proj.adp if proj.adp is not None else math.inf, proj.player_id)


def build_snapshot(
    projections: Sequence[PlayerProjection],
    *,
    season: int,
    source: str,
    projection_company: str | None,
    aggregation: str,
    generated_at: datetime,
    validation_warnings: int,
    projection_type: str = "preseason",
) -> dict[str, Any]:
    ordered = sorted(projections, key=_sort_key)

    players: list[dict[str, Any]] = []
    for proj in ordered:
        players.append(
            {
                "player_id": proj.player_id,
                "name": proj.player_name,
                "first_name": proj.first_name,
                "last_name": proj.last_name,
                "team": proj.team,
                "position": proj.position,
                "fantasy_positions": list(proj.fantasy_positions),
                "weeks_included": proj.weeks_included,
                "pass_att": _round(proj.pass_att),
                "pass_cmp": _round(proj.pass_cmp),
                "pass_yds": _round(proj.pass_yds),
                "pass_tds": _round(proj.pass_tds),
                "pass_int": _round(proj.pass_int),
                "rush_att": _round(proj.rush_att),
                "rush_yds": _round(proj.rush_yds),
                "rush_tds": _round(proj.rush_tds),
                "receptions": _round(proj.receptions),
                "rec_yds": _round(proj.rec_yds),
                "rec_tds": _round(proj.rec_tds),
                "rec_tgt": _round(proj.rec_tgt),
                "fumbles_lost": _round(proj.fumbles_lost),
                "games_proj": _round(proj.games_proj),
                "adp": _round(proj.adp),
                "pos_adp": _round(proj.pos_adp),
                "reference_pts_ppr": _round(proj.reference_pts_ppr),
                "search_full_name": proj.search_full_name,
            }
        )

    return {
        "metadata": {
            "season": season,
            "source": source,
            "projection_company": projection_company,
            "projection_type": projection_type,
            "aggregation": aggregation,
            "generated_at": generated_at.isoformat(),
            "player_count": len(players),
            "validation_warnings": validation_warnings,
        },
        "players": players,
    }


def verify_snapshot(snapshot: Any) -> None:
    """Readback verification for write_validated_json: re-checks the
    re-parsed snapshot before it's allowed to replace the last-good file."""
    if not isinstance(snapshot, dict):
        raise ValueError("snapshot is not a JSON object")
    metadata = snapshot.get("metadata")
    players = snapshot.get("players")
    if not isinstance(metadata, dict) or not isinstance(players, list):
        raise ValueError("snapshot missing metadata/players")
    if metadata.get("player_count") != len(players):
        raise ValueError(
            f"metadata.player_count ({metadata.get('player_count')}) != len(players) ({len(players)})"
        )
    for player in players:
        if not player.get("player_id") or not player.get("name") or not player.get("position") or not player.get(
            "team"
        ):
            raise ValueError(f"published player missing a required field: {player}")
