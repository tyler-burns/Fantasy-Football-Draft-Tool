from __future__ import annotations

from dataclasses import dataclass, fields
from datetime import datetime

# The counting-stat fields of PlayerProjection. Kept as an explicit tuple
# (rather than introspecting the dataclass) so tests can assert every one of
# these has a mapping entry in the Sleeper normalizer — an unmapped field
# should fail a test, not silently read 0.0 forever.
STAT_FIELDS: tuple[str, ...] = (
    "pass_att",
    "pass_cmp",
    "pass_yds",
    "pass_tds",
    "pass_int",
    "rush_att",
    "rush_yds",
    "rush_tds",
    "receptions",
    "rec_yds",
    "rec_tds",
    "rec_tgt",
    "fumbles_lost",
    "games_proj",
)

IDENTITY_FIELDS: tuple[str, ...] = (
    "player_id",
    "player_name",
    "position",
    "team",
    "season",
)


@dataclass(frozen=True, slots=True)
class PlayerProjection:
    """Canonical, source-agnostic projection record (spec Section 8).

    No Sleeper (or any other source's) field names may appear here — this is
    the airlock every ProjectionSource must normalize into.
    """

    player_id: str
    player_name: str | None
    first_name: str | None
    last_name: str | None
    team: str | None
    position: str | None
    fantasy_positions: tuple[str, ...]
    season: int
    source: str
    projection_company: str | None
    timestamp: datetime
    weeks_included: int

    pass_att: float = 0.0
    pass_cmp: float = 0.0
    pass_yds: float = 0.0
    pass_tds: float = 0.0
    pass_int: float = 0.0

    rush_att: float = 0.0
    rush_yds: float = 0.0
    rush_tds: float = 0.0

    receptions: float = 0.0
    rec_yds: float = 0.0
    rec_tds: float = 0.0
    rec_tgt: float = 0.0

    fumbles_lost: float = 0.0
    games_proj: float = 0.0

    # Nullable by design: absence means "unranked", not zero. Zeroing ADP
    # would sort an unranked player to the top of every ADP-ordered list.
    adp: float | None = None
    pos_adp: float | None = None

    # Sanity-check only (Section 7.3) — never used in valuation.
    reference_pts_ppr: float | None = None

    # Additive field for future UI search (spec Section 5), not in the
    # Section 12 literal snapshot schema but carried through here.
    search_full_name: str | None = None

    @property
    def completion_pct(self) -> float:
        """Derived, never summed, never stored — computed fresh from the
        aggregated totals so it can't drift out of sync (Section 7.1)."""
        return self.pass_cmp / self.pass_att if self.pass_att else 0.0

    def stat(self, name: str) -> float:
        """Generic accessor over STAT_FIELDS, for validation loops."""
        if name not in STAT_FIELDS:
            raise KeyError(f"{name!r} is not a counting-stat field")
        return getattr(self, name)


def _assert_stat_fields_match_dataclass() -> None:
    dataclass_field_names = {f.name for f in fields(PlayerProjection)}
    missing = set(STAT_FIELDS) - dataclass_field_names
    if missing:
        raise AssertionError(f"STAT_FIELDS references fields not on PlayerProjection: {missing}")


_assert_stat_fields_match_dataclass()
