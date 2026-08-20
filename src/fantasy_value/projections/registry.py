from __future__ import annotations

from fantasy_value.projections.base import ProjectionSource

_SOURCES = ("sleeper", "fantasypros", "manual-csv")


def get_source(name: str, **kwargs: object) -> ProjectionSource:
    """Factory seam: instantiate a ProjectionSource by name. Imports are
    deferred so importing this module doesn't pull in every source."""
    if name == "sleeper":
        from fantasy_value.projections.sleeper import SleeperProjectionSource

        return SleeperProjectionSource(**kwargs)  # type: ignore[arg-type]
    if name == "fantasypros":
        from fantasy_value.projections.fantasypros import FantasyProsProjectionSource

        return FantasyProsProjectionSource()
    if name == "manual-csv":
        from fantasy_value.projections.manual_csv import ManualCsvProjectionSource

        return ManualCsvProjectionSource(**kwargs)  # type: ignore[arg-type]
    raise ValueError(f"unknown projection source {name!r}; expected one of {_SOURCES}")
