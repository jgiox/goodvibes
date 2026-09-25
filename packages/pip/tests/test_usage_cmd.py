"""Unit tests for usage_cmd, using real fixture JSONL in temp dirs."""
from __future__ import annotations

import datetime
import json
import os
import pathlib
import time

import pytest
from typer.testing import CliRunner

from goodvibes_cli.commands.usage_cmd import collect_sessions, project_folder_name, session_usage, totals
from goodvibes_cli.main import app

runner = CliRunner()
FOOTER = "Claude Code's log format is internal and can change; these numbers are best effort."
NEAR_LIMIT = "! near the context limit of most Claude models (200k); starting a fresh session is cheaper"


def _assistant(msg_id, inp=0, out=0, cr=0, cc=0, content="SECRET-CONTENT"):
    usage = {"input_tokens": inp, "output_tokens": out, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cc}
    return json.dumps({"type": "assistant", "message": {"id": msg_id, "content": [{"type": "text", "text": content}], "usage": usage}})


def _write_session(folder: pathlib.Path, session_id: str, lines: list[str], age_days: float = 0) -> pathlib.Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{session_id}.jsonl"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    mtime = time.time() - age_days * 86400
    os.utime(path, (mtime, mtime))
    return path


FIXTURE = [
    json.dumps({"type": "user", "message": {"role": "user", "content": "SECRET-CONTENT"}}),
    _assistant("msg_1", inp=10, out=5, cr=1000, cc=200),
    _assistant("msg_1", inp=10, out=50, cr=1000, cc=200),
    _assistant("msg_1", inp=10, out=20, cr=1000, cc=200),
    "{ this line is not json",
    json.dumps({"type": "assistant", "message": {"id": "msg_2", "content": "no usage here"}}),
    json.dumps({"type": "assistant", "message": {"id": "msg_3", "usage": {"input_tokens": 90, "output_tokens": 7}}}),
]


@pytest.fixture
def projects(tmp_path, monkeypatch):
    cfg = tmp_path / "cfg"
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(cfg))
    cwd = tmp_path / "my_app.v2"
    cwd.mkdir()
    monkeypatch.chdir(cwd)
    return cfg / "projects"


def test_project_folder_name_replaces_every_non_alphanumeric_character_with_a_dash():
    assert project_folder_name(pathlib.PurePosixPath("/home/jo/my_app.v2")) == "-home-jo-my-app-v2"
    assert project_folder_name(pathlib.PureWindowsPath("C:\\Users\\jo\\app")) == "C--Users-jo-app"


def test_session_usage_dedupes_by_message_id_and_skips_bad_lines_and_entries_without_usage(tmp_path):
    path = _write_session(tmp_path, "abcdef1234", FIXTURE)
    s = session_usage(path)
    assert (s["input"], s["output"], s["cacheRead"], s["cacheCreation"]) == (100, 57, 1000, 200)
    assert s["cacheHitRatio"] == 1000 / (100 + 1000 + 200)
    assert s["peakContext"] == 1210
    assert s["id"] == "abcdef1234"
    assert s["file"] == str(path)
    assert s["mtime"].endswith("Z")


def test_session_usage_counts_entries_with_a_non_string_message_id_separately_instead_of_crashing(tmp_path):
    lines = [_assistant(["a"], out=1), _assistant(["a"], out=2), _assistant({"x": 1}, out=4), _assistant(7, out=8), _assistant(7, out=16)]
    path = _write_session(tmp_path, "s", lines)
    assert session_usage(path)["output"] == 31


def test_session_usage_counts_an_entry_whose_text_contains_a_unicode_line_separator(tmp_path):
    usage = {"input_tokens": 3, "output_tokens": 4}
    line = json.dumps({"type": "assistant", "message": {"id": "m", "content": "a\u2028b\u2029c\x85d", "usage": usage}}, ensure_ascii=False)
    path = _write_session(tmp_path, "s", [line])
    s = session_usage(path)
    assert (s["input"], s["output"]) == (3, 4)


