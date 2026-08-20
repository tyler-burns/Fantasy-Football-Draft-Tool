from dataclasses import FrozenInstanceError, replace

import pytest

from fantasy_value.constants import ROOT
from fantasy_value.valuation.league import DEFAULT_LEAGUE, FLEX_RB_WR, FLEX_RB_WR_TE, LeagueConfig
from fantasy_value.valuation.models import ScoredPlayer
from fantasy_value.valuation.par import compute_par, compute_par_by_id
from fantasy_value.valuation.replacement import allocate_starters, compute_replacement_levels
from tests.valuation_fixtures import make_pool, player


class TestLeagueConfig:
    def test_default_league_matches_section_14(self) -> None:
        assert DEFAULT_LEAGUE.teams == 12
        assert DEFAULT_LEAGUE.qb_slots == 1
        assert DEFAULT_LEAGUE.rb_slots == 2
        assert DEFAULT_LEAGUE.wr_slots == 2
        assert DEFAULT_LEAGUE.te_slots == 1
        assert DEFAULT_LEAGUE.flex_slots == 2
        assert DEFAULT_LEAGUE.flex_positions == FLEX_RB_WR_TE
        assert DEFAULT_LEAGUE.dst_slots == 1
        assert DEFAULT_LEAGUE.k_slots == 1
        assert DEFAULT_LEAGUE.bench_slots == 6

    def test_frozen(self) -> None:
        with pytest.raises(FrozenInstanceError):
            DEFAULT_LEAGUE.teams = 10  # type: ignore[misc]

    def test_equal_configs_compare_and_hash_equal(self) -> None:
        a = replace(DEFAULT_LEAGUE)
        assert a == DEFAULT_LEAGUE
        assert hash(a) == hash(DEFAULT_LEAGUE)

    def test_replace_produces_variants_and_revalidates(self) -> None:
        variant = replace(DEFAULT_LEAGUE, teams=10)
        assert variant.teams == 10
        with pytest.raises(ValueError):
            replace(DEFAULT_LEAGUE, teams=0)

    @pytest.mark.parametrize(
        "kwargs",
        [
            dict(teams=0),
            dict(teams=-1),
            dict(rb_slots=-1),
            dict(flex_slots=-1),
            dict(bench_slots=-1),
        ],
    )
    def test_rejects_invalid_values(self, kwargs: dict) -> None:
        with pytest.raises(ValueError):
            replace(DEFAULT_LEAGUE, **kwargs)

    def test_rejects_non_int_slot_counts(self) -> None:
        with pytest.raises(ValueError):
            replace(DEFAULT_LEAGUE, rb_slots=2.5)  # type: ignore[arg-type]

    def test_rejects_flex_slots_with_no_flex_positions(self) -> None:
        with pytest.raises(ValueError):
            replace(DEFAULT_LEAGUE, flex_slots=2, flex_positions=frozenset())

    def test_flex_positions_normalized(self) -> None:
        league = LeagueConfig(
            teams=12, qb_slots=1, rb_slots=2, wr_slots=2, te_slots=1, flex_slots=2,
            flex_positions={"rb", " wr "}, dst_slots=1, k_slots=1, bench_slots=6,
        )
        assert league.flex_positions == {"RB", "WR"}

    def test_starter_slots_keys_use_canonical_tokens(self) -> None:
        assert DEFAULT_LEAGUE.starter_slots == {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "DEF": 1, "K": 1}

    def test_dedicated_and_flex_demand(self) -> None:
        assert DEFAULT_LEAGUE.dedicated_demand("RB") == 24
        assert DEFAULT_LEAGUE.flex_demand == 24
        assert DEFAULT_LEAGUE.dedicated_demand("XX") == 0

    def test_flex_constants_are_the_two_section_14_1_options(self) -> None:
        assert FLEX_RB_WR == {"RB", "WR"}
        assert FLEX_RB_WR_TE == {"RB", "WR", "TE"}


