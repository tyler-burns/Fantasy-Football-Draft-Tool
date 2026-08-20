from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fantasy_value.errors import ManualCsvError
from fantasy_value.players.models import Player
from fantasy_value.projections.models import STAT_FIELDS, PlayerProjection

REQUIRED_COLUMNS: tuple[str, ...] = (
    "player_id",
    "player_name",
    "team",
    "position",
    "season",
    *STAT_FIELDS,
)
OPTIONAL_COLUMNS: tuple[str, ...] = (
    "first_name",
    "last_name",
    "fantasy_positions",
    "adp",
    "pos_adp",
    "reference_pts_ppr",
    "weeks_included",
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_float(value: str) -> float:
    value = value.strip()
    return float(value) if value else 0.0


def _parse_optional_float(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    return float(value)


def _parse_optional_str(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


class ManualCsvProjectionSource:
    """Emergency fallback (spec Section 10): reads a hand-supplied CSV
    matching the canonical schema, bypassing the Sleeper API entirely. Any
    projection source a user can export to CSV becomes usable this way.
    Implements the same ProjectionSource Protocol so it gets Tier 2/3
    validation for free; Tier 1 (API-payload-specific) does not apply here.
    """

    def __init__(self, *, csv_path: Path, clock: Callable[[], datetime] = _utcnow) -> None:
        self.csv_path = csv_path
        self._clock = clock

    @property
    def source_name(self) -> str:
        return "manual-csv"

    @property
    def aggregation_label(self) -> str:
        return "manual"

    def fetch_players(self) -> dict[str, Player]:
        return {}

    def fetch_projections(self, season: int) -> list[PlayerProjection]:
        with open(self.csv_path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                raise ManualCsvError(f"{self.csv_path}: file has no header row")
            missing_columns = [c for c in REQUIRED_COLUMNS if c not in reader.fieldnames]
            if missing_columns:
                raise ManualCsvError(f"{self.csv_path}: missing required column(s): {', '.join(missing_columns)}")

            timestamp = self._clock()
            projections: list[PlayerProjection] = []
            for row_number, row in enumerate(reader, start=2):
                projections.append(self._parse_row(row, row_number=row_number, season=season, timestamp=timestamp))
            return projections

    def _parse_row(
        self, row: dict[str, str | None], *, row_number: int, season: int, timestamp: datetime
    ) -> PlayerProjection:
        try:
            fantasy_positions_raw = row.get("fantasy_positions") or ""
            fantasy_positions = tuple(p.strip() for p in fantasy_positions_raw.split("|") if p.strip())
            position = _parse_optional_str(row.get("position"))

            stat_kwargs = {field: _parse_float(row.get(field) or "") for field in STAT_FIELDS}

            return PlayerProjection(
                player_id=_parse_optional_str(row.get("player_id")) or "",
                player_name=_parse_optional_str(row.get("player_name")),
                first_name=_parse_optional_str(row.get("first_name")),
                last_name=_parse_optional_str(row.get("last_name")),
                team=_parse_optional_str(row.get("team")),
                position=position,
                fantasy_positions=fantasy_positions or ((position,) if position else ()),
                season=int(row.get("season") or season),
                source=self.source_name,
                projection_company=None,
                timestamp=timestamp,
                weeks_included=int(_parse_optional_float(row.get("weeks_included")) or 0),
                adp=_parse_optional_float(row.get("adp")),
                pos_adp=_parse_optional_float(row.get("pos_adp")),
                reference_pts_ppr=_parse_optional_float(row.get("reference_pts_ppr")),
                **stat_kwargs,
            )
        except ValueError as exc:
            raise ManualCsvError(f"{self.csv_path}: row {row_number}: {exc}") from exc
