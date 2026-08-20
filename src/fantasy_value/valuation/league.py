from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

# Spec Section 14 says "DST"; the canonical position token carried on
# PlayerProjection (and constants.FETCH_POSITIONS) is "DEF".
DEF_POSITION = "DEF"

FLEX_RB_WR: frozenset[str] = frozenset({"RB", "WR"})
FLEX_RB_WR_TE: frozenset[str] = frozenset({"RB", "WR", "TE"})  # Section 14.1 default


@dataclass(frozen=True, slots=True)
class LeagueConfig:
    """Section 14. Per-team starter counts; demand at any position is
    teams * slots. No field defaults (mirrors ScoringConfig) -- a partially
    specified league would silently inherit assumptions about FLEX demand
    the caller never stated. Use DEFAULT_LEAGUE or dataclasses.replace(...)."""

    teams: int
    qb_slots: int
    rb_slots: int
    wr_slots: int
    te_slots: int
    flex_slots: int
    flex_positions: frozenset[str]
    dst_slots: int
    k_slots: int
    bench_slots: int

    def __post_init__(self) -> None:
        object.__setattr__(self, "flex_positions", frozenset(p.strip().upper() for p in self.flex_positions))

        int_fields = (
            "teams",
            "qb_slots",
            "rb_slots",
            "wr_slots",
            "te_slots",
            "flex_slots",
            "dst_slots",
            "k_slots",
            "bench_slots",
        )
        for name in int_fields:
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool):
                raise ValueError(f"{name} must be an int (got {value!r})")

        if self.teams < 1:
            raise ValueError(f"teams must be >= 1 (got {self.teams!r})")

        slot_fields = ("qb_slots", "rb_slots", "wr_slots", "te_slots", "flex_slots", "dst_slots", "k_slots")
        for name in slot_fields:
            value = getattr(self, name)
            if value < 0:
                raise ValueError(f"{name} must be >= 0 (got {value!r})")
        if self.bench_slots < 0:
            raise ValueError(f"bench_slots must be >= 0 (got {self.bench_slots!r})")

        if self.flex_slots > 0 and not self.flex_positions:
            raise ValueError("flex_slots > 0 requires a non-empty flex_positions set")

    @property
    def starter_slots(self) -> Mapping[str, int]:
        return {
            "QB": self.qb_slots,
            "RB": self.rb_slots,
            "WR": self.wr_slots,
            "TE": self.te_slots,
            DEF_POSITION: self.dst_slots,
            "K": self.k_slots,
        }

    def dedicated_demand(self, position: str) -> int:
        return self.teams * self.starter_slots.get(position, 0)

    @property
    def flex_demand(self) -> int:
        return self.teams * self.flex_slots

    def values_position(self, position: str) -> bool:
        return self.dedicated_demand(position) > 0 or (self.flex_demand > 0 and position in self.flex_positions)


# Section 14 verbatim.
DEFAULT_LEAGUE = LeagueConfig(
    teams=12,
    qb_slots=1,
    rb_slots=2,
    wr_slots=2,
    te_slots=1,
    flex_slots=2,
    flex_positions=FLEX_RB_WR_TE,
    dst_slots=1,
    k_slots=1,
    bench_slots=6,
)
