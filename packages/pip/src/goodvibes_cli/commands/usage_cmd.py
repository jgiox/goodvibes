"""goodvibes usage command — best-effort token report from local Claude Code session logs."""
from __future__ import annotations

import datetime
import errno
import json
import math
import os
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
    """Sums one transcript's usage; reads only the usage numbers, never message content. Raises OSError."""
    text = path.read_text(encoding="utf-8", errors="replace")
    mtime = path.stat().st_mtime
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
        msg_id = message["id"] if isinstance(message.get("id"), str) else ("line", n)
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


def _code(e: OSError) -> str:
    return errno.errorcode.get(e.errno, type(e).__name__) if e.errno else type(e).__name__


def collect_sessions(projects_dir: pathlib.Path, folder: str | None, days: int, now: float | None = None) -> list[dict]:
    """Sessions newest first; folder None means every project. Unreadable logs are reported on stderr."""
    cutoff = (now or time.time()) - days * 86400
    folders = [projects_dir / folder] if folder else sorted(d for d in projects_dir.iterdir() if d.is_dir())
    sessions = []
    for d in folders:
        try:
            names = sorted(n for n in os.listdir(d) if n.endswith(".jsonl"))
        except OSError as e:
            typer.echo(f"Skipped {d}: could not read it ({_code(e)}).", err=True)
            continue
        for name in names:
            path = d / name
            try:
                if path.stat().st_mtime < cutoff:
                    continue
                s = session_usage(path)
            except OSError as e:
                typer.echo(f"Skipped {path}: could not read it ({_code(e)}).", err=True)
                continue
            if s:
                sessions.append(s)
    sessions.sort(key=lambda s: s["id"])
    return sorted(sessions, key=lambda s: s["mtime"], reverse=True)


def totals(sessions: list[dict]) -> dict:
    sums = {key: sum(s[key] for s in sessions) for key, _ in FIELDS}
    return {
        **sums,
        "cacheHitRatio": _ratio(sums["cacheRead"], sums["input"] + sums["cacheRead"] + sums["cacheCreation"]),
        "peakContext": max((s["peakContext"] for s in sessions), default=0),
    }


def _pct(ratio: float) -> str:
    return f"{math.floor(ratio * 100)}%"


def _cols(first: str, total: str, hit: str, peak: str) -> str:
    return first + total.rjust(12) + hit.rjust(11) + peak.rjust(14)


def _sum(t: dict) -> str:
    return f"{t['input'] + t['output'] + t['cacheRead'] + t['cacheCreation']:,}"


def _print_report(sessions: list[dict], scope: str, days: int) -> None:
    shown = sessions[:10]
    more = f", showing the {len(shown)} most recent" if len(sessions) > len(shown) else ""
    typer.echo(f"Token usage for {scope}, last {days} days: {len(sessions)} session(s){more}\n")
    typer.echo(_cols("Date".ljust(12) + "Session".ljust(10), "Total tokens", "Cache hit", "Peak context"))
    for s in shown:
        date = datetime.datetime.fromtimestamp(s["_mtime"]).strftime("%Y-%m-%d")
        mark = " !" if s["peakContext"] > NEAR_LIMIT else ""
        typer.echo(_cols(date.ljust(12) + s["id"][:8].ljust(10), _sum(s), _pct(s["cacheHitRatio"]), f"{s['peakContext']:,}") + mark)
    t = totals(sessions)
    typer.echo(_cols("Total".ljust(22), _sum(t), _pct(t["cacheHitRatio"]), f"{t['peakContext']:,}"))
    typer.echo(f"Input {t['input']:,}, output {t['output']:,}, cache read {t['cacheRead']:,}, cache creation {t['cacheCreation']:,}\n")
    if any(s["peakContext"] > NEAR_LIMIT for s in shown):
        typer.echo("! near the context limit of most Claude models (200k); starting a fresh session is cheaper")


def usage_cmd(
    all_projects: Annotated[bool, typer.Option("--all", help="Every project, not just this one")] = False,
    days: Annotated[str, typer.Option("--days", help="Only sessions changed in the last N days")] = "7",
    as_json: Annotated[bool, typer.Option("--json", help="Machine-readable output")] = False,
) -> None:
    """Best-effort token report from local Claude Code session logs (offline)."""
    if not re.fullmatch(r"\d+", days) or int(days) < 1:
        typer.echo(f'--days must be a whole number of 1 or more (got "{days}").', err=True)
        raise typer.Exit(1)
    n_days = int(days)
    projects_dir = claude_config_dir() / "projects"
    folder = None if all_projects else project_folder_name(pathlib.Path.cwd())
    problem = None
    sessions: list[dict] = []
    if not projects_dir.is_dir():
        problem = f"No Claude Code session logs found in {projects_dir}. They appear after you use Claude Code."
    elif folder is not None and not (projects_dir / folder).is_dir():
        problem = f"No Claude Code sessions found for this project (looked in {projects_dir / folder}). Run goodvibes usage --all to see every project."
    else:
        try:
            sessions = collect_sessions(projects_dir, folder, n_days)
        except OSError as e:
            problem = f"Could not read {projects_dir} ({_code(e)})."
        if not problem and not sessions:
            problem = f"No Claude Code sessions with token usage in the last {n_days} day(s)."

    # JSON mode keeps stdout parseable, so every human message goes to stderr.
    if as_json:
        public = [{k: v for k, v in s.items() if not k.startswith("_")} for s in sessions]
        typer.echo(json.dumps({"sessions": public, "totals": totals(sessions)}, indent=2))
    if problem:
        typer.echo(problem, err=as_json)
    elif not as_json:
        _print_report(sessions, "all projects" if all_projects else "this project", n_days)
    typer.echo(FOOTER, err=as_json)
