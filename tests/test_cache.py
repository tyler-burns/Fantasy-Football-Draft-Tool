from datetime import datetime, timedelta, timezone
from pathlib import Path

from fantasy_value.cache import RawCache


def _clock_at(when: datetime):
    return lambda: when


def test_store_and_load_round_trip(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    now = datetime(2026, 8, 19, 22, 15, 30, tzinfo=timezone.utc)
    path = cache.store("players_nfl", {"1": {"name": "a"}}, when=now)
    assert path.name == "players_nfl__20260819T221530Z.json"
    assert cache.load(path) == {"1": {"name": "a"}}


def test_store_gzip_round_trip(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    now = datetime(2026, 8, 19, 22, 15, 30, tzinfo=timezone.utc)
    path = cache.store("players_nfl", {"big": "payload"}, when=now, compress=True)
    assert path.name.endswith(".json.gz")
    assert cache.load(path) == {"big": "payload"}


def test_latest_picks_newest_by_filename_timestamp(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    t1 = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 8, 19, 12, 0, 0, tzinfo=timezone.utc)
    cache.store("week1", {"v": 1}, when=t1)
    cache.store("week1", {"v": 2}, when=t2)

    entry = cache.latest("week1", max_age=None)
    assert entry is not None
    assert cache.load(entry.path) == {"v": 2}


def test_latest_respects_max_age(tmp_path: Path) -> None:
    stored_at = datetime(2026, 8, 18, 12, 0, 0, tzinfo=timezone.utc)
    now = datetime(2026, 8, 19, 13, 0, 0, tzinfo=timezone.utc)  # 25 hours later

    cache = RawCache(tmp_path, clock=_clock_at(now))
    cache.store("players_nfl", {"v": 1}, when=stored_at)

    assert cache.latest("players_nfl", max_age=timedelta(days=1)) is None
    assert cache.latest("players_nfl", max_age=timedelta(days=2)) is not None


def test_latest_returns_none_when_absent(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    assert cache.latest("nonexistent", max_age=None) is None


def test_prune_keeps_newest_n(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    base = datetime(2026, 8, 1, tzinfo=timezone.utc)
    for i in range(5):
        cache.store("week1", {"v": i}, when=base + timedelta(days=i))

    removed = cache.prune("week1", keep=2)
    assert len(removed) == 3

    remaining = sorted(tmp_path.glob("week1__*.json"))
    assert len(remaining) == 2
    entry = cache.latest("week1", max_age=None)
    assert entry is not None
    assert cache.load(entry.path) == {"v": 4}


def test_keys_with_underscores_do_not_collide(tmp_path: Path) -> None:
    cache = RawCache(tmp_path)
    now = datetime(2026, 8, 19, tzinfo=timezone.utc)
    cache.store("projections_2026_w01", {"which": "w01"}, when=now)
    cache.store("projections_2026_w1", {"which": "w1"}, when=now)

    e1 = cache.latest("projections_2026_w01", max_age=None)
    e2 = cache.latest("projections_2026_w1", max_age=None)
    assert e1 is not None and e2 is not None
    assert cache.load(e1.path) == {"which": "w01"}
    assert cache.load(e2.path) == {"which": "w1"}
