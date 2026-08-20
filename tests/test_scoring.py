from dataclasses import FrozenInstanceError, fields, replace
from datetime import datetime, timezone

import pytest

from fantasy_value.constants import ROOT
from fantasy_value.projections.models import STAT_FIELDS, PlayerProjection
from fantasy_value.scoring.calculator import score_projection
from fantasy_value.scoring.models import SCORED_STAT_FIELDS, ScoringConfig
from fantasy_value.scoring.presets import HALF_PPR, PPR, PRESETS, STANDARD, get_preset

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)

UNSCORED_STAT_FIELDS = tuple(sorted(set(STAT_FIELDS) - set(SCORED_STAT_FIELDS)))


def make_proj(**overrides) -> PlayerProjection:
    defaults = dict(
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
        timestamp=TS,
        weeks_included=17,
    )
    defaults.update(overrides)
    return PlayerProjection(**defaults)


VALID_CONFIG_KWARGS = dict(
    pass_yds_per_point=25.0,
    pass_td_points=4.0,
    pass_int_points=-2.0,
    rush_yds_per_point=10.0,
    rush_td_points=6.0,
    reception_points=1.0,
    rec_yds_per_point=10.0,
    rec_td_points=6.0,
    fumble_lost_points=-2.0,
)


def make_config(**overrides) -> ScoringConfig:
    kwargs = dict(VALID_CONFIG_KWARGS)
    kwargs.update(overrides)
    return ScoringConfig(**kwargs)


class TestScoringConfig:
    def test_config_is_frozen(self) -> None:
        with pytest.raises(FrozenInstanceError):
            PPR.reception_points = 2.0  # type: ignore[misc]

    @pytest.mark.parametrize(
        "field_name", ["pass_yds_per_point", "rush_yds_per_point", "rec_yds_per_point"]
    )
    def test_zero_yards_per_point_rejected(self, field_name: str) -> None:
        with pytest.raises(ValueError):
            make_config(**{field_name: 0.0})

    @pytest.mark.parametrize(
        "field_name", ["pass_yds_per_point", "rush_yds_per_point", "rec_yds_per_point"]
    )
    def test_negative_yards_per_point_rejected(self, field_name: str) -> None:
        with pytest.raises(ValueError):
            make_config(**{field_name: -10.0})

    @pytest.mark.parametrize("bad_value", [float("nan"), float("inf"), float("-inf")])
    @pytest.mark.parametrize("field_name", ["pass_td_points", "rec_yds_per_point"])
    def test_non_finite_weight_rejected(self, field_name: str, bad_value: float) -> None:
        with pytest.raises(ValueError):
            make_config(**{field_name: bad_value})

    def test_negative_point_values_are_allowed(self) -> None:
        config = make_config(pass_int_points=-6.0, fumble_lost_points=-5.0)
        assert config.pass_int_points == -6.0
        assert config.fumble_lost_points == -5.0

    def test_all_nine_weights_are_required(self) -> None:
        with pytest.raises(TypeError):
            ScoringConfig()  # type: ignore[call-arg]

    def test_config_fields_are_exactly_the_section_13_weights(self) -> None:
        field_names = {f.name for f in fields(ScoringConfig)}
        assert field_names == {
            "pass_yds_per_point",
            "pass_td_points",
            "pass_int_points",
            "rush_yds_per_point",
            "rush_td_points",
            "reception_points",
            "rec_yds_per_point",
            "rec_td_points",
            "fumble_lost_points",
        }

    def test_scored_and_unscored_stat_partition(self) -> None:
        assert set(SCORED_STAT_FIELDS) == {
            "pass_yds",
            "pass_tds",
            "pass_int",
            "rush_yds",
            "rush_tds",
            "receptions",
            "rec_yds",
            "rec_tds",
            "fumbles_lost",
        }
        assert set(STAT_FIELDS) - set(SCORED_STAT_FIELDS) == {
            "pass_att",
            "pass_cmp",
            "rush_att",
            "rec_tgt",
            "games_proj",
        }

    def test_equal_weights_compare_and_hash_equal(self) -> None:
        a = make_config()
        b = make_config()
        assert a == b
        assert hash(a) == hash(b)


