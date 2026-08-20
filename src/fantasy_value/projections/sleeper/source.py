from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Callable, Sequence

from fantasy_value.cache import RawCache
from fantasy_value.constants import DATA_RAW, PUBLISH_POSITIONS, REGULAR_SEASON_WEEKS
from fantasy_value.players.models import Player
from fantasy_value.players.store import PlayerStore
from fantasy_value.projections.models import PlayerProjection
from fantasy_value.projections.sleeper.aggregate import aggregate_weeks
from fantasy_value.projections.sleeper.client import SleeperClient
from fantasy_value.projections.sleeper.normalize import normalize_all
from fantasy_value.projections.sleeper.raw_validation import validate_aggregate_size, validate_raw_week


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SleeperProjectionSource:
    """ProjectionSource implementation backed by Sleeper's documented player
    master endpoint and undocumented weekly projections endpoint.

    This is the ONLY place in the codebase permitted to know Sleeper's field
    names, URL shape, or the weekly-aggregation mechanic (Standing Rule #2,
    enforced by tests/test_source_isolation.py).
    """

    def __init__(
        self,
        *,
        client: SleeperClient | None = None,
        weeks: Sequence[int] = REGULAR_SEASON_WEEKS,
        publish_positions: frozenset[str] | None = PUBLISH_POSITIONS,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._client = client or SleeperClient(cache=RawCache(DATA_RAW))
        self._weeks = tuple(weeks)
        self._publish_positions = publish_positions
        self._clock = clock
        self._projection_company: str | None = None
        self._aggregation_label = f"weeks_{min(self._weeks)}_{max(self._weeks)}_summed" if self._weeks else "none"

    @property
    def source_name(self) -> str:
        return "sleeper"

    @property
    def projection_company(self) -> str | None:
        return self._projection_company

    @property
    def aggregation_label(self) -> str:
        return self._aggregation_label

    def fetch_players(self) -> dict[str, Player]:
        payload = self._client.fetch_player_master()
        return PlayerStore.from_master_payload(payload).players

    def _weekly_payloads(self, season: int) -> dict[int, list[dict]]:
        weekly: dict[int, list[dict]] = {}
        for week in self._weeks:
            payload = self._client.fetch_week(season, week)
            validate_raw_week(payload, season=season, week=week)
            weekly[week] = payload
        return weekly

    def fetch_projections(self, season: int) -> list[PlayerProjection]:
        weekly = self._weekly_payloads(season)
        aggregates = aggregate_weeks(weekly)

        validate_aggregate_size(len(aggregates))

        company_counts = Counter(agg.company for agg in aggregates.values() if agg.company)
        self._projection_company = company_counts.most_common(1)[0][0] if company_counts else None

        players = PlayerStore(self.fetch_players())
        timestamp = self._clock()
        projections = normalize_all(
            aggregates, players=players, season=season, source_name=self.source_name, timestamp=timestamp
        )

        if self._publish_positions is not None:
            projections = [
                p for p in projections if set(p.fantasy_positions) & self._publish_positions
            ]

        return projections
