from __future__ import annotations

from typing import Sequence

from fantasy_value.projections.models import PlayerProjection
from fantasy_value.validation.models import Severity, Tier3Summary, ValidationIssue
from fantasy_value.validation.reference_scoring import compute_reference_ppr

MIN_REFERENCE_PTS = 10.0
DIVERGENCE_THRESHOLD = 0.10
LOUD_THRESHOLD_PCT = 5.0
WORST_OFFENDERS_SHOWN = 10


def run_tier3(projections: Sequence[PlayerProjection]) -> tuple[Tier3Summary, list[ValidationIssue]]:
    """Section 9.3: compute fantasy points under a standard PPR preset per
    player and compare to `reference_pts_ppr` (Sleeper's own precomputed
    total). Only compares players with a real, complete reference total
    (>= MIN_REFERENCE_PTS; the normalizer already nulls reference_pts_ppr
    out for players with any week missing a reference total, so partial
    sums never reach here). Never blocks publication -- emits one loud WARNING plus a
    summary of the worst offenders.
    """
    comparable = [p for p in projections if p.reference_pts_ppr is not None and p.reference_pts_ppr >= MIN_REFERENCE_PTS]

    diffs: list[tuple[PlayerProjection, float, float]] = []  # (proj, computed, pct_diff)
    for proj in comparable:
        computed = compute_reference_ppr(proj)
        reference = proj.reference_pts_ppr
        assert reference is not None
        pct_diff = abs(computed - reference) / reference
        diffs.append((proj, computed, pct_diff))

    diverged = [d for d in diffs if d[2] > DIVERGENCE_THRESHOLD]
    diverged_pct = (100.0 * len(diverged) / len(diffs)) if diffs else 0.0
    loud = diverged_pct > LOUD_THRESHOLD_PCT

    worst = sorted(diffs, key=lambda d: d[2], reverse=True)[:WORST_OFFENDERS_SHOWN]
    worst_dicts = [
        {
            "player_id": proj.player_id,
            "player_name": proj.player_name,
            "computed": round(computed, 2),
            "reference": round(proj.reference_pts_ppr, 2),  # type: ignore[arg-type]
            "pct_diff": round(pct_diff * 100, 2),
        }
        for proj, computed, pct_diff in worst
    ]

    summary = Tier3Summary(
        compared=len(diffs),
        diverged=len(diverged),
        diverged_pct=round(diverged_pct, 2),
        threshold_pct=LOUD_THRESHOLD_PCT,
        worst=worst_dicts,
        loud=loud,
    )

    issues: list[ValidationIssue] = []
    if loud:
        issues.append(
            ValidationIssue(
                check="tier3_reference_ppr_divergence",
                severity=Severity.WARNING,
                message=(
                    f"{len(diverged)}/{len(diffs)} ({diverged_pct:.1f}%) players diverge >10% from "
                    f"Sleeper's own reference PPR total -- exceeds the {LOUD_THRESHOLD_PCT}% threshold. "
                    "This usually indicates a field-mapping bug in the normalizer."
                ),
                context={"summary": summary.to_dict()},
            )
        )

    return summary, issues
