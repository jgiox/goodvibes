"""goodvibes doctor command — checks that goodvibes setup is complete."""
from __future__ import annotations

import importlib.metadata
import math
import pathlib
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Annotated, Literal

import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from goodvibes_cli.steps.global_setup import claude_config_dir
from goodvibes_cli.steps.write_manifest import ManifestError, read_manifest

# ponytail: not imported from sentinel_merge — define locally to avoid coupling
SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

console = Console()


def _installed_version() -> str:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


Status = Literal["ok", "warn", "fail", "skip"]
SYMBOLS: dict[str, str] = {"ok": "✓", "warn": "!", "fail": "✗", "skip": "-"}
HEADROOM_REMEDY = 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)'


@dataclass
class CheckResult:
    label: str
    status: Status
    remedy: str = field(default="")


def summary_line(results: list[CheckResult]) -> str:
    fails = sum(r.status == "fail" for r in results)
    warns = sum(r.status == "warn" for r in results)
    if fails:
        return f"Not ready: {fails} problem(s)."
    return f"Ready, with {warns} warning(s)." if warns else "Ready."


def _check_headroom() -> CheckResult:
    try:
        subprocess.run(
            ["headroom", "--version"],
            capture_output=True, text=True, check=True, timeout=10
        )
        return CheckResult(label="headroom installed and working", status="ok")
    except FileNotFoundError:
        return CheckResult("headroom not installed (optional: compresses what Claude reads)", "warn", HEADROOM_REMEDY)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return CheckResult("headroom not working (optional: compresses what Claude reads)", "warn", HEADROOM_REMEDY)


def _check_journal(cwd: pathlib.Path) -> list[CheckResult]:
    path = cwd / "JOURNAL.md"
    if not path.is_file() or path.stat().st_size <= 10 * 1024:
        return []
    kb = math.ceil(path.stat().st_size / 1024)
    return [CheckResult(
        f"JOURNAL.md is {kb} KB; agents read it every session",
        "warn",
        'Keep lasting decisions in its "Standing decisions" section and keep new entries short.',
    )]


def _check_goodvibes_cli() -> CheckResult:
    if shutil.which("goodvibes"):
        return CheckResult("goodvibes CLI on PATH", "ok")
    return CheckResult("goodvibes CLI not on PATH", "warn", "Run: uv tool install goodvibes-cli")


def _check_git_config(key: str) -> CheckResult:
    try:
        result = subprocess.run(
            ["git", "config", key],
            capture_output=True,
            text=True,
            check=True,
        )
        passed = bool(result.stdout.strip())
        return CheckResult(
            label=f"git {key}",
            status="ok" if passed else "fail",
            remedy="" if passed else f'Run: git config --global {key} "Your Value"',
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return CheckResult(
            label=f"git {key}",
            status="fail",
            remedy=f'Run: git config --global {key} "Your Value"',
        )


def _check_claude_md(cwd: pathlib.Path) -> CheckResult:
    present = (cwd / "CLAUDE.md").exists()
    return CheckResult(
        label="CLAUDE.md present",
        status="ok" if present else "fail",
        remedy="" if present else "Run: goodvibes init",
    )


def _check_sentinel(cwd: pathlib.Path) -> CheckResult:
    path = cwd / "CLAUDE.md"
    if not path.exists():
        return CheckResult(label="goodvibes sentinel block", status="fail", remedy="Run: goodvibes init")
    content = path.read_text(encoding="utf-8")
    ok = SENTINEL_START in content and SENTINEL_END in content
    return CheckResult(
        label="goodvibes sentinel block",
        status="ok" if ok else "fail",
        remedy="" if ok else "Run: goodvibes init (will merge sentinel block)",
    )


def _project_scope(cwd: pathlib.Path) -> tuple[str | None, list[CheckResult]]:
    try:
        manifest = read_manifest(cwd)
    except ManifestError as e:
        return "project", [CheckResult(label=".goodvibes.json is valid JSON", status="fail", remedy=str(e))]
    if manifest is None:
        return None, []
    return ("global" if manifest.get("scope") == "global" else "project"), []


def _check_global_rules() -> CheckResult:
    ok = (claude_config_dir() / "rules" / "goodvibes.md").exists()
    return CheckResult(label="goodvibes rules in Claude config", status="ok" if ok else "fail", remedy="" if ok else "Run: goodvibes init")


def _rule_checks(cwd: pathlib.Path, scope: str | None) -> list[CheckResult]:
    # Global-scope projects keep the rules in the Claude config, not in the project CLAUDE.md.
    return [_check_global_rules()] if scope == "global" else [_check_claude_md(cwd), _check_sentinel(cwd)]


def doctor_cmd(
    quick: Annotated[bool, typer.Option("--quick", help="Fast local checks only; silent when all pass, always exits 0 (used by the session-start hook)")] = False,
) -> None:
    """Check that goodvibes setup is complete."""
    cwd = pathlib.Path.cwd()

    if quick:
        # Exit 2 from a SessionStart hook blocks the session, so quick mode reports and always exits 0.
        # Outside a goodvibes project (no manifest) only the machine-wide git checks apply.
        scope, manifest_checks = _project_scope(cwd)
        checks = [_check_git_config("user.name"), _check_git_config("user.email"), *manifest_checks, *(_rule_checks(cwd, scope) if scope else []), *_check_journal(cwd)]
        for r in checks:
            if r.status in ("warn", "fail"):
                typer.echo(f"goodvibes doctor: {SYMBOLS[r.status]} {r.label}." + (f" {r.remedy}" if r.remedy else ""))
        return

    scope, manifest_checks = _project_scope(cwd)
    results = [
        _check_headroom(),
        _check_goodvibes_cli(),
        _check_git_config("user.name"),
        _check_git_config("user.email"),
        *manifest_checks,
        *_rule_checks(cwd, scope),
        *_check_journal(cwd),
    ]

    version = _installed_version()
    lines = [f"goodvibes v{version}"] + [f"{SYMBOLS[r.status]} {r.label}" for r in results]
    console.print(Panel(Text("\n".join(lines)), title="goodvibes doctor"))

    fixes = [f"{r.label} — {r.remedy}" for r in results if r.status in ("warn", "fail") and r.remedy]
    if fixes:
        console.print(Panel(Text("\n".join(fixes)), title="How to fix"))
    typer.echo(summary_line(results))
    if any(r.status == "fail" for r in results):
        raise typer.Exit(1)