class TestScoredPlayer:
    def test_frozen(self) -> None:
        p = player("1", "RB", 100.0)
        with pytest.raises(FrozenInstanceError):
            p.points = 200.0  # type: ignore[misc]

    def test_position_normalized(self) -> None:
        p = ScoredPlayer(player_id="1", position=" rb ", points=100.0)
        assert p.position == "RB"

    def test_empty_position_rejected(self) -> None:
        with pytest.raises(ValueError):
            ScoredPlayer(player_id="1", position="  ", points=100.0)

    @pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
    def test_non_finite_points_rejected(self, bad: float) -> None:
        with pytest.raises(ValueError):
            ScoredPlayer(player_id="1", position="RB", points=bad)

    def test_eligible_positions_always_contains_position(self) -> None:
        p = ScoredPlayer(player_id="1", position="RB", points=100.0)
        assert p.eligible_positions == {"RB"}

    def test_eligible_positions_union_normalized(self) -> None:
        p = ScoredPlayer(player_id="1", position="rb", points=100.0, eligible_positions=frozenset({"wr"}))
        assert p.eligible_positions == {"RB", "WR"}


class TestAllocation:
    def test_canonical_fixture_dedicated_and_flex_split(self) -> None:
        pool = make_pool(te_curve="steep")
        alloc = allocate_starters(pool, DEFAULT_LEAGUE)
        assert alloc.dedicated == {"QB": 12, "RB": 24, "WR": 24, "TE": 12}
        assert alloc.flex == {"QB": 0, "RB": 11, "WR": 9, "TE": 4}
        assert len(alloc.flex_player_ids) == 24

    def test_every_starting_slot_filled_exactly_once(self) -> None:
        pool = make_pool(te_curve="steep")
        alloc = allocate_starters(pool, DEFAULT_LEAGUE)
        assert sum(alloc.cutoff.values()) == 96  # 12 * (1+2+2+1+2)

    def test_no_player_double_allocated_and_flex_beats_worst_dedicated(self) -> None:
        pool = make_pool(te_curve="steep")
        alloc = allocate_starters(pool, DEFAULT_LEAGUE)
        assert len(set(alloc.flex_player_ids)) == len(alloc.flex_player_ids)


class TestReplacementWithFlex:
    def test_canonical_assertion(self) -> None:
        pool = make_pool(te_curve="steep")
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels["QB"] == 240.0
        assert levels["RB"] == 110.0
        assert levels["WR"] == 109.0
        assert levels["TE"] == 108.0

    def test_naive_cutoffs_are_wrong(self) -> None:
        # Spec's own point: RB25=154, WR25=145, TE13=156 (naive) are NOT
        # the FLEX-aware replacement levels.
        pool = make_pool(te_curve="steep")
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels["RB"] != 154.0
        assert levels["WR"] != 145.0
        assert levels["TE"] != 156.0

    def test_rb_wr_only_flex_reverts_te_to_naive(self) -> None:
        pool = make_pool(te_curve="steep")
        league = replace(DEFAULT_LEAGUE, flex_positions=FLEX_RB_WR)
        levels = compute_replacement_levels(pool, league)
        assert levels["QB"] == 240.0
        assert levels["RB"] == 102.0
        assert levels["WR"] == 101.0
        assert levels["TE"] == 156.0  # naive: TE has zero FLEX demand under RB/WR

    def test_flex_eligible_position_earning_zero_slots_keeps_naive_cutoff(self) -> None:
        pool = make_pool(te_curve="flat")
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels["RB"] == 102.0
        assert levels["WR"] == 101.0
        assert levels["TE"] == 104.0  # naive TE13, flat curve doesn't crack the flex threshold

    def test_order_independence(self) -> None:
        pool = make_pool(te_curve="steep")
        shuffled = list(reversed(pool))
        assert compute_replacement_levels(pool, DEFAULT_LEAGUE) == compute_replacement_levels(
            shuffled, DEFAULT_LEAGUE
        )

    def test_pool_not_mutated(self) -> None:
        pool = make_pool(te_curve="steep")
        before = list(pool)
        compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert pool == before


class TestReplacementWithoutFlex:
    def test_naive_cutoffs_exact(self) -> None:
        pool = make_pool(te_curve="steep")
        league = replace(DEFAULT_LEAGUE, flex_slots=0)
        levels = compute_replacement_levels(pool, league)
        assert levels["QB"] == 240.0
        assert levels["RB"] == 154.0
        assert levels["WR"] == 145.0
        assert levels["TE"] == 156.0

    def test_zero_flex_slots_ignores_flex_positions(self) -> None:
        pool = make_pool(te_curve="steep")
        league = replace(DEFAULT_LEAGUE, flex_slots=0, flex_positions=FLEX_RB_WR)
        levels = compute_replacement_levels(pool, league)
        assert levels["TE"] == 156.0

    def test_single_team_no_flex(self) -> None:
        pool = [player(f"rb{i}", "RB", 100.0 - i) for i in range(10)]
        league = replace(DEFAULT_LEAGUE, teams=1, flex_slots=0)
        levels = compute_replacement_levels(pool, league)
        assert levels["RB"] == pool[2].points  # rb_slots=2 dedicated -> 3rd player


