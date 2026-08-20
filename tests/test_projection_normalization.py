from datetime import datetime, timezone

from fantasy_value.players.store import PlayerStore, parse_player_master
from fantasy_value.projections.sleeper.aggregate import aggregate_weeks
from fantasy_value.projections.sleeper.normalize import normalize_all, normalize_player
from tests.fixtures_builder import make_record, make_week

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)


class TestFieldMapping:
    def test_singular_to_plural_renames(self) -> None:
        weekly = {
            1: make_week(
                1,
                [
                    make_record(
                        "1",
                        stats={
                            "gp": 1.0,
                            "pass_yd": 250.0,
                            "pass_td": 2.0,
                            "rush_yd": 40.0,
                            "rush_td": 1.0,
                            "rec_yd": 10.0,
                            "rec_td": 0.0,
                        },
                    )
                ],
            )
        }
        agg = aggregate_weeks(weekly)["1"]
        proj = normalize_player(agg, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS)
        assert proj.pass_yds == 250.0
        assert proj.pass_tds == 2.0
        assert proj.rush_yds == 40.0
        assert proj.rush_tds == 1.0
        assert proj.rec_yds == 10.0
        assert proj.rec_tds == 0.0

    def test_fum_lost_used_not_fum(self) -> None:
        weekly = {1: make_week(1, [make_record("1", stats={"gp": 1.0, "fum": 5.0, "fum_lost": 2.0})])}
        agg = aggregate_weeks(weekly)["1"]
        proj = normalize_player(agg, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS)
        assert proj.fumbles_lost == 2.0  # not 5.0

    def test_missing_stat_key_defaults_to_zero_not_none(self) -> None:
        weekly = {1: make_week(1, [make_record("1", stats={"gp": 1.0})])}
        agg = aggregate_weeks(weekly)["1"]
        proj = normalize_player(agg, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS)
        assert proj.pass_yds == 0.0
        assert proj.rec_yds == 0.0
        assert isinstance(proj.pass_yds, float)

    def test_missing_adp_stays_none_not_zero(self) -> None:
        weekly = {1: make_week(1, [make_record("1", stats={"gp": 1.0})])}
        agg = aggregate_weeks(weekly)["1"]
        proj = normalize_player(agg, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS)
        assert proj.adp is None
        assert proj.pos_adp is None

    def test_season_coerced_from_string(self) -> None:
        weekly = {1: make_week(1, [make_record("1", stats={"gp": 1.0})])}
        agg = aggregate_weeks(weekly)["1"]
        proj = normalize_player(agg, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS)
        assert proj.season == 2026
        assert isinstance(proj.season, int)


class TestPlayerMasterJoin:
    def test_join_produces_full_name_and_external_ids(self, players_sample: dict, week1_sample: list) -> None:
        players = PlayerStore.from_master_payload(players_sample)
        weekly = {1: week1_sample}
        aggregates = aggregate_weeks(weekly)
        projections = normalize_all(aggregates, players=players, season=2026, source_name="sleeper", timestamp=TS)

        joined = [p for p in projections if players.get(p.player_id) is not None]
        assert joined, "expected at least one projection to join against the real player master fixture"
        for proj in joined:
            master_player = players.get(proj.player_id)
            assert master_player is not None
            if master_player.full_name:
                assert proj.player_name == master_player.full_name

    def test_gsis_id_is_stripped(self, players_sample: dict) -> None:
        players = PlayerStore.from_master_payload(players_sample)
        stripped_ids = [
            p.external_ids.gsis_id for p in players.players.values() if p.external_ids.gsis_id is not None
        ]
        for gsis_id in stripped_ids:
            assert gsis_id == gsis_id.strip()
            assert not gsis_id.startswith(" ")

    def test_missing_identity_becomes_none_not_string(self) -> None:
        raw = {
            "999": {
                "player_id": "999",
                "full_name": None,
                "first_name": None,
                "last_name": None,
                "position": None,
                "team": None,
            }
        }
        players = parse_player_master(raw)
        assert players["999"].position is None
        assert players["999"].full_name is None


class TestNormalizeAll:
    def test_normalize_all_covers_every_real_stat_player(self, week1_sample: list) -> None:
        from fantasy_value.projections.sleeper.aggregate import has_real_stats

        weekly = {1: week1_sample}
        aggregates = aggregate_weeks(weekly)
        real_ids = {r["player_id"] for r in week1_sample if has_real_stats(r)}
        projections = normalize_all(
            aggregates, players=PlayerStore({}), season=2026, source_name="sleeper", timestamp=TS
        )
        assert {p.player_id for p in projections} == real_ids
