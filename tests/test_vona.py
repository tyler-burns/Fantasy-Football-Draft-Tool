from datetime import datetime, timezone

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.scoring.presets import PPR, STANDARD
from fantasy_value.valuation.adapter import to_scored_players
from fantasy_value.valuation.board import available_players, build_board
from fantasy_value.valuation.league import DEFAULT_LEAGUE
from fantasy_value.valuation.replacement import compute_replacement_levels
from fantasy_value.valuation.vona import best_available, compute_vona
from tests.valuation_fixtures import make_pool, player, rb_trio

TS = datetime(2026, 8, 20, tzinfo=timezone.utc)


class TestSection171:
    def test_before_draft(self) -> None:
        trio = rb_trio()
        vona = compute_vona(trio)
        assert vona == {"rb1": 25.0, "rb2": 5.0, "rb3": None}

    def test_best_available_is_rb1(self) -> None:
        trio = rb_trio()
        assert best_available(trio)["RB"].player_id == "rb1"

    def test_after_rb1_drafted(self) -> None:
        trio = rb_trio()
        available = available_players(trio, {"rb1"})
        assert best_available(available)["RB"].player_id == "rb2"
        vona = compute_vona(available)
        assert vona == {"rb2": 5.0, "rb3": None}

    def test_rb2_vona_unchanged_across_draft(self) -> None:
        trio = rb_trio()
        before = compute_vona(trio)
        after = compute_vona(available_players(trio, {"rb1"}))
        assert before["rb2"] == after["rb2"] == 5.0


class TestVona:
    def test_positions_are_independent(self) -> None:
        trio = rb_trio()
        wrs = [player(f"wr{i}", "WR", 300.0 - i) for i in range(40)]
        vona_rb_only = compute_vona(trio)
        vona_with_wrs = compute_vona(trio + wrs)
        assert vona_with_wrs["rb1"] == vona_rb_only["rb1"]
        assert vona_with_wrs["rb2"] == vona_rb_only["rb2"]
        assert vona_with_wrs["rb3"] == vona_rb_only["rb3"]

    def test_single_player_at_position_is_none(self) -> None:
        assert compute_vona([player("1", "RB", 100.0)]) == {"1": None}

    def test_empty_pool(self) -> None:
        assert compute_vona([]) == {}

    def test_exact_tie_gives_zero_for_higher_ranked(self) -> None:
        a = player("a", "RB", 100.0)
        b = player("b", "RB", 100.0)
        for pool in ([a, b], [b, a]):
            vona = compute_vona(pool)
            assert vona["a"] == 0.0  # "a" sorts first on the player_id tie-break

    def test_drafting_mid_list_player_changes_only_the_one_above(self) -> None:
        pool = [player(f"rb{i}", "RB", 100.0 - i) for i in range(5)]  # rb0..rb4
        before = compute_vona(pool)
        after = compute_vona(available_players(pool, {"rb2"}))
        assert after["rb1"] != before["rb1"]  # rb1 now compares against rb3
        assert after["rb0"] == before["rb0"]  # unaffected, still compares to rb1
        assert after["rb3"] == before["rb3"]  # unaffected, still compares to rb4

    def test_drafting_every_player_at_a_position_removes_it(self) -> None:
        rbs = [player(f"rb{i}", "RB", 100.0 - i) for i in range(3)]
        wrs = [player(f"wr{i}", "WR", 200.0 - i) for i in range(3)]
        pool = rbs + wrs
        drafted = {p.player_id for p in rbs}
        available = available_players(pool, drafted)
        vona = compute_vona(available)
        assert not any(p.player_id in vona for p in rbs)
        assert compute_vona(wrs) == {k: v for k, v in vona.items() if k.startswith("wr")}

    def test_unknown_drafted_ids_are_ignored(self) -> None:
        trio = rb_trio()
        available = available_players(trio, {"nonexistent"})
        assert len(available) == 3

    def test_available_players_does_not_mutate_input(self) -> None:
        trio = rb_trio()
        before = list(trio)
        available_players(trio, {"rb1"})
        assert trio == before