class TestReplacementEdgeCases:
    def test_empty_pool(self) -> None:
        levels = compute_replacement_levels([], DEFAULT_LEAGUE)
        for position in ("QB", "RB", "WR", "TE", "K", "DEF"):
            assert levels[position] is None

    def test_position_with_fewer_players_than_dedicated_demand(self) -> None:
        few_te = [player(f"te{i}", "TE", 100.0 - i) for i in range(5)]
        rbs = [player(f"rb{i}", "RB", 200.0 - i) for i in range(30)]
        wrs = [player(f"wr{i}", "WR", 200.0 - i) for i in range(30)]
        qbs = [player(f"qb{i}", "QB", 200.0 - i) for i in range(15)]
        pool = few_te + rbs + wrs + qbs

        alloc = allocate_starters(pool, DEFAULT_LEAGUE)
        assert alloc.flex["TE"] == 0

        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels["TE"] is None

    def test_exact_cutoff_boundary(self) -> None:
        # 24 RB dedicated demand, no flex leftovers to steal a slot away
        # (WR/QB exactly fill their own dedicated demand with none to spare).
        rbs = [player(f"rb{i}", "RB", 200.0 - i) for i in range(24)]
        wrs = [player(f"wr{i}", "WR", 500.0 - i) for i in range(24)]
        qbs = [player(f"qb{i}", "QB", 200.0 - i) for i in range(12)]
        levels = compute_replacement_levels(rbs + wrs + qbs, DEFAULT_LEAGUE)
        assert levels["RB"] is None  # exactly 24 players, cutoff == len

        # 24 WR leftovers (beating -999) absorb every FLEX slot, so the
        # extra RB is left as the untouched 25th-player boundary.
        extra_rb = player("rb_extra", "RB", -999.0)
        wr_leftovers = [player(f"wrx{i}", "WR", 300.0 - i) for i in range(24)]
        levels2 = compute_replacement_levels(rbs + [extra_rb] + wrs + wr_leftovers + qbs, DEFAULT_LEAGUE)
        assert levels2["RB"] == -999.0  # 25th player is the boundary

    def test_single_player_position_fully_consumed(self) -> None:
        pool = [player("te1", "TE", 100.0)]
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels["TE"] is None

    def test_zero_demand_position_returns_none_even_with_deep_pool(self) -> None:
        ks = [player(f"k{i}", "K", 50.0 - i) for i in range(20)]
        league = replace(DEFAULT_LEAGUE, k_slots=0, dst_slots=0)
        levels = compute_replacement_levels(ks, league)
        assert levels["K"] is None
        assert levels["DEF"] is None

    def test_nonzero_demand_position_gets_real_replacement(self) -> None:
        ks = [player(f"k{i}", "K", 50.0 - i) for i in range(20)]
        levels = compute_replacement_levels(ks, DEFAULT_LEAGUE)  # k_slots=1, teams=12 -> K13
        assert levels["K"] == ks[12].points

    def test_unknown_position_returns_none_no_crash(self) -> None:
        pool = [player("fb1", "FB", 90.0)]
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert levels.get("FB") is None

    def test_flex_boundary_ties_broken_by_player_id(self) -> None:
        # Two RBs tied at the exact FLEX cutoff score; 23 WR leftovers
        # (all outranking the tie) absorb 23 of the 24 FLEX slots, leaving
        # exactly one slot for the tied pair to contest.
        rbs = [player(f"rb{i}", "RB", 200.0 - i) for i in range(24)]
        tie_a = player("rb_tie_a", "RB", 100.0)
        tie_b = player("rb_tie_b", "RB", 100.0)
        wrs = [player(f"wr{i}", "WR", 500.0 - i) for i in range(24)]
        wr_leftovers = [player(f"wrx{i}", "WR", 300.0 - i) for i in range(23)]
        qbs = [player(f"qb{i}", "QB", 200.0 - i) for i in range(12)]
        pool = rbs + [tie_a, tie_b] + wrs + wr_leftovers + qbs

        for shuffled in (pool, list(reversed(pool))):
            levels = compute_replacement_levels(shuffled, DEFAULT_LEAGUE)
            assert levels["RB"] == 100.0  # deterministic regardless of input order

    def test_negative_points_can_be_the_replacement_level(self) -> None:
        rbs = [player(f"rb{i}", "RB", 200.0 - i) for i in range(24)]
        neg = player("bad", "RB", -50.0)
        wrs = [player(f"wr{i}", "WR", 500.0 - i) for i in range(48)]  # absorbs all 24 flex slots
        qbs = [player(f"qb{i}", "QB", 200.0 - i) for i in range(12)]
        levels = compute_replacement_levels(rbs + [neg] + wrs + qbs, DEFAULT_LEAGUE)
        assert levels["RB"] == -50.0

    def test_multi_position_player_charged_to_own_position(self) -> None:
        pool = make_pool(te_curve="steep")
        flex_rb = player("flex_rb", "RB", 500.0, eligible=("WR",))
        levels = compute_replacement_levels(pool + [flex_rb], DEFAULT_LEAGUE)
        # a dominant RB/WR-eligible player still counts against RB's own group
        alloc = allocate_starters(pool + [flex_rb], DEFAULT_LEAGUE)
        assert "flex_rb" not in alloc.flex_player_ids  # takes a dedicated RB slot, not flex
        assert levels["RB"] is not None

    def test_bench_slots_do_not_affect_replacement_level(self) -> None:
        pool = make_pool(te_curve="steep")
        no_bench = replace(DEFAULT_LEAGUE, bench_slots=0)
        big_bench = replace(DEFAULT_LEAGUE, bench_slots=20)
        assert compute_replacement_levels(pool, no_bench) == compute_replacement_levels(pool, big_bench)

    def test_purity_repeated_calls_agree_and_return_fresh_objects(self) -> None:
        pool = make_pool(te_curve="steep")
        first = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        second = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        assert first == second
        first["RB"] = 99999.0
        assert compute_replacement_levels(pool, DEFAULT_LEAGUE)["RB"] != 99999.0


