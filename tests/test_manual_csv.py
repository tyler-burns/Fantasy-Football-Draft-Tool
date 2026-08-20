from datetime import datetime, timezone
from pathlib import Path

import pytest

from fantasy_value.errors import ManualCsvError
from fantasy_value.pipeline import PipelineConfig, run_pipeline
from fantasy_value.projections.manual_csv import REQUIRED_COLUMNS, ManualCsvProjectionSource

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)

HEADER = ",".join(REQUIRED_COLUMNS)
HEADER_WITH_ADP = ",".join((*REQUIRED_COLUMNS, "adp"))


def _write_csv(path: Path, rows: list[str], header: str = HEADER) -> None:
    path.write_text(header + "\n" + "\n".join(rows) + "\n", encoding="utf-8")


def _default_values(player_id: str, player_name: str) -> dict[str, str]:
    return {
        "player_id": player_id,
        "player_name": player_name,
        "team": "BUF",
        "position": "QB",
        "season": "2026",
        "pass_att": "580",
        "pass_cmp": "390",
        "pass_yds": "4000",
        "pass_tds": "28",
        "pass_int": "10",
        "rush_att": "90",
        "rush_yds": "500",
        "rush_tds": "7",
        "receptions": "0",
        "rec_yds": "0",
        "rec_tds": "0",
        "rec_tgt": "0",
        "fumbles_lost": "3",
        "games_proj": "17",
    }


def _full_row(player_id: str, player_name: str, **overrides: str) -> str:
    values = _default_values(player_id, player_name)
    values.update(overrides)
    return ",".join(values[col] for col in REQUIRED_COLUMNS)


def _row_with_adp(player_id: str, player_name: str, adp: str, **overrides: str) -> str:
    values = _default_values(player_id, player_name)
    values.update(overrides)
    return ",".join(values[col] for col in REQUIRED_COLUMNS) + f",{adp}"


class TestManualCsvSource:
    def test_publishes_from_three_row_csv(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "manual-projections.csv"
        _write_csv(
            csv_path,
            [
                _full_row("1", "Josh Allen"),
                _full_row("2", "Christian McCaffrey", position="RB"),
                _full_row("3", "Puka Nacua", position="WR"),
            ],
        )
        source = ManualCsvProjectionSource(csv_path=csv_path, clock=lambda: TS)
        projections = source.fetch_projections(2026)
        assert len(projections) == 3
        assert projections[0].player_name == "Josh Allen"
        assert projections[0].pass_yds == 4000.0
        assert projections[0].source == "manual-csv"

    def test_missing_required_column_raises(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "manual-projections.csv"
        bad_header = HEADER.replace("pass_yds,", "")
        _write_csv(csv_path, [_full_row("1", "Josh Allen").replace("4000,", "")], header=bad_header)
        source = ManualCsvProjectionSource(csv_path=csv_path, clock=lambda: TS)
        with pytest.raises(ManualCsvError):
            source.fetch_projections(2026)

    def test_blank_stat_cell_defaults_to_zero(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "manual-projections.csv"
        _write_csv(csv_path, [_full_row("1", "Josh Allen", rec_yds="")])
        source = ManualCsvProjectionSource(csv_path=csv_path, clock=lambda: TS)
        projections = source.fetch_projections(2026)
        assert projections[0].rec_yds == 0.0

    def test_blank_identity_cell_becomes_none(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "manual-projections.csv"
        _write_csv(csv_path, [_full_row("1", "Josh Allen", team="")])
        source = ManualCsvProjectionSource(csv_path=csv_path, clock=lambda: TS)
        projections = source.fetch_projections(2026)
        assert projections[0].team is None

    def test_end_to_end_through_pipeline(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "manual-projections.csv"
        _write_csv(
            csv_path,
            [
                _row_with_adp("1", "Josh Allen", "1.0"),
                _row_with_adp("2", "Christian McCaffrey", "2.0", position="RB"),
                _row_with_adp("3", "Puka Nacua", "3.0", position="WR"),
            ],
            header=HEADER_WITH_ADP,
        )
        source = ManualCsvProjectionSource(csv_path=csv_path, clock=lambda: TS)
        config = PipelineConfig(
            season=2026,
            output_path=tmp_path / "projections.json",
            report_path=tmp_path / "validation-report.json",
            top_n=300,
            run_tier3=False,
            clock=lambda: TS,
        )
        result = run_pipeline(source, config)
        assert result.status == "published"
        assert result.player_count == 3
