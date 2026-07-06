"""goodvibes doctor command — checks that goodvibes setup is complete."""
from __future__ import annotations

import importlib.metadata
import pathlib
import subprocess
from dataclasses import dataclass, field

import typer
from rich.console import Console
from rich.panel import Panel

# ponytail: not imported from sentinel_merge — define locally to avoid coupling
SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

console = Console()


def _installed_version() -> str:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


@dataclass
class CheckResult:
    label: str
    passed: bool
    remedy: str = field(default="")


def _check_headroom() -> CheckResult:
    try:
        subprocess.run(
            ["headroom", "compress", "--help"],
            capture_output=True, text=True, check=True, timeout=10
        )
        return CheckResult(label="headroom installed and working", passed=True)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return CheckResult(
            label="headroom installed and working",
            passed=False,
            remedy='Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
        )


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
            passed=passed,
            remedy="" if passed else f'Run: git config --global {key} "Your Value"',
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return CheckResult(
            label=f"git {key}",
            passed=False,
            remedy=f'Run: git config --global {key} "Your Value"',
        )


def _check_claude_md(cwd: pathlib.Path) -> CheckResult:
    present = (cwd / "CLAUDE.md").exists()
    return CheckResult(
        label="CLAUDE.md present",
        passed=present,
        remedy="" if present else "Run: goodvibes init",
    )


def _check_sentinel(cwd: pathlib.Path) -> CheckResult:
    path = cwd / "CLAUDE.md"
    if not path.exists():
        return CheckResult(label="goodvibes sentinel block", passed=False, remedy="Run: goodvibes init")
    content = path.read_text(encoding="utf-8")
    ok = SENTINEL_START in content and SENTINEL_END in content
    return CheckResult(
        label="goodvibes sentinel block",
        passed=ok,
        remedy="" if ok else "Run: goodvibes init (will merge sentinel block)",
    )


def doctor_cmd() -> None:
    """Check that goodvibes setup is complete."""
    cwd = pathlib.Path.cwd()

    results = [
        _check_headroom(),
        _check_git_config("user.name"),
        _check_git_config("user.email"),
        _check_claude_md(cwd),
        _check_sentinel(cwd),
    ]

    version = _installed_version()
    lines = [f"goodvibes v{version}"] + [f"{'✓' if r.passed else '✗'} {r.label}" for r in results]
    console.print(Panel("\n".join(lines), title="goodvibes doctor"))

    failures = [r for r in results if not r.passed]
    if failures:
        remediation = "\n".join(r.remedy for r in failures if r.remedy)
        console.print(Panel(remediation, title="How to fix"))
        raise typer.Exit(1)

    console.rule("[green]All checks passed.[/green]")