def test_session_usage_returns_none_when_no_entry_has_usage(tmp_path):
    path = _write_session(tmp_path, "s", [json.dumps({"type": "user"}), "not json"])
    assert session_usage(path) is None


def test_session_usage_raises_for_an_unreadable_file_so_the_caller_can_report_it(tmp_path):
    with pytest.raises(OSError):
        session_usage(tmp_path / "missing.jsonl")


def test_collect_sessions_keeps_the_current_project_within_the_day_window_newest_first(projects):
    folder = projects / project_folder_name(pathlib.Path.cwd())
    _write_session(folder, "old", [_assistant("a", inp=1)], age_days=10)
    _write_session(folder, "newer", [_assistant("b", inp=2)], age_days=1)
    _write_session(folder, "newest", [_assistant("c", inp=3)], age_days=0)
    _write_session(projects / "-other-project", "elsewhere", [_assistant("d", inp=4)])
    assert [s["id"] for s in collect_sessions(projects, project_folder_name(pathlib.Path.cwd()), days=7)] == ["newest", "newer"]
    assert {s["id"] for s in collect_sessions(projects, None, days=30)} == {"old", "newer", "newest", "elsewhere"}


def test_totals_sums_sessions_and_takes_the_highest_peak():
    sessions = [
        {"input": 10, "output": 1, "cacheRead": 80, "cacheCreation": 10, "peakContext": 100},
        {"input": 0, "output": 2, "cacheRead": 0, "cacheCreation": 0, "peakContext": 0},
    ]
    assert totals(sessions) == {"input": 10, "output": 3, "cacheRead": 80, "cacheCreation": 10, "cacheHitRatio": 0.8, "peakContext": 100}
    assert totals([])["cacheHitRatio"] == 0


def test_usage_says_the_project_has_no_sessions_and_suggests_all(projects):
    projects.mkdir(parents=True)
    result = runner.invoke(app, ["usage"])
    assert result.exit_code == 0
    folder = projects / project_folder_name(pathlib.Path.cwd())
    assert result.output.splitlines() == [
        f"No Claude Code sessions found for this project (looked in {folder}). Run goodvibes usage --all to see every project.",
        FOOTER,
    ]
    assert result.output.rstrip().splitlines()[-1] == FOOTER


def test_usage_is_friendly_when_there_are_no_logs_at_all(projects):
    result = runner.invoke(app, ["usage", "--all"])
    assert result.exit_code == 0
    assert result.output.splitlines() == [f"No Claude Code session logs found in {projects}. They appear after you use Claude Code.", FOOTER]


def _row(first, total, hit, peak):
    return first + total.rjust(12) + hit.rjust(11) + peak.rjust(14)


def _day(path):
    return datetime.datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")


def test_usage_prints_the_canonical_table_layout_without_message_content(projects):
    folder = projects / project_folder_name(pathlib.Path.cwd())
    older = _write_session(folder, "aaaaaaaa-1111", FIXTURE, age_days=1)
    newer = _write_session(folder, "bbbbbbbb-2222", [_assistant("x", inp=5, out=100, cr=170000, cc=1000)])
    result = runner.invoke(app, ["usage"])
    assert result.exit_code == 0
    assert "SECRET-CONTENT" not in result.output
    assert result.output.splitlines() == [
        "Token usage for this project, last 7 days: 2 session(s)",
        "",
        _row("Date".ljust(12) + "Session".ljust(10), "Total tokens", "Cache hit", "Peak context"),
        _row(_day(newer).ljust(12) + "bbbbbbbb".ljust(10), "171,105", "99%", "171,005") + " !",
        _row(_day(older).ljust(12) + "aaaaaaaa".ljust(10), "1,357", "76%", "1,210"),
        _row("Total".ljust(22), "172,462", "99%", "171,005"),
        "Input 105, output 157, cache read 171,000, cache creation 1,200",
        "",
        NEAR_LIMIT,
        FOOTER,
    ]


