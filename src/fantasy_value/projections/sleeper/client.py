from __future__ import annotations

import time
import urllib.parse
from datetime import timedelta
from typing import Any

from fantasy_value.cache import RawCache
from fantasy_value.errors import FetchError
from fantasy_value.net import get_json
from fantasy_value.projections.sleeper.keys import (
    BASE_URL,
    FETCH_POSITIONS,
    PLAYER_MASTER_PATH,
    PROJECTIONS_PATH_TEMPLATE,
    SEASON_TYPE,
)

PLAYER_MASTER_CACHE_KEY = "players_nfl"
DEFAULT_PLAYER_CACHE_MAX_AGE = timedelta(days=1)
DEFAULT_COURTESY_DELAY_SECONDS = 0.25


def _week_cache_key(season: int, week: int) -> str:
    return f"projections_{season}_w{week:02d}"


class SleeperClient:
    """Thin, cache-aware wrapper around Sleeper's two endpoints. Reproduces
    Phase 0's URL construction exactly. Every fetch is cached to `data/raw/`
    via the injected RawCache.
    """

    def __init__(
        self,
        *,
        cache: RawCache,
        offline: bool = False,
        player_cache_max_age: timedelta = DEFAULT_PLAYER_CACHE_MAX_AGE,
        week_cache_max_age: timedelta | None = None,
        courtesy_delay: float = DEFAULT_COURTESY_DELAY_SECONDS,
    ) -> None:
        self.cache = cache
        self.offline = offline
        self.player_cache_max_age = player_cache_max_age
        self.week_cache_max_age = week_cache_max_age
        self.courtesy_delay = courtesy_delay

    def _player_master_url(self) -> str:
        return f"{BASE_URL}{PLAYER_MASTER_PATH}"

    def _week_url(self, season: int, week: int) -> str:
        path = PROJECTIONS_PATH_TEMPLATE.format(season=season, week=week)
        params = [("season_type", SEASON_TYPE)] + [("position[]", p) for p in FETCH_POSITIONS]
        query = urllib.parse.urlencode(params, doseq=True)
        return f"{BASE_URL}{path}?{query}"

    def fetch_player_master(self) -> dict[str, Any]:
        max_age = None if self.offline else self.player_cache_max_age
        cached = self.cache.latest(PLAYER_MASTER_CACHE_KEY, max_age=max_age)
        if cached is not None:
            return self.cache.load(cached.path)

        if self.offline:
            raise FetchError(f"offline mode: no cached entry for {PLAYER_MASTER_CACHE_KEY!r}")

        payload = get_json(self._player_master_url())
        self.cache.store(PLAYER_MASTER_CACHE_KEY, payload, compress=True)
        self.cache.prune(PLAYER_MASTER_CACHE_KEY, keep=3)
        return payload

    def fetch_week(self, season: int, week: int) -> list[dict[str, Any]]:
        key = _week_cache_key(season, week)
        max_age = None if self.offline else self.week_cache_max_age
        cached = self.cache.latest(key, max_age=max_age)
        if cached is not None:
            return self.cache.load(cached.path)

        if self.offline:
            raise FetchError(f"offline mode: no cached entry for {key!r}")

        payload = get_json(self._week_url(season, week))
        self.cache.store(key, payload)
        if self.courtesy_delay:
            time.sleep(self.courtesy_delay)
        return payload
