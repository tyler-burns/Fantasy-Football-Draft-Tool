"""Enforces Standing Rule #2 (spec Section 31): no Sleeper field name or URL
fragment may appear outside `fantasy_value/projections/sleeper/`. This
converts an architectural rule people forget into a build failure.
"""

from __future__ import annotations

import re
from pathlib import Path

from fantasy_value.constants import ROOT

SRC_ROOT = ROOT / "src" / "fantasy_value"
SCRIPTS_ROOT = ROOT / "scripts"
SLEEPER_PACKAGE = SRC_ROOT / "projections" / "sleeper"

# Phase 0's throwaway endpoint-discovery script is explicitly exempt: its
# whole purpose was probing Sleeper's raw, undocumented field names before
# the ProjectionSource abstraction existed. It is not part of the pipeline.
EXEMPT_FILES = {SCRIPTS_ROOT / "explore_endpoints.py"}

# Tokens that are unambiguously Sleeper-only (not shared with the canonical
# schema). Word-boundary regexes so e.g. canonical `rec_yds` never matches
# Sleeper's `rec_yd`.
BANNED_TOKENS: tuple[str, ...] = (
    r"rec_yd\b",
    r"rec_td\b",
    r"pass_yd\b",
    r"pass_td\b",
    r"rush_yd\b",
    r"rush_td\b",
    r"fum_lost\b",
    r"\bfum\b",
    r"\bgp\b",
    r"adp_dd_ppr",
    r"pos_adp_dd_ppr",
    r"cmp_pct",
    r"\bpts_ppr\b",
    r"\bpts_half_ppr\b",
    r"\bpts_std\b",
    r"api\.sleeper\.app",
    r"season_type=regular",
    r"position\[\]",
)

BANNED_RE = re.compile("|".join(BANNED_TOKENS))


def _python_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return [p for p in directory.rglob("*.py") if p.is_file()]


def _guarded_files() -> list[Path]:
    files = _python_files(SRC_ROOT) + _python_files(SCRIPTS_ROOT)
    return [f for f in files if SLEEPER_PACKAGE not in f.parents and f != Path(__file__) and f not in EXEMPT_FILES]


def test_no_sleeper_field_names_outside_sleeper_package() -> None:
    violations: list[str] = []
    for path in _guarded_files():
        text = path.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), start=1):
            match = BANNED_RE.search(line)
            if match:
                violations.append(f"{path.relative_to(ROOT)}:{lineno}: {match.group(0)!r} in: {line.strip()}")

    assert not violations, "Sleeper-only tokens leaked outside projections/sleeper/:\n" + "\n".join(violations)


def test_sleeper_label_itself_is_allowed_everywhere() -> None:
    # Sanity check on the guard itself: "sleeper" as a source label/value is
    # fine anywhere -- it's not a field name. Only banned if it somehow
    # matched BANNED_RE, which it should not.
    assert not BANNED_RE.search("source_name == 'sleeper'")
