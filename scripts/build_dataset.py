"""Phase 1 deliverable: fetch (from cache or network) -> normalize ->
validate -> cap to top-N by ADP -> publish data/processed/projections.json
and data/processed/validation-report.json.

Usage:
    python scripts/build_dataset.py [--season 2026] [--offline] [--no-tier3] [--top-n 300]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fantasy_value.cache import RawCache
from fantasy_value.constants import DATA_PROCESSED, DATA_RAW, DEFAULT_SEASON, PUBLISH_TOP_N
from fantasy_value.pipeline import PipelineConfig, run_pipeline
from fantasy_value.projections.manual_csv import ManualCsvProjectionSource
from fantasy_value.projections.sleeper.client import SleeperClient
from fantasy_value.projections.sleeper.source import SleeperProjectionSource


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON)
    parser.add_argument("--offline", action="store_true", help="Fail instead of hitting the network; cache-only.")
    parser.add_argument("--no-tier3", action="store_true", help="Skip the Tier 3 reference-PPR cross-check.")
    parser.add_argument("--top-n", type=int, default=PUBLISH_TOP_N)
    parser.add_argument(
        "--manual-csv",
        type=Path,
        default=None,
        help="Bypass the Sleeper API and publish from a hand-supplied CSV matching the canonical schema "
        "(see docs/data-pipeline.md for required columns).",
    )
    args = parser.parse_args()

    if args.manual_csv:
        source = ManualCsvProjectionSource(csv_path=args.manual_csv)
    else:
        cache = RawCache(DATA_RAW)
        client = SleeperClient(cache=cache, offline=args.offline)
        source = SleeperProjectionSource(client=client)

    config = PipelineConfig(
        season=args.season,
        output_path=DATA_PROCESSED / "projections.json",
        report_path=DATA_PROCESSED / "validation-report.json",
        top_n=args.top_n,
        run_tier3=not args.no_tier3,
    )

    result = run_pipeline(source, config)

    if result.status != "published":
        print(f"FAILED: {result.error}", file=sys.stderr)
        sys.exit(1)

    print(f"Published {result.player_count} players to {result.output_path}")
    print(f"Validation report: {result.report_path}")


if __name__ == "__main__":
    main()
