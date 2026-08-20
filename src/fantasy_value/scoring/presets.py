from __future__ import annotations

from dataclasses import replace

from fantasy_value.scoring.models import ScoringConfig

# Section 13 YAML verbatim.
PPR = ScoringConfig(
    pass_yds_per_point=25.0,
    pass_td_points=4.0,
    pass_int_points=-2.0,
    rush_yds_per_point=10.0,
    rush_td_points=6.0,
    reception_points=1.0,
    rec_yds_per_point=10.0,
    rec_td_points=6.0,
    fumble_lost_points=-2.0,
)

# Section 13 gives no separate Half-PPR/Standard tables; by universal league
# convention they differ from PPR in reception_points alone. Derived rather
# than retyped so that invariant can't drift.
HALF_PPR = replace(PPR, reception_points=0.5)
STANDARD = replace(PPR, reception_points=0.0)

PRESETS: dict[str, ScoringConfig] = {
    "ppr": PPR,
    "half_ppr": HALF_PPR,
    "standard": STANDARD,
}


def get_preset(name: str) -> ScoringConfig:
    try:
        return PRESETS[name.strip().lower()]
    except KeyError:
        raise ValueError(f"unknown scoring preset {name!r}; known presets: {', '.join(sorted(PRESETS))}") from None
