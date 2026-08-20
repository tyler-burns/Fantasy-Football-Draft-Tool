from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fantasy_value.atomic import write_json_atomic, write_validated_json
from fantasy_value.constants import DATA_PROCESSED, DEFAULT_SEASON, PUBLISH_TOP_N
from fantasy_value.errors import FantasyValueError
from fantasy_value.projections.base import ProjectionSource
from fantasy_value.snapshot import apply_publish_cap, build_snapshot, verify_snapshot
from fantasy_value.validation.models import Severity, ValidationIssue
from fantasy_value.validation.runner import run_validation

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class PipelineConfig:
    season: int = DEFAULT_SEASON
    output_path: Path = DATA_PROCESSED / "projections.json"
    report_path: Path = DATA_PROCESSED / "validation-report.json"
    top_n: int = PUBLISH_TOP_N
    run_tier3: bool = True
    clock: Callable[[], datetime] = _utcnow


@dataclass(slots=True)
class PipelineResult:
    status: str  # "published" | "failed"
    player_count: int
    report_path: Path
    output_path: Path | None
    error: str | None = None


def run_pipeline(source: ProjectionSource, config: PipelineConfig | None = None) -> PipelineResult:
    """Fetch -> validate -> cap -> publish. Never overwrites a good
    projections.json with a dataset that failed validation (spec Section
    10) -- if anything raises before the final atomic write, the report is
    still written (status="failed", naming the failure), but `output_path`
    is left untouched.
    """
    config = config or PipelineConfig()
    generated_at = config.clock()

    try:
        projections = source.fetch_projections(config.season)
        survivors, report = run_validation(
            projections,
            season=config.season,
            source=source.source_name,
            generated_at=generated_at,
            run_tier3=config.run_tier3,
        )

        capped, excluded_no_adp = apply_publish_cap(survivors, top_n=config.top_n)
        if excluded_no_adp:
            report.issues.append(
                ValidationIssue(
                    check="publish_cap_excluded_no_adp",
                    severity=Severity.INFO,
                    message=f"{excluded_no_adp} players excluded from the top-{config.top_n} "
                    "publish cap for having no ADP at all",
                    context={"excluded_count": excluded_no_adp, "top_n": config.top_n},
                )
            )
        report.player_count = len(capped)

        projection_company = getattr(source, "projection_company", None)
        aggregation = getattr(source, "aggregation_label", "unknown")

        snapshot = build_snapshot(
            capped,
            season=config.season,
            source=source.source_name,
            projection_company=projection_company,
            aggregation=aggregation,
            generated_at=generated_at,
            validation_warnings=report.warning_count,
        )

        write_validated_json(config.output_path, snapshot, verify_snapshot)
        write_json_atomic(config.report_path, report.to_dict())

        logger.info(
            "Published %d players to %s (warnings=%d, errors=%d)",
            len(capped),
            config.output_path,
            report.warning_count,
            report.error_count,
        )
        return PipelineResult(
            status="published",
            player_count=len(capped),
            report_path=config.report_path,
            output_path=config.output_path,
        )

    except FantasyValueError as exc:
        logger.error("Pipeline failed, previous snapshot preserved: %s", exc)
        failure_report = {
            "season": config.season,
            "source": getattr(source, "source_name", "unknown"),
            "generated_at": generated_at.isoformat(),
            "status": "failed",
            "error": str(exc),
            "check": getattr(exc, "check", None),
        }
        write_json_atomic(config.report_path, failure_report)
        return PipelineResult(
            status="failed",
            player_count=0,
            report_path=config.report_path,
            output_path=None,
            error=str(exc),
        )