def test_usage_leaves_out_the_near_limit_note_when_no_session_is_marked(projects):
    _write_session(projects / project_folder_name(pathlib.Path.cwd()), "small", [_assistant("m", inp=10)])
    lines = runner.invoke(app, ["usage"]).output.splitlines()
    assert lines[-3:] == ["Input 10, output 0, cache read 0, cache creation 0", "", FOOTER]


def test_usage_shows_only_the_ten_most_recent_sessions(projects):
    for i in range(12):
        _write_session(projects / "-p", f"s{i:02d}xxxxxx", [_assistant(f"m{i}", inp=1)], age_days=i / 10)
    result = runner.invoke(app, ["usage", "--all"])
    assert result.output.splitlines()[0] == "Token usage for all projects, last 7 days: 12 session(s), showing the 10 most recent"
    assert "s00xxxxx" in result.output and "s09xxxxx" in result.output
    assert "s10xxxxx" not in result.output
    assert NEAR_LIMIT not in result.output


def test_usage_says_when_no_session_falls_inside_the_day_window(projects):
    _write_session(projects / project_folder_name(pathlib.Path.cwd()), "old", [_assistant("m", inp=1)], age_days=3)
    result = runner.invoke(app, ["usage", "--days", "1"])
    assert result.exit_code == 0
    assert result.output.splitlines() == ["No Claude Code sessions with token usage in the last 1 day(s).", FOOTER]


def test_usage_reports_an_unreadable_log_on_stderr_and_counts_the_rest(projects):
    folder = projects / project_folder_name(pathlib.Path.cwd())
    _write_session(folder, "good", [_assistant("m", inp=10)])
    (folder / "broken.jsonl").mkdir()
    result = runner.invoke(app, ["usage"])
    assert result.exit_code == 0
    assert result.stderr.splitlines() == [f"Skipped {folder / 'broken.jsonl'}: could not read it (EISDIR)."]
    assert "1 session(s)" in result.stdout


@pytest.mark.parametrize("value", ["0", "abc", "-3", "1.5"])
def test_usage_rejects_days_that_are_not_a_whole_number_of_1_or_more(projects, value):
    result = runner.invoke(app, ["usage", "--days", value])
    assert result.exit_code == 1
    assert result.stderr.strip() == f'--days must be a whole number of 1 or more (got "{value}").'


def test_usage_json_prints_machine_output_with_camel_case_keys(projects):
    folder = projects / project_folder_name(pathlib.Path.cwd())
    path = _write_session(folder, "abc", FIXTURE)
    result = runner.invoke(app, ["usage", "--json"])
    data = json.loads(result.stdout)
    assert result.stderr.strip() == FOOTER
    assert result.exit_code == 0
    assert list(data["sessions"][0]) == ["id", "file", "mtime", "input", "output", "cacheRead", "cacheCreation", "cacheHitRatio", "peakContext"]
    assert data["sessions"][0]["file"] == str(path)
    assert data["totals"] == {"input": 100, "output": 57, "cacheRead": 1000, "cacheCreation": 200, "cacheHitRatio": 1000 / 1300, "peakContext": 1210}


def test_usage_json_prints_empty_valid_json_when_the_project_has_no_sessions(projects):
    projects.mkdir(parents=True)
    result = runner.invoke(app, ["usage", "--json"])
    assert result.exit_code == 0
    assert "No Claude Code sessions found for this project" in result.stderr
    assert json.loads(result.stdout) == {"sessions": [], "totals": {"input": 0, "output": 0, "cacheRead": 0, "cacheCreation": 0, "cacheHitRatio": 0, "peakContext": 0}}


def test_usage_reads_home_claude_projects_when_claude_config_dir_is_unset(tmp_path, monkeypatch):
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    _write_session(tmp_path / ".claude" / "projects" / "-x", "fromhome", [_assistant("m", inp=1)])
    result = runner.invoke(app, ["usage", "--all", "--json"])
    assert [s["id"] for s in json.loads(result.stdout)["sessions"]] == ["fromhome"]