class TestPresets:
    def test_ppr_matches_section_13_defaults(self) -> None:
        assert PPR.pass_yds_per_point == 25.0
        assert PPR.pass_td_points == 4.0
        assert PPR.pass_int_points == -2.0
        assert PPR.rush_yds_per_point == 10.0
        assert PPR.rush_td_points == 6.0
        assert PPR.reception_points == 1.0
        assert PPR.rec_yds_per_point == 10.0
        assert PPR.rec_td_points == 6.0
        assert PPR.fumble_lost_points == -2.0

    def test_half_ppr_differs_only_in_reception_points(self) -> None:
        assert HALF_PPR.reception_points == 0.5
        for f in fields(ScoringConfig):
            if f.name == "reception_points":
                continue
            assert getattr(HALF_PPR, f.name) == getattr(PPR, f.name)

    def test_standard_differs_only_in_reception_points(self) -> None:
        assert STANDARD.reception_points == 0.0
        for f in fields(ScoringConfig):
            if f.name == "reception_points":
                continue
            assert getattr(STANDARD, f.name) == getattr(PPR, f.name)

    def test_get_preset_returns_the_shared_instances(self) -> None:
        assert get_preset("ppr") is PPR
        assert get_preset("HALF_PPR") is HALF_PPR
        assert get_preset(" standard ") is STANDARD

    def test_get_preset_unknown_name_raises_with_known_names(self) -> None:
        with pytest.raises(ValueError, match="half_ppr, ppr, standard"):
            get_preset("bogus")

    def test_presets_registry_covers_all_three(self) -> None:
        assert set(PRESETS) == {"ppr", "half_ppr", "standard"}


class TestWorkedExamples:
    def test_section_13_4_josh_allen_worked_example(self) -> None:
        # 4000/25=160, 28*4=112, 10*-2=-20, 500/10=50, 7*6=42 -> 344.0
        proj = make_proj(pass_yds=4000.0, pass_tds=28.0, pass_int=10.0, rush_yds=500.0, rush_tds=7.0)
        assert score_projection(proj, PPR) == 344.0

    def test_section_21_1_given_expect_example(self) -> None:
        # 160 + 80 - 20 = 220
        proj = make_proj(pass_yds=4000.0, pass_tds=20.0, pass_int=10.0)
        assert score_projection(proj, PPR) == 220.0


class TestPPRHalfPPRStandard:
    RECEIVING_LINE = dict(receptions=100.0, rec_yds=1200.0, rec_tds=8.0)  # 120 + 48 = 168 base

    def test_ppr_scores_one_point_per_reception(self) -> None:
        proj = make_proj(**self.RECEIVING_LINE)
        assert score_projection(proj, PPR) == 268.0

    def test_half_ppr_scores_half_a_point_per_reception(self) -> None:
        proj = make_proj(**self.RECEIVING_LINE)
        assert score_projection(proj, HALF_PPR) == 218.0

    def test_standard_scores_no_reception_points(self) -> None:
        proj = make_proj(**self.RECEIVING_LINE)
        assert score_projection(proj, STANDARD) == 168.0

    def test_presets_differ_only_by_the_reception_term(self) -> None:
        proj = make_proj(
            pass_yds=3000.0, pass_tds=20.0, pass_int=8.0, rush_yds=200.0, rush_tds=2.0, fumbles_lost=1.0,
            **self.RECEIVING_LINE,
        )
        ppr_total = score_projection(proj, PPR)
        half_total = score_projection(proj, HALF_PPR)
        std_total = score_projection(proj, STANDARD)
        assert ppr_total - std_total == pytest.approx(proj.receptions * 1.0)
        assert half_total - std_total == pytest.approx(proj.receptions * 0.5)


class TestCustomScoring:
    def test_custom_config_scored_end_to_end(self) -> None:
        config = make_config(
            pass_yds_per_point=20.0,
            pass_td_points=6.0,
            pass_int_points=-3.0,
            rush_yds_per_point=9.0,
            rush_td_points=6.0,
            reception_points=0.75,
            rec_yds_per_point=10.0,
            rec_td_points=4.0,
            fumble_lost_points=-4.0,
        )
        proj = make_proj(
            pass_yds=4000.0, pass_tds=25.0, pass_int=12.0,
            rush_yds=450.0, rush_tds=5.0,
            receptions=20.0, rec_yds=180.0, rec_tds=1.0,
            fumbles_lost=2.0,
        )
        expected = (
            4000.0 / 20.0 + 25.0 * 6.0 + 12.0 * -3.0
            + 450.0 / 9.0 + 5.0 * 6.0
            + 20.0 * 0.75 + 180.0 / 10.0 + 1.0 * 4.0
            + 2.0 * -4.0
        )
        assert score_projection(proj, config) == pytest.approx(expected)

    def test_replace_overrides_a_single_weight(self) -> None:
        proj = make_proj(pass_tds=5.0)
        richer_td = replace(PPR, pass_td_points=6.0)
        assert score_projection(proj, richer_td) - score_projection(proj, PPR) == pytest.approx(2.0 * proj.pass_tds)

    def test_replace_rejects_an_unknown_weight_name(self) -> None:
        with pytest.raises(TypeError):
            replace(PPR, ppr_bonus=1.0)  # type: ignore[call-arg]

    def test_replace_revalidates(self) -> None:
        with pytest.raises(ValueError):
            replace(PPR, rush_yds_per_point=0.0)

    def test_custom_config_does_not_mutate_the_preset(self) -> None:
        replace(PPR, reception_points=0.25)
        assert PPR.reception_points == 1.0


