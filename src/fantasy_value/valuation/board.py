from __future__ import annotations

from typing import AbstractSet, Sequence

from fantasy_value.valuation.league import LeagueConfig
from fantasy_value.valuation.models import PlayerValuation, ScoredPlayer, ValuationBoard
from fantasy_value.valuation.par import compute_par
from fantasy_value.valuation.replacement import ReplacementLevelFn, compute_replacement_levels
from fantasy_value.valuation.vona import compute_vona


def available_players(pool: Sequence[ScoredPlayer], drafted: AbstractSet[str]) -> list[ScoredPlayer]:
    return [p for p in pool if p.player_id not in drafted]


def build_board(
    pool: Sequence[ScoredPlayer],
    league: LeagueConfig,
    *,
    drafted: AbstractSet[str] = frozenset(),
    replacement_fn: ReplacementLevelFn = compute_replacement_levels,
) -> ValuationBoard:
    """Replacement levels come from the FULL pool -- not the post-draft one.
    Replacement level is a function of (player universe, league config), not
    draft state: shrinking the pool while holding starter demand constant
    would systematically overstate scarcity as the draft progresses (in the
    degenerate case, the boundary runs past the end of the pool and PAR
    disappears entirely). VONA is the metric meant to move every pick
    (spec Section 19.4 defaults live-draft ranking to VONA); PAR stays
    stable across the draft as a result. A caller who wants a dynamic
    baseline can simply call compute_replacement_levels(available, league)
    directly -- it's pure and cheap, so nothing is hidden or precluded.
    """
    replacement_levels = replacement_fn(pool, league)
    available = available_players(pool, drafted)
    vona = compute_vona(available)

    players = tuple(
        PlayerValuation(
            player_id=p.player_id,
            position=p.position,
            points=p.points,
            par=compute_par(p, replacement_levels),
            vona=vona.get(p.player_id),
        )
        for p in available
    )

    return ValuationBoard(replacement_levels=replacement_levels, players=players)
