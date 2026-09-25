"""goodvibes usage command — best-effort token report from local Claude Code session logs."""
from __future__ import annotations

import datetime
import json
import pathlib
import re
import time
from typing import Annotated

import typer

from goodvibes_cli.steps.global_setup import claude_config_dir

FOOTER = "Claude Code's log format is internal and can change; these numbers are best effort."
NEAR_LIMIT = 160_000
FIELDS = (("input", "input_tokens"), ("output", "output_tokens"), ("cacheRead", "cache_read_input_tokens"), ("cacheCreation", "cache_creation_input_tokens"))


def project_folder_name(cwd: pathlib.PurePath) -> str:
    return re.sub(r"[^A-Za-z0-9]", "-", str(cwd))


def _tokens(value: object) -> int:
    return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0


def _ratio(read: int, context: int) -> float | int:
    # Integer-valued ratios print as 0/1 so the JSON matches the npm CLI's JSON.stringify output.
    ratio = read / context if context else 0
    return int(ratio) if ratio in (0, 1) else ratio


def session_usage(path: pathlib.Path) -> dict | None:
    """Sums one transcript's usage; reads only the usage numbers, never message content."""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        mtime = path.stat().st_mtime
    except OSError:
        return None
    messages: dict[object, dict] = {}
    for n, line in enumerate(text.splitlines()):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        message = entry.get("message") if isinstance(entry, dict) and entry.get("type") == "assistant" else None
        usage = message.get("usage") if isinstance(message, dict) else None
        if not isinstance(usage, dict):
            continue
        counts = {key: _tokens(usage.get(field)) for key, field in FIELDS}
        # Claude Code logs a streamed reply several times under one id; the last copy has the most output.
        msg_id = message.get("id") or ("line", n)
        if msg_id not in messages or counts["output"] > messages[msg_id]["output"]:
            messages[msg_id] = counts
    if not messages:
        return None
    sums = {key: sum(m[key] for m in messages.values()) for key, _ in FIELDS}
    stamp = datetime.datetime.fromtimestamp(mtime, datetime.timezone.utc)
    return {
        "id": path.stem,
        "file": str(path),
        "mtime": stamp.strftime("%Y-%m-%dT%H:%M:%S.") + f"{stamp.microsecond // 1000:03d}Z",
        **sums,
        "cacheHitRatio": _ratio(sums["cacheRead"], sums["input"] + sums["cacheRead"] + sums["cacheCreation"]),
        "peakContext": max(m["input"] + m["cacheRead"] + m["cacheCreation"] for m in messages.values()),
        "_mtime": mtime,
    }


def collect_sessions(projects_dir: pathlib.Path, folder: str | None, days: int, now: float | None = None) -> list[dict]:
    """Sessions newest first; folder None means every project."""
    cutoff = (now or time.time()) - days * 86400
    files = projects_dir.glob("*/*.jsonl") if folder is None else (projects_dir / folder).glob("*.jsonl")
    sessions = []
    for path in files:
        try:
            if path.stat().st_mtime < cutoff:
                continue
        except OSError:
            continue
        s = session_usage(path)
        if s:
            sessions.append(s)
    return sorted(sessions, key=lambda s: s["_mtime"], reverse=True)


def totals(sessions: list[dict]) -> dict:
    sums = {key: sum(s[key] for s in sessions) for key, _ in FIELDS}
    return {
        **sums,
        "cacheHitRatio": _ratio(sums["cacheRead"], sums["input"] + sums["cacheRead"] + sums["cacheCreation"]),
        "peakContext": max((s["peakContext"] for s in sessions), default=0),
    }


def _pct(ratio: float) -> int:
    # floor(x + 0.5) matches JavaScript Math.round; Python round() rounds halves to even.
    return int(ratio * 100 + 0.5)


def _print_report(sessions: list[dict], scope: str, days: int) -> None:
    typer.echo(f"Token usage, {scope}, last {days} days\n")
    typer.echo(f"{'Date':<10}  {'Session':<8}  {'Total tokens':>12}  {'Cache hit':>9}  {'Peak context':>12}")
    for s in sessions[:10]:
        date = datetime.datetime.fromtimestamp(s["_mtime"]).strftime("%Y-%m-%d")
        total = s["input"] + s["output"] + s["cacheRead"] + s["cacheCreation"]
        mark = " !" if s["peakContext"] > NEAR_LIMIT else ""
        typer.echo(f"{date:<10}  {s['id'][:8]:<8}  {total:>12,}  {_pct(s['cacheHitRatio']):>8}%  {s['peakContext']:>12,}{mark}")
    t = totals(sessions)
    typer.echo(
        f"\nTotals ({len(sessions)} sessions): {t['input'] + t['output'] + t['cacheRead'] + t['cacheCreation']:,} tokens "
        f"(input {t['input']:,}, output {t['output']:,}, cache read {t['cacheRead']:,}, cache creation {t['cacheCreation']:,}), "
        f"cache hit {_pct(t['cacheHitRatio'])}%, peak context {t['peakContext']:,}"
    )
    if any(s["peakContext"] > NEAR_LIMIT for s in sessions[:10]):
        typer.echo("\n! near the context limit of most Claude models (200k); starting a fresh session is cheaper")


def usage_cmd(
    all_projects: Annotated[bool, typer.Option("--all", help="Every project, not just this one")] = False,
    days: Annotated[int, typer.Option("--days", min=1, help="Only sessions changed in the last N days")] = 7,
    as_json: Annotated[bool, typer.Option("--json", help="Machine-readable output")] = False,
) -> None:
    """Best-effort token report from local Claude Code session logs (offline)."""
    projects_dir = claude_config_dir() / "projects"
    folder = None if all_projects else project_folder_name(pathlib.Path.cwd())
    problem = None
    if not projects_dir.is_dir():
        problem = f"No Claude Code session logs found in {projects_dir}."
    elif folder is not None and not (projects_dir / folder).is_dir():
        problem = f"No Claude Code sessions found for this project (looked in {projects_dir / folder}). Try: goodvibes usage --all"
    sessions = [] if problem else collect_sessions(projects_dir, folder, days)
    if not problem and not sessions:
        problem = f"No Claude Code sessions with token usage in the last {days} days."

    if as_json:
        if problem:
            typer.echo(problem, err=True)
        public = [{k: v for k, v in s.items() if not k.startswith("_")} for s in sessions]
        typer.echo(json.dumps({"sessions": public, "totals": totals(sessions)}, indent=2))
        return
    if problem:
        typer.echo(problem)
    else:
        _print_report(sessions, "all projects" if all_projects else "this project", days)
    typer.echo(f"\n{FOOTER}")
