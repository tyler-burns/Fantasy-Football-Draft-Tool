"""Dumps a real to_scored_players/build_board run to JSON, for a TypeScript
test (frontend/src/lib/__fixtures__/golden-board.json) to assert the TS
valuation port reproduces exactly. Stdlib-only, matching the rest of scripts/.

Usage:
    python scripts/dump_valuation_fixture.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fantasy_value.constants import DATA_PROCESSED
from fantasy_value.projections.models import PlayerProjection
from fantasy_value.scoring.presets import PPR, STANDARD
from fantasy_value.valuation.adapter import to_scored_players
from fantasy_value.valuation.board import build_board
from fantasy_value.valuation.league import FLEX_RB_WR, DEFAULT_LEAGUE
from datetime import datetime, timezone
from dataclasses import replace

OUT_PATH = (
    Path(__file__).resolve().parent.parent / "frontend" / "src" / "lib" / "__fixtures__" / "golden-board.json"
)


def _load_projections() -> list[PlayerProjection]:
    snapshot = json.loads((DATA_PROCESSED / "projections.json").read_text(encoding="utf-8"))
    season = snapshot["metadata"]["season"]
    source = snapshot["metadata"]["source"]
    company = snapshot["metadata"]["projection_company"]
    timestamp = datetime.now(timezone.utc)

    projections = []
    for p in snapshot["players"]:
        projections.append(
            PlayerProjection(
                player_id=p["player_id"],
                player_name=p["name"],
                first_name=p["first_name"],
                last_name=p["last_name"],
                team=p["team"],
                position=p["position"],
                fantasy_positions=tuple(p["fantasy_positions"]),
                season=season,
                source=source,
                projection_company=company,
                timestamp=timestamp,
                weeks_included=p["weeks_included"],
                pass_att=p["pass_att"],
                pass_cmp=p["pass_cmp"],
                pass_yds=p["pass_yds"],
                pass_tds=p["pass_tds"],
                pass_int=p["pass_int"],
                rush_att=p["rush_att"],
                rush_yds=p["rush_yds"],
                rush_tds=p["rush_tds"],
                receptions=p["receptions"],
                rec_yds=p["rec_yds"],
                rec_tds=p["rec_tds"],
                rec_tgt=p["rec_tgt"],
                fumbles_lost=p["fumbles_lost"],
                games_proj=p["games_proj"],
                adp=p["adp"],
                pos_adp=p["pos_adp"],
                reference_pts_ppr=p["reference_pts_ppr"],
                search_full_name=p["search_full_name"],
            )
        )
    return projections


def _dump_scenario(projections: list[PlayerProjection], scoring_config, league_config, drafted: set[str]) -> dict:
    pool = to_scored_players(projections, scoring_config)
    board = build_board(pool, league_config, drafted=drafted)
    return {
        "replacement_levels": {k: v for k, v in board.replacement_levels.items()},
        "players": {
            pv.player_id: {"position": pv.position, "points": pv.points, "par": pv.par, "vona": pv.vona}
            for pv in board.players
        },
    }


def main() -> None:
    projections = _load_projections()

    default_scenario = _dump_scenario(projections, PPR, DEFAULT_LEAGUE, drafted=set())

    ids_sorted_by_adp = sorted(
        (p for p in projections if p.adp is not None), key=lambda p: p.adp  # type: ignore[arg-type,return-value]
    )
    drafted_ids = {p.player_id for p in ids_sorted_by_adp[:30]}
    variant_league = replace(DEFAULT_LEAGUE, teams=10, flex_positions=FLEX_RB_WR)
    variant_scenario = _dump_scenario(projections, STANDARD, variant_league, drafted=drafted_ids)

    fixture = {
        "default": default_scenario,
        "variant": {
            **variant_scenario,
            "drafted_ids": sorted(drafted_ids),
        },
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
