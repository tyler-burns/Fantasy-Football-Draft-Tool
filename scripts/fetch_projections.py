"""Fetch and cache raw Sleeper data to data/raw/. Network only — does not
normalize, aggregate, or validate. Run this, then normalize_projections.py
or build_dataset.py against the resulting cache.

Usage:
    python scripts/fetch_projections.py [--season 2026] [--weeks 1-18] [--max-week-age-hours N]
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fantasy_value.cache import RawCache
from fantasy_value.constants import DATA_RAW, DEFAULT_SEASON, REGULAR_SEASON_WEEKS
from fantasy_value.projections.sleeper.client import SleeperClient

logger = logging.getLogger("fetch_projections")


def _parse_weeks(spec: str) -> list[int]:
    if "-" in spec:
        start, end = spec.split("-", 1)
        return list(range(int(start), int(end) + 1))
    return [int(spec)]


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON)
    parser.add_argument("--weeks", type=str, default=f"{REGULAR_SEASON_WEEKS[0]}-{REGULAR_SEASON_WEEKS[-1]}")
    parser.add_argument(
        "--max-week-age-hours",
        type=float,
        default=None,
        help="Reuse a cached week response younger than this many hours instead of refetching. "
        "Default: always refetch.",
    )
    args = parser.parse_args()

    weeks = _parse_weeks(args.weeks)
    week_cache_max_age = timedelta(hours=args.max_week_age_hours) if args.max_week_age_hours is not None else None

    cache = RawCache(DATA_RAW)
    client = SleeperClient(cache=cache, week_cache_max_age=week_cache_max_age)

    logger.info("Fetching player master (cache-first, max age 1 day)...")
    players = client.fetch_player_master()
    logger.info("  %d players in master", len(players))

    for week in weeks:
        logger.info("Fetching season=%d week=%d...", args.season, week)
        records = client.fetch_week(args.season, week)
        logger.info("  %d records", len(records))

    logger.info("Done. Raw cache at %s", DATA_RAW)


if __name__ == "__main__":
    main()
