from __future__ import annotations

from typing import Sequence

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.validation.models import Severity, ValidationIssue

REQUIRED_FIELDS: tuple[str, ...] = ("player_id", "player_name", "position", "team", "season")


def check_required_fields(
    projections: Sequence[PlayerProjection],
) -> tuple[list[PlayerProjection], list[ValidationIssue]]:
    """Section 9.4: every published record must have non-null player_id,
    player_name, position, team, season. Records failing this are excluded
    from publication and get an ERROR-severity issue each."""
    survivors: list[PlayerProjection] = []
    issues: list[ValidationIssue] = []

    for proj in projections:
        missing = [field for field in REQUIRED_FIELDS if getattr(proj, field) in (None, "")]
        if missing:
            issues.append(
                ValidationIssue(
                    check="required_fields",
                    severity=Severity.ERROR,
                    message=f"missing required field(s): {', '.join(missing)}",
                    player_id=proj.player_id,
                    player_name=proj.player_name,
                    context={"missing_fields": missing},
                )
            )
        else:
            survivors.append(proj)

    return survivors, issues
