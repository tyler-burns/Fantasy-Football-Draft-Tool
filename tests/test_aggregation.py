from fantasy_value.projections.sleeper.aggregate import aggregate_weeks, has_real_stats
from fantasy_value.projections.sleeper.keys import SUM_STAT_KEYS
from tests.fixtures_builder import make_placeholder, make_record, make_week


class TestHasRealStats:
    def test_true_when_gp_present(self) -> None:
        assert has_real_stats(make_record("1", stats={"gp": 1.0}))

    def test_false_for_placeholder(self) -> None:
        assert not has_real_stats(make_placeholder("1"))

    def test_false_for_empty_stats(self) -> None:
        assert not has_real_stats({"player_id": "1", "stats": {}})


class TestAggregateWeeks:
    def test_player_present_all_weeks_sums_plainly(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", stats={"pass_yd": 250.0, "gp": 1.0})]),
            2: make_week(2, [make_record("1", stats={"pass_yd": 300.0, "gp": 1.0})]),
            3: make_week(3, [make_record("1", stats={"pass_yd": 275.0, "gp": 1.0})]),
        }
        result = aggregate_weeks(weekly)
        agg = result["1"]
        assert agg.totals["pass_yd"] == 825.0
        assert agg.totals["gp"] == 3.0
        assert agg.weeks_included == 3
        assert agg.weeks_seen == (1, 2, 3)

    def test_player_absent_from_a_week_contributes_zero_not_dropped(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", stats={"pass_yd": 250.0, "gp": 1.0})]),
            2: make_week(2, []),  # player entirely absent
            3: make_week(3, [make_record("1", stats={"pass_yd": 275.0, "gp": 1.0})]),
        }
        result = aggregate_weeks(weekly)
        agg = result["1"]
        assert agg.totals["pass_yd"] == 525.0
        assert agg.weeks_included == 2
        assert agg.weeks_seen == (1, 3)

    def test_placeholder_only_week_contributes_zero_stats_but_adp_still_resolves(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", stats={"pass_yd": 250.0, "gp": 1.0, "adp_dd_ppr": 12.5})]),
            2: make_week(2, [make_placeholder("1", adp=12.5)]),  # bye week: placeholder only
            3: make_week(3, [make_record("1", stats={"pass_yd": 275.0, "gp": 1.0, "adp_dd_ppr": 12.5})]),
        }
        result = aggregate_weeks(weekly)
        agg = result["1"]
        assert agg.totals["pass_yd"] == 525.0  # only real weeks summed
        assert agg.weeks_included == 2  # placeholder week doesn't count
        assert agg.latest["adp_dd_ppr"] == 12.5  # still resolves from the placeholder

    def test_adp_changes_across_weeks_latest_non_null_wins(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", stats={"gp": 1.0, "adp_dd_ppr": 20.0})]),
            2: make_week(2, [make_record("1", stats={"gp": 1.0, "adp_dd_ppr": 18.5})]),
            3: make_week(3, [make_record("1", stats={"gp": 1.0, "adp_dd_ppr": 17.0})]),
        }
        result = aggregate_weeks(weekly)
        assert result["1"].latest["adp_dd_ppr"] == 17.0

    def test_cmp_pct_never_appears_in_aggregate_output(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", stats={"gp": 1.0, "cmp_pct": 0.65})]),
        }
        result = aggregate_weeks(weekly)
        agg = result["1"]
        assert "cmp_pct" not in agg.totals
        assert "cmp_pct" not in agg.latest
        assert set(SUM_STAT_KEYS).isdisjoint({"cmp_pct"})

    def test_player_with_gp_in_no_week_never_appears_in_aggregate(self) -> None:
        weekly = {
            1: make_week(1, [make_placeholder("1")]),
            2: make_week(2, [make_placeholder("1")]),
        }
        result = aggregate_weeks(weekly)
        assert "1" not in result

    def test_reference_weeks_missing_tracks_absent_pts_ppr(self) -> None:
        weekly = {
            1: make_week(
                1,
                [make_record("1", stats={"gp": 1.0, "pts_ppr": 20.0, "pts_half_ppr": 18.0, "pts_std": 16.0})],
            ),
            2: make_week(2, [make_record("1", stats={"gp": 1.0})]),  # all reference keys absent this week
        }
        result = aggregate_weeks(weekly)
        agg = result["1"]
        assert agg.totals["pts_ppr"] == 20.0
        assert agg.reference_weeks_missing == 1

    def test_identity_record_is_latest_real_stat_record(self) -> None:
        weekly = {
            1: make_week(1, [make_record("1", team="BUF", stats={"gp": 1.0})]),
            2: make_week(2, [make_record("1", team="LAR", stats={"gp": 1.0})]),  # traded
        }
        result = aggregate_weeks(weekly)
        assert result["1"].identity_record["team"] == "LAR"


class TestAggregateWeeksAgainstRealFixtures:
    def test_two_week_arithmetic_on_real_fixtures(self, week1_sample: list[dict], week2_sample: list[dict]) -> None:
        weekly = {1: week1_sample, 2: week2_sample}
        result = aggregate_weeks(weekly)

        w1_by_id = {r["player_id"]: r for r in week1_sample}
        w2_by_id = {r["player_id"]: r for r in week2_sample}

        checked_any = False
        for pid, agg in result.items():
            w1 = w1_by_id.get(pid)
            w2 = w2_by_id.get(pid)
            expected_pass_yd = 0.0
            expected_weeks = 0
            if w1 and has_real_stats(w1):
                expected_pass_yd += float((w1["stats"].get("pass_yd")) or 0.0)
                expected_weeks += 1
            if w2 and has_real_stats(w2):
                expected_pass_yd += float((w2["stats"].get("pass_yd")) or 0.0)
                expected_weeks += 1
            assert agg.totals.get("pass_yd", 0.0) == expected_pass_yd
            assert agg.weeks_included == expected_weeks
            checked_any = True
        assert checked_any

    def test_bye_composition_flip_between_week1_and_week2_sample(
        self, week1_sample: list[dict], week2_sample: list[dict]
    ) -> None:
        # Confirmed manually: 3 player_ids are real-stat in week1 but
        # placeholder-only in week2 in the committed fixtures. Their
        # aggregate should still include them with weeks_included == 1.
        w1_real = {r["player_id"] for r in week1_sample if has_real_stats(r)}
        w2_real = {r["player_id"] for r in week2_sample if has_real_stats(r)}
        flipped = w1_real - w2_real
        assert flipped, "expected fixture to contain at least one week1-real/week2-placeholder player"

        result = aggregate_weeks({1: week1_sample, 2: week2_sample})
        for pid in flipped:
            assert result[pid].weeks_included == 1
