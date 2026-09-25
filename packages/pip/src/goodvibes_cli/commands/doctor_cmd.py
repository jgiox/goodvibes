"""goodvibes doctor command — checks that goodvibes setup is complete."""
from __future__ import annotations

import errno
import importlib.metadata
import json
import math
import os
import pathlib
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Annotated, Literal
from urllib.parse import urlsplit

import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from goodvibes_cli.steps.git_hook import install_git_hook
from goodvibes_cli.steps.global_setup import claude_config_dir
from goodvibes_cli.steps.write_manifest import ManifestError, read_manifest
from goodvibes_cli.utils.safe_path import printable as _printable

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


def _check_git_hook(cwd: pathlib.Path) -> list[CheckResult]:
    if not (cwd / "JOURNAL.md").is_file():
        return []
    status = install_git_hook(cwd, True)["status"]
    if status == "installed":
        try:
            turned_off = (read_manifest(cwd) or {}).get("gitHook") == "user-removed"
        except ManifestError:
            turned_off = False  # the manifest check already reports it
        if turned_off:
            return [CheckResult("Git commit check turned off", "skip")]
    return {
        "current": [CheckResult("Git commit check installed", "ok")],
        "updated": [CheckResult("Git commit check out of date", "warn", "Run: goodvibes update")],
        "installed": [CheckResult("Git commit check not installed", "warn", "Run: goodvibes update")],
        "custom-path": [CheckResult("Git commit check not managed (core.hooksPath is set)", "skip")],
        "existing-hook": [CheckResult("Git commit check not managed (your own pre-commit hook)", "skip")],
    }.get(status, [])


SECRET_KEY = re.compile(r"key|token|secret|password|authorization", re.I)
LOOPBACK = {"localhost", "127.0.0.1", "::1"}


def claude_json_path() -> pathlib.Path:
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    if not cfg:
        return pathlib.Path.home() / ".claude.json"
    dotted = pathlib.Path(cfg) / ".claude.json"
    plain = pathlib.Path(cfg) / "claude.json"
    return plain if not dotted.exists() and plain.exists() else dotted


UVX_VALUE_OPTIONS = {"-p", "--python", "--with", "--index", "--index-url", "--default-index", "--extra-index-url"}


def _option_value(args: list[str], names: tuple[str, ...]) -> str | None:
    for i, a in enumerate(args):
        if a in names:
            return args[i + 1] if i + 1 < len(args) else None
        for n in names:
            if n.startswith("--") and a.startswith(n + "="):
                return a[len(n) + 1:]
    return None


def _unpinned_package(command: str, args: list[str]) -> tuple[str, str] | None:
    """(launcher, package) when a launcher fetches a package with no pinned version on every run."""
    if command.startswith((".", "/")) or "/" in command or "\\" in command:
        return None
    name = command[:-4] if command.lower().endswith((".cmd", ".exe")) else command
    if name == "pnpm" and args[:1] == ["dlx"]:
        name, args = "pnpm dlx", args[1:]
    if name not in ("npx", "bunx", "pnpm dlx", "uvx"):
        return None
    uvx = name == "uvx"
    pkg = _option_value(args, ("--from",) if uvx else ("-p", "--package"))
    i = 0
    while pkg is None and i < len(args):
        if uvx and args[i] in UVX_VALUE_OPTIONS:
            i += 2
            continue
        if not args[i].startswith("-"):
            pkg = args[i]
        i += 1
    if pkg is None:
        return None
    at = pkg.rfind("@")
    pinned = 0 < at and pkg[at + 1:] not in ("", "latest")
    return None if pinned or (uvx and "==" in pkg) else (name, pkg.removesuffix("@latest"))