class TestNegativeScoringValues:
    def test_punitive_interception_weight(self) -> None:
        config = replace(PPR, pass_int_points=-6.0)
        proj = make_proj(pass_yds=4000.0, pass_int=10.0)
        assert score_projection(proj, config) == 100.0

    def test_fumble_penalty_applied(self) -> None:
        proj = make_proj(fumbles_lost=3.0)
        assert score_projection(proj, PPR) == -6.0

    def test_total_can_go_negative(self) -> None:
        proj = make_proj(pass_int=20.0, fumbles_lost=5.0)
        assert score_projection(proj, PPR) < 0

    def test_negative_projected_stat_is_scored_through_not_clamped(self) -> None:
        # Deliberate: Tier 2 warns on negative stats but never strips them,
        # and clamping here would mask exactly the mapping bugs Tier 3
        # exists to catch. A real Sleeper record (Cooper Rush, Phase 1) had
        # rush_yds = -0.02.
        proj = make_proj(rush_yds=-20.0)
        assert score_projection(proj, PPR) == -2.0

    def test_negative_stat_and_negative_weight_compose(self) -> None:
        config = replace(PPR, rush_td_points=-6.0)
        proj = make_proj(rush_yds=-30.0, rush_tds=1.0)
        assert score_projection(proj, config) == pytest.approx(-30.0 / 10.0 + 1.0 * -6.0)


class TestFractionalScoring:
    def test_section_13_3_example(self) -> None:
        proj = make_proj(pass_yds=4100.0)
        assert score_projection(proj, PPR) == 164.0

    def test_fractional_yardage_is_not_truncated(self) -> None:
        proj = make_proj(pass_yds=4123.7)
        result = score_projection(proj, PPR)
        assert result == pytest.approx(164.948)
        assert result != 164.0

    def test_fractional_stat_totals_across_categories(self) -> None:
        proj = make_proj(rec_yds=1234.5, receptions=7.0)
        assert score_projection(proj, HALF_PPR) == pytest.approx(126.95)

    def test_fractional_reception_weight(self) -> None:
        proj = make_proj(receptions=7.0)
        assert score_projection(proj, HALF_PPR) == 3.5

    def test_result_is_always_a_float(self) -> None:
        proj = make_proj(pass_yds=4000.0, pass_tds=20)  # int-valued override
        config = make_config(pass_td_points=4)  # int-valued override
        assert isinstance(score_projection(proj, config), float)


class TestZeroAndMissingStats:
    def test_all_zero_stats_score_zero(self) -> None:
        proj = make_proj()
        for config in (PPR, HALF_PPR, STANDARD):
            assert score_projection(proj, config) == 0.0

    def test_missing_stats_need_no_special_handling(self) -> None:
        receiving_only = make_proj(receptions=5.0, rec_yds=60.0, rec_tds=1.0)
        explicit_zeros = make_proj(
            receptions=5.0, rec_yds=60.0, rec_tds=1.0,
            pass_att=0.0, pass_cmp=0.0, pass_yds=0.0, pass_tds=0.0, pass_int=0.0,
            rush_att=0.0, rush_yds=0.0, rush_tds=0.0,
        )
        assert score_projection(receiving_only, PPR) == score_projection(explicit_zeros, PPR)

    def test_unscored_stats_never_affect_the_total(self) -> None:
        baseline = make_proj(rec_yds=100.0)
        with_unscored = make_proj(
            rec_yds=100.0, pass_att=600.0, pass_cmp=400.0, rush_att=100.0, rec_tgt=150.0, games_proj=17.0
        )
        assert score_projection(baseline, PPR) == score_projection(with_unscored, PPR)

    @pytest.mark.parametrize("stat_name", SCORED_STAT_FIELDS)
    def test_every_scored_stat_moves_the_total(self, stat_name: str) -> None:
        baseline = make_proj()
        perturbed = make_proj(**{stat_name: 1.0})
        assert score_projection(perturbed, PPR) != score_projection(baseline, PPR)

    @pytest.mark.parametrize("stat_name", UNSCORED_STAT_FIELDS)
    def test_no_unscored_stat_moves_the_total(self, stat_name: str) -> None:
        baseline = make_proj()
        perturbed = make_proj(**{stat_name: 100.0})
        assert score_projection(perturbed, PPR) == score_projection(baseline, PPR)


class TestModuleBoundaries:
    def test_scoring_package_does_not_import_sleeper(self) -> None:
        scoring_dir = ROOT / "src" / "fantasy_value" / "scoring"
        for path in scoring_dir.glob("*.py"):
            text = path.read_text(encoding="utf-8")
            assert "sleeper" not in text.lower(), f"{path} references 'sleeper'"