class TestDraftRecalculation:
    def test_build_board_on_canonical_fixture(self) -> None:
        pool = make_pool(te_curve="steep")
        board = build_board(pool, DEFAULT_LEAGUE)
        assert board.replacement_levels["QB"] == 240.0
        assert board.replacement_levels["RB"] == 110.0
        assert board.replacement_levels["WR"] == 109.0
        assert board.replacement_levels["TE"] == 108.0
        assert len(board.players) == 130
        assert all(pv.par is not None for pv in board.players)

    def test_replacement_and_par_stable_across_top_prefix_draft(self) -> None:
        # Drafting a strict prefix of the best players at a position leaves
        # every survivor's replacement level, PAR, AND VONA byte-identical:
        # VONA only depends on your immediate lower neighbor, and removing
        # higher-ranked players never changes who that is. What changes is
        # simply which players remain and who "best available" now is.
        pool = make_pool(te_curve="steep")
        rb_ids_by_rank = [p.player_id for p in sorted((p for p in pool if p.position == "RB"), key=lambda p: -p.points)]
        top_10_rb = set(rb_ids_by_rank[:10])

        before = build_board(pool, DEFAULT_LEAGUE)
        after = build_board(pool, DEFAULT_LEAGUE, drafted=top_10_rb)

        assert before.replacement_levels == after.replacement_levels

        before_by_id = {pv.player_id: pv for pv in before.players}
        after_by_id = {pv.player_id: pv for pv in after.players}
        surviving_rb_ids = [pid for pid in rb_ids_by_rank if pid not in top_10_rb]
        for pid in surviving_rb_ids:
            assert before_by_id[pid].par == after_by_id[pid].par
            assert before_by_id[pid].vona == after_by_id[pid].vona

        assert not any(pid in after_by_id for pid in top_10_rb)

        new_best_rb_id = rb_ids_by_rank[10]
        assert best_available(available_players(pool, top_10_rb))["RB"].player_id == new_best_rb_id

    def test_contrast_dynamic_baseline_moves_replacement_level(self) -> None:
        pool = make_pool(te_curve="steep")
        rb_ids_by_rank = [p.player_id for p in sorted((p for p in pool if p.position == "RB"), key=lambda p: -p.points)]
        drafted = set(rb_ids_by_rank[:20])
        remaining = available_players(pool, drafted)

        dynamic_levels = compute_replacement_levels(remaining, DEFAULT_LEAGUE)
        stable_levels = build_board(pool, DEFAULT_LEAGUE, drafted=drafted).replacement_levels
        assert dynamic_levels["RB"] != stable_levels["RB"]

    def test_statelessness_repeated_calls_agree(self) -> None:
        pool = make_pool(te_curve="steep")
        drafted = {"rb1", "wr1"}
        first = build_board(pool, DEFAULT_LEAGUE, drafted=drafted)
        second = build_board(pool, DEFAULT_LEAGUE, drafted=drafted)
        assert first == second

    def test_replacement_fn_injection(self) -> None:
        trio = rb_trio()

        def fixed_replacement(pool, league):
            return {"RB": 100.0}

        board = build_board(trio, DEFAULT_LEAGUE, replacement_fn=fixed_replacement)
        by_id = {pv.player_id: pv for pv in board.players}
        assert by_id["rb1"].par == 150.0
        assert by_id["rb2"].par == 125.0


class TestAdapter:
    def _projection(self, **overrides) -> PlayerProjection:
        defaults = dict(
            player_id="1",
            player_name="Josh Allen",
            first_name="Josh",
            last_name="Allen",
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

    def test_points_match_scoring_engine(self) -> None:
        proj = self._projection(pass_yds=4000.0, pass_tds=28.0, pass_int=10.0, rush_yds=500.0, rush_tds=7.0)
        scored = to_scored_players([proj], PPR)
        assert scored[0].points == 344.0

    def test_fb_resolves_to_rb_and_competes_in_rb_pool(self) -> None:
        # position="FB" isn't itself a recognized valuation position; the
        # canonical position becomes "RB" (from fantasy_positions), and
        # eligibility is drawn from fantasy_positions only -- "FB" carries
        # no separate flex-eligibility meaning once resolved.
        fb = self._projection(player_id="2", position="FB", fantasy_positions=("RB",), receptions=50.0, rec_yds=400.0)
        scored = to_scored_players([fb], PPR)
        assert scored[0].position == "RB"
        assert scored[0].eligible_positions == {"RB"}

    def test_multi_position_eligibility_retained(self) -> None:
        proj = self._projection(player_id="3", position="RB", fantasy_positions=("RB", "WR"))
        scored = to_scored_players([proj], PPR)
        assert scored[0].position == "RB"
        assert scored[0].eligible_positions == {"RB", "WR"}

    def test_no_position_raises_with_player_id(self) -> None:
        proj = self._projection(player_id="4", position=None, fantasy_positions=())
        try:
            to_scored_players([proj], PPR)
            assert False, "expected ValueError"
        except ValueError as e:
            assert "4" in str(e)

    def test_different_scoring_config_changes_points_and_replacement(self) -> None:
        proj = self._projection(receptions=100.0, rec_yds=1000.0, position="WR", fantasy_positions=("WR",))
        ppr_points = to_scored_players([proj], PPR)[0].points
        standard_points = to_scored_players([proj], STANDARD)[0].points
        assert ppr_points != standard_points
        assert ppr_points - standard_points == 100.0