def server_problems(server: dict) -> list[tuple[str, str]]:
    """(problem, remedy) pairs for one MCP server entry; secret values are never included."""
    problems: list[tuple[str, str]] = []
    command = server.get("command") if isinstance(server.get("command"), str) else ""
    args = [a for a in server.get("args") or [] if isinstance(a, str)] if isinstance(server.get("args"), list) else []
    if pathlib.PurePath(command).name in ("sh", "bash") and "-c" in args[:-1]:
        script = args[args.index("-c") + 1]
        if ("curl" in script or "wget" in script) and "|" in script:
            problems.append(("pipes a download into a shell", "Install the tool once from a release you trust and run it directly."))
    unpinned = _unpinned_package(command, args) if command else None
    if unpinned:
        launcher, pkg = unpinned
        problems.append((f"{launcher} fetches unpinned {pkg} on every run", f"Pin a version: {pkg}{'==' if launcher == 'uvx' else '@'}<version>."))
    url = server.get("url")
    if isinstance(url, str):
        try:
            parts = urlsplit(url)
            host = parts.hostname
        except ValueError:
            parts, host = None, None
        if parts and parts.scheme == "http" and host not in LOOPBACK:
            problems.append((f"uses plain http to {host}", "Use an https:// URL."))
    for where in ("env", "headers"):
        values = server.get(where)
        for key, value in (values.items() if isinstance(values, dict) else []):
            if SECRET_KEY.search(key) and isinstance(value, str) and len(value) > 16 and not re.search(r"\$\{[^}]+\}", value):
                problems.append((f"literal secret in {where}.{key}", "Move it to an environment variable and reference ${VAR}."))
    return problems


def _load_json(path: pathlib.Path) -> tuple[dict, list[CheckResult]]:
    path = path.absolute()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}, []
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}, [CheckResult(f"{path} is not valid JSON; its MCP servers were not checked", "warn")]
    except OSError as e:
        code = errno.errorcode.get(e.errno, type(e).__name__) if e.errno else type(e).__name__
        return {}, [CheckResult(f"{path} could not be read ({code}); its MCP servers were not checked", "warn")]
    return (data if isinstance(data, dict) else {}), []


def _servers(section: object) -> dict:
    servers = section.get("mcpServers") if isinstance(section, dict) else None
    return servers if isinstance(servers, dict) else {}


def _check_mcp(cwd: pathlib.Path) -> list[CheckResult]:
    def report(servers: dict, scope: str) -> list[CheckResult]:
        out: list[CheckResult] = []
        for name, server in servers.items():
            problems = server_problems(server) if isinstance(server, dict) else []
            out += [CheckResult(_printable(f"MCP {name} ({scope}): {p}"), "warn", _printable(r)) for p, r in problems] or [CheckResult(_printable(f"MCP {name} ({scope})"), "ok")]
        return out

    user, results = _load_json(claude_json_path())
    projects = user.get("projects") if isinstance(user.get("projects"), dict) else {}
    results += report(_servers(user), "user") + report(_servers(projects.get(str(cwd))), "local")
    project, project_errors = _load_json(cwd / ".mcp.json")
    return results + project_errors + report(_servers(project), "project")


def _check_goodvibes_cli() -> CheckResult:
    if shutil.which("goodvibes"):
        return CheckResult("goodvibes command on PATH", "ok")
    return CheckResult(
        "goodvibes command not on PATH",
        "warn",
        "Optional: lets the session-start check run. Install: uv tool install goodvibes-cli (or: npm install -g goodvibes-cli)",
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
        checks = [*manifest_checks, _check_git_config("user.name"), _check_git_config("user.email"), *(_rule_checks(cwd, scope) if scope else []), *_check_journal(cwd)]
        for r in checks:
            if r.status in ("warn", "fail"):
                head = r.label if r.label.endswith(".") else f"{r.label}."
                typer.echo(f"goodvibes doctor: {SYMBOLS[r.status]} {head}" + (f" {r.remedy}" if r.remedy else ""))
        return

    scope, manifest_checks = _project_scope(cwd)
    results = [
        *manifest_checks,
        _check_headroom(),
        _check_goodvibes_cli(),
        _check_git_config("user.name"),
        _check_git_config("user.email"),
        *_rule_checks(cwd, scope),
        *_check_journal(cwd),
        *_check_git_hook(cwd),
        *_check_mcp(cwd),
    ]

    version = _installed_version()
    lines = [f"goodvibes v{version}"] + [f"{SYMBOLS[r.status]} {r.label}" for r in results]
    console.print(Panel(Text("\n".join(lines)), title="goodvibes doctor"))

    fixes = [f"{r.label}: {r.remedy}" for r in results if r.status in ("warn", "fail") and r.remedy]
    if fixes:
        console.print(Panel(Text("\n".join(fixes)), title="How to fix"))
    typer.echo(summary_line(results))
    if any(r.status == "fail" for r in results):
        raise typer.Exit(1)
