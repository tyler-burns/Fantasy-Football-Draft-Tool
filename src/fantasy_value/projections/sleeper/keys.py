"""Every Sleeper-specific field name and URL fragment used anywhere in this
project lives in this module. Nothing outside `projections/sleeper/` may
reference a Sleeper key directly (Standing Rule #2, enforced by
tests/test_source_isolation.py).
"""

BASE_URL = "https://api.sleeper.app"
PLAYER_MASTER_PATH = "/v1/players/nfl"
PROJECTIONS_PATH_TEMPLATE = "/projections/nfl/{season}/{week}"

FETCH_POSITIONS: tuple[str, ...] = ("QB", "RB", "WR", "TE", "K", "DEF", "FLEX")
SEASON_TYPE = "regular"

# Top-level keys expected on every projection record.
EXPECTED_TOP_LEVEL_KEYS: tuple[str, ...] = ("player_id", "stats", "week", "season")

# Superset of stat keys from spec Section 4.2 used as the schema-drift canary.
# Each must appear on at least one record in a given week's response.
CANARY_STAT_KEYS: tuple[str, ...] = (
    "pass_att",
    "pass_cmp",
    "pass_yd",
    "pass_td",
    "pass_int",
    "rush_att",
    "rush_yd",
    "rush_td",
    "rec",
    "rec_yd",
    "rec_td",
    "rec_tgt",
    "fum_lost",
    "gp",
    "adp_dd_ppr",
)

# Counting stats summed across weeks (spec Section 7.1).
SUM_STAT_KEYS: tuple[str, ...] = (
    "pass_att",
    "pass_cmp",
    "pass_yd",
    "pass_td",
    "pass_int",
    "rush_att",
    "rush_yd",
    "rush_td",
    "rec",
    "rec_yd",
    "rec_td",
    "rec_tgt",
    "fum",
    "fum_lost",
    "gp",
)

# Reference-only totals, summed but never used for valuation (Section 7.3).
REFERENCE_SUM_KEYS: tuple[str, ...] = ("pts_ppr", "pts_half_ppr", "pts_std")

# Rate/rank fields: take the latest non-null value, never sum.
LATEST_KEYS: tuple[str, ...] = ("adp_dd_ppr", "pos_adp_dd_ppr")

GP_KEY = "gp"

# Sleeper stat key -> canonical PlayerProjection field name (spec Section 8.1).
SLEEPER_TO_CANONICAL: dict[str, str] = {
    "pass_att": "pass_att",
    "pass_cmp": "pass_cmp",
    "pass_yd": "pass_yds",
    "pass_td": "pass_tds",
    "pass_int": "pass_int",
    "rush_att": "rush_att",
    "rush_yd": "rush_yds",
    "rush_td": "rush_tds",
    "rec": "receptions",
    "rec_yd": "rec_yds",
    "rec_td": "rec_tds",
    "rec_tgt": "rec_tgt",
    "fum_lost": "fumbles_lost",  # deliberately fum_lost, not fum
    "gp": "games_proj",
}

ADP_KEY = "adp_dd_ppr"
POS_ADP_KEY = "pos_adp_dd_ppr"
REFERENCE_PPR_KEY = "pts_ppr"
