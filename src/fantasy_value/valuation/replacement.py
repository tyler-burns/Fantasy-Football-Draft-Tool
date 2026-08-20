from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping, Sequence

from fantasy_value.valuation.league import LeagueConfig
from fantasy_value.valuation.models import ScoredPlayer, group_by_position, rank_key


@dataclass(frozen=True, slots=True)
class StarterAllocation:
    """Implementation detail of the greedy allocation (spec Section 15) --
    not part of the swap contract (see ReplacementLevelFn), exposed so the
    "FLEX slots actually consumed" claim is directly testable."""

    dedicated: Mapping[str, int]
    flex: Mapping[str, int]
    cutoff: Mapping[str, int]
    flex_player_ids: tuple[str, ...]


def allocate_starters(pool: Sequence[ScoredPlayer], league: LeagueConfig) -> StarterAllocation:
    groups = group_by_position(pool)

    dedicated: dict[str, int] = {}
    for position in groups:
        demand = league.dedicated_demand(position)
        dedicated[position] = min(demand, len(groups[position]))

    candidates: list[ScoredPlayer] = []
    for position, group in groups.items():
        leftovers = group[dedicated[position] :]
        candidates.extend(p for p in leftovers if p.eligible_positions & league.flex_positions)
    candidates.sort(key=rank_key)

    chosen = candidates[: league.flex_demand]
    flex: dict[str, int] = {position: 0 for position in groups}
    for p in chosen:
        flex[p.position] += 1

    cutoff = {position: dedicated[position] + flex[position] for position in groups}

    return StarterAllocation(
        dedicated=dedicated,
        flex=flex,
        cutoff=cutoff,
        flex_player_ids=tuple(p.player_id for p in chosen),
    )


def compute_replacement_levels(pool: Sequence[ScoredPlayer], league: LeagueConfig) -> dict[str, float | None]:
    """Section 15: replacement level per position = the first unallocated
    player after that position's dedicated+FLEX cutoff, or None if the
    position has no configured demand or the pool is exhausted at the
    cutoff. Pure; does not mutate or retain `pool`.
    """
    groups = group_by_position(pool)
    allocation = allocate_starters(pool, league)

    positions = set(groups) | set(league.starter_slots)
    levels: dict[str, float | None] = {}
    for position in positions:
        if not league.values_position(position):
            levels[position] = None
            continue
        group = groups.get(position, [])
        cut = allocation.cutoff.get(position, 0)
        levels[position] = group[cut].points if cut < len(group) else None

    return levels


ReplacementLevelFn = Callable[[Sequence[ScoredPlayer], LeagueConfig], "dict[str, float | None]"]
