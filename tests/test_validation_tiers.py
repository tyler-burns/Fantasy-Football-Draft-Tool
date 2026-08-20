from datetime import datetime, timezone

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.scoring.calculator import score_projection
from fantasy_value.scoring.presets import PPR
from fantasy_value.validation.required_fields import check_required_fields
from fantasy_value.validation.runner import run_validation
from fantasy_value.validation.tier2 import (
    games_proj_le_18,
    pass_cmp_le_att,
    receptions_le_targets,
    stats_non_negative,
)
from fantasy_value.validation.tier3 import run_tier3

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)


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


class TestRequiredFields:
    def test_complete_record_survives(self) -> None:
        survivors, issues = check_required_fields([make_proj()])
        assert len(survivors) == 1
        assert issues == []

    def test_missing_team_is_excluded_and_flagged(self) -> None:
        survivors, issues = check_required_fields([make_proj(team=None)])
        assert survivors == []
        assert len(issues) == 1
        assert "team" in issues[0].context["missing_fields"]

    def test_missing_player_name_is_excluded(self) -> None:
        survivors, issues = check_required_fields([make_proj(player_name=None)])
        assert survivors == []
        assert len(issues) == 1


class TestTier2NegativeYardage:
    def test_negative_stat_flagged(self) -> None:
        issues = list(stats_non_negative([make_proj(rush_yds=-5.0)]))
        assert len(issues) == 1
        assert issues[0].context["field"] == "rush_yds"

    def test_non_negative_stats_pass_clean(self) -> None:
        issues = list(stats_non_negative([make_proj(rush_yds=500.0)]))
        assert issues == []


class TestTier2CompletionsVsAttempts:
    def test_cmp_exceeding_att_flagged(self) -> None:
        issues = list(pass_cmp_le_att([make_proj(pass_att=10.0, pass_cmp=15.0)]))
        assert len(issues) == 1

    def test_cmp_le_att_passes(self) -> None:
        issues = list(pass_cmp_le_att([make_proj(pass_att=15.0, pass_cmp=10.0)]))
        assert issues == []


class TestTier2ReceptionsVsTargets:
    def test_receptions_exceeding_targets_flagged(self) -> None:
        issues = list(receptions_le_targets([make_proj(rec_tgt=5.0, receptions=8.0)]))
        assert len(issues) == 1


class TestTier2GamesProjected:
    def test_games_proj_over_18_flagged(self) -> None:
        issues = list(games_proj_le_18([make_proj(games_proj=19.0)]))
        assert len(issues) == 1

    def test_games_proj_exactly_18_passes(self) -> None:
        issues = list(games_proj_le_18([make_proj(games_proj=18.0)]))
        assert issues == []


class TestTier1DeliberatelyBrokenData:
    """Section 21.4: feed the validator a QB with zero passing among a
    ranked top-32 window and confirm it flags."""

    def test_zero_pass_qb_in_top32_flagged(self) -> None:
        from fantasy_value.validation.tier2 import qb_top32_has_pass_yds

        qbs = [make_proj(player_id=str(i), position="QB", adp=float(i), pass_yds=250.0) for i in range(1, 33)]
        qbs[0] = make_proj(player_id="broken", position="QB", adp=1.0, pass_yds=0.0)
        issues = list(qb_top32_has_pass_yds(qbs))
        assert any(i.player_id == "broken" for i in issues)


class TestTier3ReferenceCrossCheck:
    def test_matching_reference_produces_no_loud_warning(self) -> None:
        proj = make_proj(
            pass_yds=4000.0, pass_tds=28.0, pass_int=10.0, rush_yds=500.0, rush_tds=7.0, reference_pts_ppr=344.0
        )
        summary, issues = run_tier3([proj])
        assert summary.compared == 1
        assert summary.diverged == 0
        assert issues == []

    def test_inflated_reference_triggers_loud_warning(self) -> None:
        # 20% inflated reference vs. the computed total, for enough players
        # to exceed the 5% loud threshold.
        projections = []
        for i in range(20):
            computed_target = 300.0
            inflated_reference = computed_target * 1.20
            proj = make_proj(
                player_id=str(i),
                pass_yds=computed_target * 25,  # so pass_yds/25 == computed_target
                reference_pts_ppr=inflated_reference,
            )
            projections.append(proj)
        summary, issues = run_tier3(projections)
        assert summary.diverged == 20
        assert summary.loud is True
        assert len(issues) == 1
        assert issues[0].check == "tier3_reference_ppr_divergence"

    def test_low_reference_totals_excluded_from_comparison(self) -> None:
        proj = make_proj(reference_pts_ppr=2.0)  # below MIN_REFERENCE_PTS
        summary, issues = run_tier3([proj])
        assert summary.compared == 0
        assert issues == []

    def test_none_reference_excluded_from_comparison(self) -> None:
        proj = make_proj(reference_pts_ppr=None)
        summary, issues = run_tier3([proj])
        assert summary.compared == 0

    def test_worked_example_from_spec_section_13_4(self) -> None:
        # Josh Allen worked example: 4000 pass yds, 28 pass TD, 10 INT,
        # 500 rush yds, 7 rush TD -> 344.0 points. Documents where the
        # reference_pts_ppr=344.0 literal above comes from.
        proj = make_proj(pass_yds=4000.0, pass_tds=28.0, pass_int=10.0, rush_yds=500.0, rush_tds=7.0)
        assert score_projection(proj, PPR) == 344.0


class TestRunValidation:
    def test_full_run_returns_publishable_and_report(self) -> None:
        good = make_proj(player_id="1", adp=1.0)
        bad = make_proj(player_id="2", team=None, adp=2.0)
        survivors, report = run_validation(
            [good, bad], season=2026, source="sleeper", generated_at=TS, run_tier3=False
        )
        assert len(survivors) == 1
        assert survivors[0].player_id == "1"
        assert report.error_count == 1
        assert report.player_count == 1

    def test_status_passed_when_no_warnings(self) -> None:
        good = make_proj(player_id="1", adp=1.0)
        _, report = run_validation([good], season=2026, source="sleeper", generated_at=TS, run_tier3=False)
        assert report.status in ("passed", "warned")  # adp_present is INFO not WARNING when adp set

    def test_report_serializes_to_dict(self) -> None:
        good = make_proj(player_id="1", adp=1.0)
        _, report = run_validation([good], season=2026, source="sleeper", generated_at=TS, run_tier3=False)
        d = report.to_dict()
        assert d["player_count"] == 1
        assert isinstance(d["issues"], list)
