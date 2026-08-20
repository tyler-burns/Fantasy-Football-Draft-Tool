"""Helpers for building ScoredPlayer pools for valuation tests. Not a test
module itself -- imported by test files (mirrors tests/fixtures_builder.py).
"""

from __future__ import annotations

import random

from fantasy_value.valuation.models import ScoredPlayer


def player(player_id: str, position: str, points: float, *, eligible: tuple[str, ...] = ()) -> ScoredPlayer:
    return ScoredPlayer(player_id=player_id, position=position, points=points, eligible_positions=frozenset(eligible))


def rb_trio() -> list[ScoredPlayer]:
    # Spec Section 17.1's exact required case.
    return [
        player("rb1", "RB", 250.0),
        player("rb2", "RB", 225.0),
        player("rb3", "RB", 220.0),
    ]


def _curve(prefix: str, position: str, count: int, start: float, step: float) -> list[ScoredPlayer]:
    return [player(f"{prefix}{i}", position, start - step * (i - 1)) for i in range(1, count + 1)]


def make_pool(*, te_curve: str = "steep") -> list[ScoredPlayer]:
    """Canonical worked-example pool (30 QB / 40 RB / 40 WR / 20 TE) with
    distinct, non-colliding point curves so no tie-break is load-bearing.
    Shuffled with a fixed seed so tests implicitly prove order-independence.
    """
    qb = _curve("qb", "QB", 30, start=300.0, step=5.0)  # QB1=300 ... QB13=240
    rb = _curve("rb", "RB", 40, start=250.0, step=4.0)  # RB1=250 ... RB25=154
    wr = _curve("wr", "WR", 40, start=241.0, step=4.0)  # WR1=241 ... WR25=145

    if te_curve == "steep":
        te = _curve("te", "TE", 20, start=300.0, step=12.0)  # TE1=300 ... TE13=156
    elif te_curve == "flat":
        te = _curve("te", "TE", 20, start=200.0, step=8.0)  # TE1=200 ... TE13=104
    else:
        raise ValueError(f"unknown te_curve {te_curve!r}")

    pool = qb + rb + wr + te
    random.Random(42).shuffle(pool)
    return pool
