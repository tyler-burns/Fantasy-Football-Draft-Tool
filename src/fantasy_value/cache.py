from __future__ import annotations

import gzip
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from fantasy_value.constants import DATA_RAW

# Colon-free, UTC, sortable-as-string timestamp — Windows forbids ':' in
# filenames, so raw ISO-8601 ("2026-08-19T22:15:30+00:00") is not usable here.
_TIMESTAMP_FORMAT = "%Y%m%dT%H%M%SZ"
_FILENAME_RE = re.compile(r"^(?P<key>.+)__(?P<timestamp>\d{8}T\d{6}Z)\.json(?P<gz>\.gz)?$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_timestamp(when: datetime) -> str:
    return when.astimezone(timezone.utc).strftime(_TIMESTAMP_FORMAT)


def _parse_timestamp(text: str) -> datetime:
    return datetime.strptime(text, _TIMESTAMP_FORMAT).replace(tzinfo=timezone.utc)


@dataclass(frozen=True, slots=True)
class CachedEntry:
    path: Path
    key: str
    fetched_at: datetime

    @property
    def age(self) -> timedelta:
        return _utcnow() - self.fetched_at


class RawCache:
    """Timestamped JSON cache under `data/raw/`.

    Filenames: `{key}__{UTC timestamp}.json[.gz]`. The double underscore lets
    `key` itself contain single underscores. The fetch timestamp is parsed
    from the filename (not filesystem mtime, which doesn't survive copies)
    to decide cache hits.
    """

    def __init__(self, root: Path = DATA_RAW, *, clock: Callable[[], datetime] = _utcnow) -> None:
        self.root = root
        self._clock = clock

    def store(self, key: str, payload: Any, *, when: datetime | None = None, compress: bool = False) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        when = when or self._clock()
        suffix = ".json.gz" if compress else ".json"
        path = self.root / f"{key}__{_format_timestamp(when)}{suffix}"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if compress:
            path.write_bytes(gzip.compress(data))
        else:
            path.write_bytes(data)
        return path

    def _entries(self, key: str) -> list[CachedEntry]:
        entries: list[CachedEntry] = []
        if not self.root.exists():
            return entries
        for candidate in self.root.glob(f"{key}__*.json*"):
            match = _FILENAME_RE.match(candidate.name)
            if not match or match.group("key") != key:
                continue
            entries.append(
                CachedEntry(path=candidate, key=key, fetched_at=_parse_timestamp(match.group("timestamp")))
            )
        return entries

    def latest(self, key: str, *, max_age: timedelta | None) -> CachedEntry | None:
        entries = self._entries(key)
        if not entries:
            return None
        newest = max(entries, key=lambda e: e.fetched_at)
        if max_age is not None and newest.age > max_age:
            return None
        return newest

    def load(self, path: Path) -> Any:
        if path.suffix == ".gz":
            with gzip.open(path, "rt", encoding="utf-8") as fh:
                return json.load(fh)
        return json.loads(path.read_text(encoding="utf-8"))

    def prune(self, key: str, *, keep: int = 3) -> list[Path]:
        entries = sorted(self._entries(key), key=lambda e: e.fetched_at, reverse=True)
        removed: list[Path] = []
        for entry in entries[keep:]:
            entry.path.unlink(missing_ok=True)
            removed.append(entry.path)
        return removed
