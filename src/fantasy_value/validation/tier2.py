from __future__ import annotations

from typing import Callable, Iterator, Sequence

from fantasy_value.projections.models import STAT_FIELDS, PlayerProjection
from fantasy_value.validation.models import Severity, ValidationIssue

Tier2Check = Callable[[Sequence[PlayerProjection]], Iterator[ValidationIssue]]

GAMES_PROJ_TOLERANCE = 1e-6


def _ranked_by_position(
    projections: Sequence[PlayerProjection], position: str, n: int
) -> tuple[list[PlayerProjection], str]:
    """Top-N players at `position`, ranked by ADP ascending among players
    who have an ADP. Falls back to reference_pts_ppr ordering if fewer than
    n players at that position have an ADP (an ADP-less player can't be
    placed in an ADP-ranked window)."""
    pool = [p for p in projections if p.position == position]
    with_adp = sorted((p for p in pool if p.adp is not None), key=lambda p: p.adp)  # type: ignore[arg-type,return-value]

    if len(with_adp) >= n:
        return with_adp[:n], "adp"

    with_ref = sorted(
        (p for p in pool if p.reference_pts_ppr is not None), key=lambda p: p.reference_pts_ppr, reverse=True
    )
    return with_ref[:n], "reference_pts_ppr"


def stats_non_negative(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    for proj in projections:
        for field_name in STAT_FIELDS:
            value = proj.stat(field_name)
            if value < 0:
                yield ValidationIssue(
                    check="stats_non_negative",
                    severity=Severity.WARNING,
                    message=f"{field_name} is negative ({value})",
                    player_id=proj.player_id,
                    player_name=proj.player_name,
                    context={"field": field_name, "value": value},
                )


def pass_cmp_le_att(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    for proj in projections:
        if proj.pass_cmp > proj.pass_att:
            yield ValidationIssue(
                check="pass_cmp_le_att",
                severity=Severity.WARNING,
                message=f"pass_cmp ({proj.pass_cmp}) exceeds pass_att ({proj.pass_att})",
                player_id=proj.player_id,
                player_name=proj.player_name,
            )


def receptions_le_targets(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    for proj in projections:
        if proj.receptions > proj.rec_tgt:
            yield ValidationIssue(
                check="receptions_le_targets",
                severity=Severity.WARNING,
                message=f"receptions ({proj.receptions}) exceeds rec_tgt ({proj.rec_tgt})",
                player_id=proj.player_id,
                player_name=proj.player_name,
            )


def games_proj_le_18(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    for proj in projections:
        if proj.games_proj > 18 + GAMES_PROJ_TOLERANCE:
            yield ValidationIssue(
                check="games_proj_le_18",
                severity=Severity.WARNING,
                message=f"games_proj ({proj.games_proj}) exceeds 18",
                player_id=proj.player_id,
                player_name=proj.player_name,
            )


def qb_top32_has_pass_yds(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    top, ranking = _ranked_by_position(projections, "QB", 32)
    for proj in top:
        if proj.pass_yds == 0:
            yield ValidationIssue(
                check="qb_top32_has_pass_yds",
                severity=Severity.WARNING,
                message=f"top-32 QB (by {ranking}) has zero pass_yds",
                player_id=proj.player_id,
                player_name=proj.player_name,
                context={"ranking": ranking},
            )


def rb_top24_has_rush_att(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    top, ranking = _ranked_by_position(projections, "RB", 24)
    for proj in top:
        if proj.rush_att == 0:
            yield ValidationIssue(
                check="rb_top24_has_rush_att",
                severity=Severity.WARNING,
                message=f"top-24 RB (by {ranking}) has zero rush_att",
                player_id=proj.player_id,
                player_name=proj.player_name,
                context={"ranking": ranking},
            )


def qb_top12_pass_yds_range(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    top, ranking = _ranked_by_position(projections, "QB", 12)
    for proj in top:
        if not (2000 <= proj.pass_yds <= 6000):
            yield ValidationIssue(
                check="qb_top12_pass_yds_range",
                severity=Severity.WARNING,
                message=f"top-12 QB (by {ranking}) pass_yds {proj.pass_yds} outside [2000, 6000]",
                player_id=proj.player_id,
                player_name=proj.player_name,
                context={"ranking": ranking, "pass_yds": proj.pass_yds},
            )


def rb_top24_rush_yds_range(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    top, ranking = _ranked_by_position(projections, "RB", 24)
    for proj in top:
        if not (400 <= proj.rush_yds <= 2500):
            yield ValidationIssue(
                check="rb_top24_rush_yds_range",
                severity=Severity.WARNING,
                message=f"top-24 RB (by {ranking}) rush_yds {proj.rush_yds} outside [400, 2500]",
                player_id=proj.player_id,
                player_name=proj.player_name,
                context={"ranking": ranking, "rush_yds": proj.rush_yds},
            )


def adp_present(projections: Sequence[PlayerProjection]) -> Iterator[ValidationIssue]:
    missing = [p for p in projections if p.adp is None]
    if missing:
        yield ValidationIssue(
            check="adp_present",
            severity=Severity.INFO,
            message=f"{len(missing)}/{len(projections)} published players have no ADP",
            context={"missing_count": len(missing), "total": len(projections)},
        )


TIER2_CHECKS: tuple[tuple[str, Tier2Check], ...] = (
    ("stats_non_negative", stats_non_negative),
    ("pass_cmp_le_att", pass_cmp_le_att),
    ("receptions_le_targets", receptions_le_targets),
    ("games_proj_le_18", games_proj_le_18),
    ("qb_top32_has_pass_yds", qb_top32_has_pass_yds),
    ("rb_top24_has_rush_att", rb_top24_has_rush_att),
    ("qb_top12_pass_yds_range", qb_top12_pass_yds_range),
    ("rb_top24_rush_yds_range", rb_top24_rush_yds_range),
    ("adp_present", adp_present),
)
