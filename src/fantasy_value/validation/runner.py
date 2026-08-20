from __future__ import annotations

from datetime import datetime
from typing import Sequence

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.validation.models import Severity, ValidationIssue, ValidationReport
from fantasy_value.validation.required_fields import check_required_fields
from fantasy_value.validation.tier2 import TIER2_CHECKS
from fantasy_value.validation.tier3 import run_tier3 as _run_tier3_check


def run_validation(
    projections: Sequence[PlayerProjection],
    *,
    season: int,
    source: str,
    generated_at: datetime,
    run_tier3: bool = True,
) -> tuple[list[PlayerProjection], ValidationReport]:
    """Runs required-fields, Tier 2, and (optionally) Tier 3 checks in
    canonical-space. Returns (publishable_projections, report).

    Required-fields failures remove a record from the publishable set.
    Tier 2/3 findings never remove a record -- they're warnings/info only.
    """
    checks_run: list[str] = ["required_fields"]
    issues: list[ValidationIssue] = []

    survivors, required_issues = check_required_fields(projections)
    issues.extend(required_issues)

    for name, check in TIER2_CHECKS:
        checks_run.append(name)
        issues.extend(check(survivors))

    tier3_summary = None
    if run_tier3:
        checks_run.append("tier3_reference_ppr_divergence")
        tier3_summary, tier3_issues = _run_tier3_check(survivors)
        issues.extend(tier3_issues)

    status = "warned" if any(i.severity == Severity.WARNING for i in issues) else "passed"

    report = ValidationReport(
        season=season,
        source=source,
        generated_at=generated_at,
        status=status,
        player_count=len(survivors),
        checks_run=checks_run,
        issues=issues,
        tier3=tier3_summary,
    )
    return survivors, report
