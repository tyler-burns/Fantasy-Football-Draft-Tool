import fantasy_value
from fantasy_value.projections.base import ProjectionSource
from fantasy_value.projections.models import PlayerProjection, STAT_FIELDS


def test_package_imports() -> None:
    assert fantasy_value.__version__


def test_stat_fields_default_to_zero() -> None:
    from datetime import datetime, timezone

    proj = PlayerProjection(
        player_id="1",
        player_name="Test Player",
        first_name="Test",
        last_name="Player",
        team="BUF",
        position="QB",
        fantasy_positions=("QB",),
        season=2026,
        source="sleeper",
        projection_company="rotowire",
        timestamp=datetime.now(timezone.utc),
        weeks_included=0,
    )
    for name in STAT_FIELDS:
        assert proj.stat(name) == 0.0
    assert proj.adp is None
    assert proj.completion_pct == 0.0


def test_protocol_isinstance_check() -> None:
    class FakeSource:
        @property
        def source_name(self) -> str:
            return "fake"

        def fetch_players(self):
            return {}

        def fetch_projections(self, season: int):
            return []

    assert isinstance(FakeSource(), ProjectionSource)
