import copy
import json
from pathlib import Path

import pytest

from fantasy_value.constants import DATA_SAMPLE


def _load_sample(name: str):
    with open(DATA_SAMPLE / name, encoding="utf-8") as fh:
        return json.load(fh)


@pytest.fixture
def week1_sample() -> list[dict]:
    return copy.deepcopy(_load_sample("projections_week1_raw.json"))


@pytest.fixture
def week2_sample() -> list[dict]:
    return copy.deepcopy(_load_sample("projections_week2_raw.json"))


@pytest.fixture
def week0_sample() -> list[dict]:
    return copy.deepcopy(_load_sample("projections_week0_raw.json"))


@pytest.fixture
def players_sample() -> dict:
    return copy.deepcopy(_load_sample("players_sample.json"))
