from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Mapping


class Severity(StrEnum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    check: str
    severity: Severity
    message: str
    player_id: str | None = None
    player_name: str | None = None
    context: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "check": self.check,
            "severity": self.severity.value,
            "message": self.message,
            "player_id": self.player_id,
            "player_name": self.player_name,
            "context": dict(self.context),
        }


@dataclass(slots=True)
class Tier3Summary:
    compared: int
    diverged: int
    diverged_pct: float
    threshold_pct: float
    worst: list[dict[str, Any]]
    loud: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "compared": self.compared,
            "diverged": self.diverged,
            "diverged_pct": self.diverged_pct,
            "threshold_pct": self.threshold_pct,
            "worst": self.worst,
            "loud": self.loud,
        }


@dataclass(slots=True)
class ValidationReport:
    season: int
    source: str
    generated_at: datetime
    status: str  # "passed" | "warned" | "failed"
    player_count: int
    checks_run: list[str]
    issues: list[ValidationIssue] = field(default_factory=list)
    tier3: Tier3Summary | None = None

    @property
    def warning_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == Severity.WARNING)

    @property
    def error_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == Severity.ERROR)

    def to_dict(self) -> dict[str, Any]:
        return {
            "season": self.season,
            "source": self.source,
            "generated_at": self.generated_at.isoformat(),
            "status": self.status,
            "player_count": self.player_count,
            "checks_run": self.checks_run,
            "warning_count": self.warning_count,
            "error_count": self.error_count,
            "issues": [issue.to_dict() for issue in self.issues],
            "tier3": self.tier3.to_dict() if self.tier3 else None,
        }
