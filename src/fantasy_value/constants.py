from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
DATA_SAMPLE = ROOT / "data" / "sample"

DEFAULT_SEASON = 2026
REGULAR_SEASON_WEEKS: tuple[int, ...] = tuple(range(1, 19))

# Positions fetched from Sleeper (matches Phase 0's raw cache).
FETCH_POSITIONS: tuple[str, ...] = ("QB", "RB", "WR", "TE", "K", "DEF", "FLEX")

# Positions actually published in the snapshot — K/DEF have no scoring stats
# in the canonical model and would publish as misleading all-zero rows.
PUBLISH_POSITIONS: frozenset[str] = frozenset({"QB", "RB", "WR", "TE"})

# Final published player count, capped by ascending PPR ADP (user requirement).
PUBLISH_TOP_N = 300

PLAYER_COUNT_FLOOR = 300
