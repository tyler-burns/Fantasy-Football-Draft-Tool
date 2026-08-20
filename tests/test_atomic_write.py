import json
from pathlib import Path

import pytest

from fantasy_value.atomic import write_json_atomic, write_validated_json


def test_write_json_atomic_creates_file(tmp_path: Path) -> None:
    path = tmp_path / "out.json"
    write_json_atomic(path, {"a": 1})
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1}


def test_write_json_atomic_leaves_no_temp_files(tmp_path: Path) -> None:
    path = tmp_path / "out.json"
    write_json_atomic(path, {"a": 1})
    leftovers = list(tmp_path.glob(".*.tmp-*"))
    assert leftovers == []


def test_write_validated_json_good_data_replaces_file(tmp_path: Path) -> None:
    path = tmp_path / "out.json"

    def verify(obj: object) -> None:
        assert obj == {"a": 1}

    write_validated_json(path, {"a": 1}, verify)
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1}


def test_write_validated_json_raising_verify_leaves_original_untouched(tmp_path: Path) -> None:
    path = tmp_path / "out.json"
    write_json_atomic(path, {"good": True})

    def verify(obj: object) -> None:
        raise ValueError("simulated validation failure")

    with pytest.raises(ValueError):
        write_validated_json(path, {"bad": True}, verify)

    assert json.loads(path.read_text(encoding="utf-8")) == {"good": True}


def test_write_validated_json_leaves_no_temp_files_on_failure(tmp_path: Path) -> None:
    path = tmp_path / "out.json"

    def verify(obj: object) -> None:
        raise ValueError("boom")

    with pytest.raises(ValueError):
        write_validated_json(path, {"a": 1}, verify)

    leftovers = list(tmp_path.glob(".*.tmp-*"))
    assert leftovers == []
    assert not path.exists()


def test_write_validated_json_rejects_nan(tmp_path: Path) -> None:
    path = tmp_path / "out.json"

    def verify(obj: object) -> None:
        pass

    with pytest.raises(ValueError):
        write_validated_json(path, {"a": float("nan")}, verify)
    assert not path.exists()


def test_write_validated_json_writes_backup(tmp_path: Path) -> None:
    path = tmp_path / "out.json"
    write_json_atomic(path, {"version": 1})

    def verify(obj: object) -> None:
        pass

    write_validated_json(path, {"version": 2}, verify, backup=True)

    backup_path = tmp_path / "out.previous.json"
    assert json.loads(backup_path.read_text(encoding="utf-8")) == {"version": 1}
    assert json.loads(path.read_text(encoding="utf-8")) == {"version": 2}
