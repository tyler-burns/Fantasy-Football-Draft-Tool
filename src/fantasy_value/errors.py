from __future__ import annotations

from typing import Any, Mapping


class FantasyValueError(Exception):
    """Base class for all project-specific errors."""


class FetchError(FantasyValueError):
    """Raised for non-200 responses, timeouts, or invalid JSON from an HTTP fetch."""


class Tier1ValidationError(FantasyValueError):
    """Hard-failure validation error. Names the specific check that failed."""

    def __init__(self, check: str, message: str, context: Mapping[str, Any] | None = None) -> None:
        super().__init__(f"[{check}] {message}")
        self.check = check
        self.context: dict[str, Any] = dict(context or {})


class SchemaDriftError(Tier1ValidationError):
    """A specific Tier1ValidationError: an expected stat key vanished from the whole payload."""


class RequiredFieldError(FantasyValueError):
    """Raised when a published record is missing a required identity field."""


class ManualCsvError(FantasyValueError):
    """Raised for malformed manual-override CSV input."""
