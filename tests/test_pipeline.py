import json
from datetime import datetime, timezone
from pathlib import Path

from fantasy_value.errors import Tier1ValidationError
from fantasy_value.pipeline import PipelineConfig, run_pipeline
from fantasy_value.projections.models import PlayerProjection

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)


def make_proj(player_id: str, adp: float, **overrides) -> PlayerProjection:
    defaults = dict(
        player_id=player_id,
        player_name=f"Player {player_id}",
        first_name="Player",
        last_name=player_id,
        team="BUF",
        position="QB",
        fantasy_positions=("QB",),
        season=2026,
        source="sleeper",
        projection_company="rotowire",
        timestamp=TS,
        weeks_included=17,
        adp=adp,
    )
    defaults.update(overrides)
    return PlayerProjection(**defaults)


class FakeSource:
    def __init__(self, projections: list[PlayerProjection] | None = None, raises: Exception | None = None):
        self._projections = projections or []
        self._raises = raises
        self.projection_company = "rotowire"
        self.aggregation_label = "weeks_1_18_summed"

    @property
    def source_name(self) -> str:
        return "fake"

    def fetch_players(self):
        return {}

    def fetch_projections(self, season: int):
        if self._raises:
            raise self._raises
        return self._projections


class TestPipelineSuccess:
    def test_publishes_snapshot_and_report(self, tmp_path: Path) -> None:
        projections = [make_proj(str(i), adp=float(i)) for i in range(1, 11)]
        source = FakeSource(projections)
        config = PipelineConfig(
            season=2026,
            output_path=tmp_path / "projections.json",
            report_path=tmp_path / "validation-report.json",
            top_n=5,
            run_tier3=False,
        )
        result = run_pipeline(source, config)
        assert result.status == "published"
        assert result.player_count == 5

        snapshot = json.loads(config.output_path.read_text(encoding="utf-8"))
        assert snapshot["metadata"]["player_count"] == 5
        assert snapshot["metadata"]["source"] == "fake"
        assert [p["adp"] for p in snapshot["players"]] == [1.0, 2.0, 3.0, 4.0, 5.0]

        report = json.loads(config.report_path.read_text(encoding="utf-8"))
        assert report["status"] in ("passed", "warned")


class TestPipelineFailurePreservesLastGood(object):
    def test_tier1_failure_does_not_overwrite_previous_snapshot(self, tmp_path: Path) -> None:
        output_path = tmp_path / "projections.json"
        report_path = tmp_path / "validation-report.json"

        good_projections = [make_proj(str(i), adp=float(i)) for i in range(1, 6)]
        good_source = FakeSource(good_projections)
        config = PipelineConfig(
            season=2026, output_path=output_path, report_path=report_path, top_n=5, run_tier3=False
        )
        first_result = run_pipeline(good_source, config)
        assert first_result.status == "published"
        original_bytes = output_path.read_bytes()

        broken_source = FakeSource(raises=Tier1ValidationError("stat_key_canary", "simulated schema drift"))
        second_result = run_pipeline(broken_source, config)

        assert second_result.status == "failed"
        assert output_path.read_bytes() == original_bytes  # untouched

        report = json.loads(report_path.read_text(encoding="utf-8"))
        assert report["status"] == "failed"
        assert report["check"] == "stat_key_canary"

    def test_no_previous_snapshot_and_failure_still_writes_report_only(self, tmp_path: Path) -> None:
        output_path = tmp_path / "projections.json"
        report_path = tmp_path / "validation-report.json"
        config = PipelineConfig(season=2026, output_path=output_path, report_path=report_path, run_tier3=False)

        broken_source = FakeSource(raises=Tier1ValidationError("player_count_minimum", "too few players"))
        result = run_pipeline(broken_source, config)

        assert result.status == "failed"
        assert not output_path.exists()
        assert report_path.exists()
