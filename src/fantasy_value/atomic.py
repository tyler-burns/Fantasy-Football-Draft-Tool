from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable


def _reject_constant(name: str) -> float:
    raise ValueError(f"refusing to write non-finite JSON constant: {name}")


def write_json_atomic(
    path: Path,
    payload: Any,
    *,
    indent: int | None = 2,
    sort_keys: bool = False,
) -> None:
    """Write JSON to `path` atomically: serialize to a same-directory temp
    file, fsync, then os.replace(). `path` is never left partially written.

    The temp file is deliberately in the same directory as `path` so that
    os.replace() is a same-volume rename (atomic on both POSIX and Windows).
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(payload, fh, indent=indent, sort_keys=sort_keys, ensure_ascii=False)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def write_validated_json(
    path: Path,
    payload: Any,
    verify: Callable[[Any], None],
    *,
    indent: int | None = 2,
    sort_keys: bool = False,
    backup: bool = True,
) -> None:
    """Serialize `payload` to a temp file, re-read it back from disk, run
    `verify` on the re-parsed object, and only then atomically replace
    `path`. Never touches `path` if `verify` raises or serialization
    produces invalid JSON (e.g. a stray NaN/Infinity).

    If `backup` is set and `path` already exists, it is copied to
    `path.with_suffix(".previous" + path.suffix)` immediately before the
    swap, so a "validation passed but the numbers are wrong" run can still
    be rolled back by hand.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(
                payload,
                fh,
                indent=indent,
                sort_keys=sort_keys,
                ensure_ascii=False,
                allow_nan=False,
            )
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())

        with open(tmp, "r", encoding="utf-8") as fh:
            reparsed = json.load(fh, parse_constant=_reject_constant)
        verify(reparsed)

        if backup and path.exists():
            backup_path = path.with_name(f"{path.stem}.previous{path.suffix}")
            backup_path.write_bytes(path.read_bytes())

        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)
