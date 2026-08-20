import copy

import pytest

from fantasy_value.errors import SchemaDriftError, Tier1ValidationError
from fantasy_value.projections.sleeper.raw_validation import validate_aggregate_size, validate_raw_week


class TestTier1RawValidation:
    def test_real_week1_fixture_passes(self, week1_sample: list[dict]) -> None:
        validate_raw_week(week1_sample, season=2026, week=1)  # no raise

    def test_real_week2_fixture_passes(self, week2_sample: list[dict]) -> None:
        validate_raw_week(week2_sample, season=2026, week=2)  # no raise

    def test_non_array_payload_fails(self) -> None:
        with pytest.raises(Tier1ValidationError) as exc_info:
            validate_raw_week({"not": "an array"}, season=2026, week=1)
        assert exc_info.value.check == "payload_is_array"

    def test_empty_array_fails(self) -> None:
        with pytest.raises(Tier1ValidationError) as exc_info:
            validate_raw_week([], season=2026, week=1)
        assert exc_info.value.check == "payload_non_empty"

    def test_missing_top_level_key_fails(self, week1_sample: list[dict]) -> None:
        mutated = copy.deepcopy(week1_sample)
        for record in mutated:
            record.pop("player_id", None)
        with pytest.raises(Tier1ValidationError) as exc_info:
            validate_raw_week(mutated, season=2026, week=1)
        assert exc_info.value.check == "top_level_keys_present"

    def test_renamed_stat_key_triggers_schema_drift(self, week1_sample: list[dict]) -> None:
        mutated = copy.deepcopy(week1_sample)
        for record in mutated:
            stats = record.get("stats") or {}
            if "rec_yd" in stats:
                stats["receiving_yards"] = stats.pop("rec_yd")
        with pytest.raises(SchemaDriftError) as exc_info:
            validate_raw_week(mutated, season=2026, week=1)
        assert exc_info.value.check == "stat_key_canary"

    def test_all_player_ids_stripped_still_fails_on_key_presence(self, week1_sample: list[dict]) -> None:
        mutated = copy.deepcopy(week1_sample)
        for record in mutated:
            record["player_id"] = None
        # player_id key is still present (just null) -- this should NOT raise
        # on top_level_keys_present, since the spec check is key-presence,
        # not non-null-ness. Null player_ids are caught later by the
        # canonical-space required-fields check.
        validate_raw_week(mutated, season=2026, week=1)

    def test_week0_placeholder_only_fixture_fails_canary(self, week0_sample: list[dict]) -> None:
        # week=0 has no gp/stat keys at all per Phase 0 findings -- this is
        # exactly the schema-drift canary doing its job.
        with pytest.raises(SchemaDriftError):
            validate_raw_week(week0_sample, season=2026, week=0)


class TestAggregateSizeCheck:
    def test_passes_at_minimum(self) -> None:
        validate_aggregate_size(300, minimum=300)  # no raise

    def test_fails_below_minimum(self) -> None:
        with pytest.raises(Tier1ValidationError) as exc_info:
            validate_aggregate_size(299, minimum=300)
        assert exc_info.value.check == "player_count_minimum"