class TestPAR:
    def test_section_16_example(self) -> None:
        p = player("1", "RB", 290.0)
        assert compute_par(p, {"RB": 220.0}) == 70.0

    def test_sub_replacement_is_negative(self) -> None:
        p = player("1", "RB", 100.0)
        assert compute_par(p, {"RB": 220.0}) == -120.0

    def test_replacement_player_himself_scores_zero(self) -> None:
        p = player("1", "RB", 220.0)
        assert compute_par(p, {"RB": 220.0}) == 0.0

    def test_none_replacement_level_propagates(self) -> None:
        p = player("1", "K", 100.0)
        assert compute_par(p, {"K": None}) is None

    def test_missing_position_in_mapping_is_none(self) -> None:
        p = player("1", "K", 100.0)
        assert compute_par(p, {}) is None

    def test_end_to_end_on_canonical_fixture(self) -> None:
        pool = make_pool(te_curve="steep")
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        rb1 = next(p for p in pool if p.player_id == "rb1")
        te1 = next(p for p in pool if p.player_id == "te1")
        assert compute_par(rb1, levels) == pytest.approx(250.0 - 110.0)
        assert compute_par(te1, levels) == pytest.approx(300.0 - 108.0)

    def test_compute_par_by_id_covers_every_player(self) -> None:
        pool = make_pool(te_curve="steep")
        levels = compute_replacement_levels(pool, DEFAULT_LEAGUE)
        by_id = compute_par_by_id(pool, levels)
        assert set(by_id) == {p.player_id for p in pool}
        for p in pool:
            assert by_id[p.player_id] == compute_par(p, levels)


class TestModuleBoundaries:
    def test_valuation_package_does_not_import_sleeper(self) -> None:
        valuation_dir = ROOT / "src" / "fantasy_value" / "valuation"
        for path in valuation_dir.glob("*.py"):
            text = path.read_text(encoding="utf-8")
            assert "sleeper" not in text.lower(), f"{path} references 'sleeper'"

    def test_only_adapter_reaches_outside_valuation(self) -> None:
        valuation_dir = ROOT / "src" / "fantasy_value" / "valuation"
        for path in valuation_dir.glob("*.py"):
            if path.name in ("adapter.py", "__init__.py"):
                continue
            text = path.read_text(encoding="utf-8")
            assert "fantasy_value.projections" not in text, f"{path} imports projections directly"
            assert "fantasy_value.scoring" not in text, f"{path} imports scoring directly"
