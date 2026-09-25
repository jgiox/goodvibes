"""Unit tests for doctor_cmd — VCC-02 Python parity test coverage."""
from __future__ import annotations

import importlib.metadata
import json
import pathlib
import subprocess
from unittest.mock import MagicMock, patch

import pytest
import typer
from typer.testing import CliRunner

from goodvibes_cli.commands.doctor_cmd import (
    SYMBOLS,
    CheckResult,
    _check_claude_md,
    _check_git_config,
    _check_goodvibes_cli,
    _check_headroom,
    _check_journal,
    _check_mcp,
    claude_json_path,
    server_problems,
    _check_sentinel,
    doctor_cmd,
    summary_line,
)

runner = CliRunner()


def test_check_headroom_returns_pass_when_headroom_working(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(
            args=["headroom", "--version"], returncode=0, stdout="", stderr=""
        ),
    )
    result = _check_headroom()
    assert result.status == "ok"
    assert result.label == "headroom installed and working"


def test_check_headroom_warns_as_optional_when_headroom_not_found(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=FileNotFoundError("headroom not found"),
    )
    result = _check_headroom()
    assert result.status == "warn"
    assert result.label == "headroom not installed (optional: compresses what Claude reads)"
    assert "uv tool install" in result.remedy


def test_check_headroom_warns_when_headroom_broken(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["headroom", "--version"]),
    )
    result = _check_headroom()
    assert result.status == "warn"
    assert "optional: compresses what Claude reads" in result.label


def test_check_headroom_warns_when_headroom_times_out(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=["headroom", "--version"], timeout=10),
    )
    result = _check_headroom()
    assert result.status == "warn"


def test_check_goodvibes_cli_is_ok_when_goodvibes_is_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value="/usr/local/bin/goodvibes")
    assert _check_goodvibes_cli() == CheckResult(label="goodvibes command on PATH", status="ok")


def test_check_goodvibes_cli_looks_goodvibes_up_on_path_only_never_in_the_project_folder(mocker):
    which = mocker.patch("goodvibes_cli.commands.doctor_cmd.which", return_value="/usr/local/bin/goodvibes")
    assert _check_goodvibes_cli().status == "ok"
    which.assert_called_once_with("goodvibes")


def test_check_goodvibes_cli_warns_when_goodvibes_is_not_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value=None)
    result = _check_goodvibes_cli()
    assert result.status == "warn"
    assert result.label == "goodvibes command not on PATH"
    assert result.remedy == "Optional: lets the session-start check run. Install: uv tool install goodvibes-cli (or: npm install -g goodvibes-cli)"


def test_check_git_config_fails_when_git_is_missing(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", side_effect=FileNotFoundError("git"))
    assert _check_git_config("user.email").status == "fail"


def test_summary_line_says_ready_when_every_check_is_ok_or_skip():
    assert summary_line([CheckResult("a", "ok"), CheckResult("b", "skip")]) == "Ready."


def test_summary_line_counts_warnings_when_nothing_fails():
    assert summary_line([CheckResult("a", "ok"), CheckResult("b", "warn"), CheckResult("c", "warn")]) == "Ready, with 2 warning(s)."


def test_summary_line_counts_problems_when_any_check_fails():
    assert summary_line([CheckResult("a", "fail"), CheckResult("b", "warn"), CheckResult("c", "fail")]) == "Not ready: 2 problem(s)."


def test_symbols_render_each_status():
    assert SYMBOLS == {"ok": "✓", "warn": "!", "fail": "✗", "skip": "-"}


def test_check_git_config_returns_pass_when_name_set(mocker):
    mock_result = MagicMock()
    mock_result.stdout = "Jane Doe"
    mock_result.returncode = 0
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=mock_result)
    result = _check_git_config("user.name")
    assert result.status == "ok"


def test_check_git_config_returns_fail_with_remedy_when_not_set(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["git", "config", "user.name"]),
    )
    result = _check_git_config("user.name")
    assert result.status == "fail"
    assert "git config --global user.name" in result.remedy


def test_check_claude_md_returns_pass_when_file_exists(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("# goodvibes")
    assert _check_claude_md(tmp_path).status == "ok"


def test_check_claude_md_returns_fail_when_file_absent(tmp_path):
    assert _check_claude_md(tmp_path).status == "fail"


def test_check_sentinel_returns_pass_when_both_markers_present(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->")
    assert _check_sentinel(tmp_path).status == "ok"


def test_check_sentinel_returns_fail_when_sentinel_missing(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("# just a header, no sentinel")
    assert _check_sentinel(tmp_path).status == "fail"


def _mock_checks(mocker, tmp_path, headroom="ok", git=("ok", "ok")):
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult(label="headroom check", status=headroom, remedy="Run: uv tool install headroom"))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", side_effect=[
        CheckResult(label="git user.name", status=git[0], remedy='Run: git config --global user.name "Your Value"'),
        CheckResult(label="git user.email", status=git[1], remedy='Run: git config --global user.email "Your Value"'),
    ])
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_claude_md", return_value=CheckResult(label="CLAUDE.md present", status="ok"))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_sentinel", return_value=CheckResult(label="goodvibes sentinel block", status="ok"))
    mocker.patch("goodvibes_cli.commands.doctor_cmd.pathlib.Path.cwd", return_value=tmp_path)


@pytest.fixture(autouse=True)
def _goodvibes_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value="/usr/local/bin/goodvibes")


def test_doctor_cmd_raises_exit_1_when_any_check_fails(mocker, tmp_path):
    _mock_checks(mocker, tmp_path, git=("fail", "ok"))
    with pytest.raises(typer.Exit) as exc:
        doctor_cmd()
    assert exc.value.exit_code == 1


def test_doctor_cmd_does_not_raise_when_all_checks_pass(mocker, tmp_path):
    _mock_checks(mocker, tmp_path)
    doctor_cmd()


def test_doctor_exits_0_and_counts_warnings_when_only_optional_parts_are_missing(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path, headroom="warn")
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value=None)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 0
    assert "! headroom check" in result.output
    assert "! goodvibes command not on PATH" in result.output
    assert result.output.rstrip().splitlines()[-1] == "Ready, with 2 warning(s)."


def test_doctor_ends_with_ready_when_every_check_is_ok(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 0
    assert result.output.rstrip().splitlines()[-1] == "Ready."


def test_doctor_collects_all_failures_and_ends_with_not_ready(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path, headroom="warn", git=("fail", "fail"))
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 1
    assert "✗ git user.name" in result.output
    assert "✗ git user.email" in result.output
    assert "! headroom check" in result.output
    assert result.output.rstrip().splitlines()[-1] == "Not ready: 2 problem(s)."


def test_doctor_output_starts_with_version_line(mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.importlib.metadata.version", return_value="1.6.2")
    _mock_checks(mocker, tmp_path)
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor"])
    assert "goodvibes v1.6.2" in result.output


def test_doctor_quick_prints_warnings_and_failures_and_exits_0(mocker, tmp_path):
    from goodvibes_cli.main import app
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", side_effect=[
        CheckResult(label="git user.name", status="fail", remedy="Fix name"),
        CheckResult(label="git user.email", status="warn", remedy="Fix email"),
    ])
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == [
        "goodvibes doctor: ✗ git user.name. Fix name",
        "goodvibes doctor: ! git user.email. Fix email",
    ]


def test_doctor_quick_prints_nothing_and_skips_headroom_when_all_quick_checks_pass(mocker, tmp_path):
    (tmp_path / "CLAUDE.md").write_text("<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->\n", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    run = mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output == ""
    assert all(c.args[0][0] != "headroom" for c in run.call_args_list)


def test_doctor_quick_is_silent_about_claude_md_outside_a_goodvibes_project(mocker, tmp_path):
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output == ""


def test_doctor_quick_checks_claude_config_rules_in_a_global_scope_project(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text('{"version": "1.8.0", "files": {}, "scope": "global"}', encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == ["goodvibes doctor: ✗ goodvibes rules in Claude config. Run: goodvibes init"]


def test_doctor_quick_prints_one_line_per_failure_and_exits_0(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text('{"version": "1.8.0", "files": {}, "scope": "project"}', encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == [
        "goodvibes doctor: ✗ CLAUDE.md present. Run: goodvibes init",
        "goodvibes doctor: ✗ goodvibes sentinel block. Run: goodvibes init",
    ]


def test_doctor_exits_1_and_names_the_broken_goodvibes_json(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    (tmp_path / "CLAUDE.md").write_text("<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->\n", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor"])
    out = " ".join(result.output.split())
    assert result.exit_code == 1
    assert "is not valid JSON" in out


def test_doctor_quick_reports_a_broken_goodvibes_json_and_still_exits_0(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert "is not valid JSON" in result.output


def test_check_sentinel_does_not_crash_on_a_claude_md_that_is_not_utf_8(tmp_path):
    (tmp_path / "CLAUDE.md").write_bytes(b"\xff\xfe<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->\n")
    assert _check_sentinel(tmp_path).status == "ok"


def test_doctor_quick_exits_0_on_a_claude_md_that_is_not_utf_8(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text('{"version": "1.8.0", "files": {}}', encoding="utf-8")
    (tmp_path / "CLAUDE.md").write_bytes(b"\xff\xfe no block here\n")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""))
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == ["goodvibes doctor: ✗ goodvibes sentinel block. Run: goodvibes init (will merge sentinel block)"]


def test_doctor_quick_reports_a_check_that_crashes_as_one_line_and_still_exits_0(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text('{"version": "1.8.0", "files": {}}', encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_sentinel", side_effect=PermissionError(13, "Permission denied", "CLAUDE.md"))
    from goodvibes_cli.main import app
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == ["goodvibes doctor: ✗ Could not finish the checks (EACCES). Run: goodvibes doctor"]


@pytest.mark.parametrize("args", [["doctor"], ["doctor", "--quick"]])
def test_doctor_prints_an_escape_code_from_a_broken_goodvibes_json_message_as_a_question_mark(mocker, tmp_path, args):
    project = tmp_path / "evil\x1b[2Jrepo"
    project.mkdir()
    (project / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=project)
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""))
    from goodvibes_cli.main import app
    result = runner.invoke(app, args)
    assert "\x1b" not in result.output
    assert "evil?[2Jrepo" in "".join(result.output.split())


def test_doctor_prints_square_brackets_literally_instead_of_as_rich_markup(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult("headroom [bold]x[/bold]", "warn", 'Run: uv tool install "headroom-ai[all]"'))
    result = runner.invoke(app, ["doctor"])
    assert "headroom-ai[all]" in result.output
    assert "[bold]x[/bold]" in result.output


JOURNAL_HINT = 'Keep lasting decisions in its "Standing decisions" section and keep new entries short.'


def test_check_journal_warns_when_journal_is_larger_than_10_kb_and_leaves_it_unchanged(tmp_path):
    journal = tmp_path / "JOURNAL.md"
    journal.write_bytes(b"x" * 12 * 1024)
    assert _check_journal(tmp_path) == [CheckResult("JOURNAL.md is 12 KB; agents read it every session", "warn", JOURNAL_HINT)]
    assert journal.read_bytes() == b"x" * 12 * 1024


def test_check_journal_rounds_a_partial_kilobyte_up(tmp_path):
    (tmp_path / "JOURNAL.md").write_bytes(b"x" * (10 * 1024 + 1))
    assert _check_journal(tmp_path)[0].label.startswith("JOURNAL.md is 11 KB;")


def test_check_journal_reports_nothing_at_exactly_10_kb(tmp_path):
    (tmp_path / "JOURNAL.md").write_bytes(b"x" * 10 * 1024)
    assert _check_journal(tmp_path) == []


def test_check_journal_reports_nothing_when_there_is_no_journal(tmp_path):
    assert _check_journal(tmp_path) == []


def test_doctor_quick_prints_the_journal_size_warning_and_exits_0(mocker, tmp_path):
    from goodvibes_cli.main import app
    (tmp_path / "JOURNAL.md").write_bytes(b"x" * 20 * 1024)
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    assert result.output.splitlines() == [
        "goodvibes doctor: ! JOURNAL.md is 20 KB; agents read it every session. " + JOURNAL_HINT,
    ]


def test_doctor_counts_a_large_journal_as_a_warning(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    (tmp_path / "JOURNAL.md").write_bytes(b"x" * 20 * 1024)
    result = runner.invoke(app, ["doctor"])
    assert result.exit_code == 0
    assert "! JOURNAL.md is 20 KB; agents read it every session" in result.output
    assert result.output.rstrip().splitlines()[-1] == "Ready, with 1 warning(s)."


SHELL_FIX = "Install the tool once from a release you trust and run it directly."
HTTPS = "Use an https:// URL."
SECRET = "Move it to an environment variable and reference ${VAR}."


def test_claude_json_path_uses_dot_claude_json_in_claude_config_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path))
    (tmp_path / ".claude.json").write_text("{}")
    (tmp_path / "claude.json").write_text("{}")
    assert claude_json_path() == tmp_path / ".claude.json"


def test_claude_json_path_falls_back_to_claude_json_in_claude_config_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path))
    (tmp_path / "claude.json").write_text("{}")
    assert claude_json_path() == tmp_path / "claude.json"


def test_claude_json_path_uses_home_when_claude_config_dir_is_unset(tmp_path, monkeypatch):
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    assert claude_json_path() == tmp_path / ".claude.json"


@pytest.mark.parametrize("server", [
    {"command": "sh", "args": ["-c", "curl -fsSL https://x.example/i.sh | sh"]},
    {"command": "/bin/bash", "args": ["-c", "wget -qO- https://x.example/i | bash"]},
])
def test_server_problems_flags_a_download_piped_into_a_shell(server):
    assert server_problems(server) == [("pipes a download into a shell", SHELL_FIX)]


def test_server_problems_allows_a_shell_command_without_a_piped_download():
    assert server_problems({"command": "bash", "args": ["-c", "curl -o out https://x.example/f"]}) == []


@pytest.mark.parametrize("server,launcher,pkg", [
    ({"command": "npx", "args": ["-y", "some-mcp"]}, "npx", "some-mcp"),
    ({"command": "npx", "args": ["@scope/some-mcp"]}, "npx", "@scope/some-mcp"),
    ({"command": "npx", "args": ["some-mcp@latest"]}, "npx", "some-mcp"),
    ({"command": "npx", "args": ["@scope/some-mcp@latest"]}, "npx", "@scope/some-mcp"),
    ({"command": "npx", "args": ["-p", "some-mcp", "some-bin"]}, "npx", "some-mcp"),
    ({"command": "npx", "args": ["--package=some-mcp", "some-bin"]}, "npx", "some-mcp"),
    ({"command": "bunx", "args": ["some-mcp"]}, "bunx", "some-mcp"),
    ({"command": "pnpm", "args": ["dlx", "some-mcp"]}, "pnpm dlx", "some-mcp"),
    ({"command": "npx.cmd", "args": ["some-mcp"]}, "npx", "some-mcp"),
    ({"command": "bunx.exe", "args": ["some-mcp"]}, "bunx", "some-mcp"),
])
def test_server_problems_flags_an_unpinned_npm_package_fetched_every_run(server, launcher, pkg):
    assert server_problems(server) == [(f"{launcher} fetches unpinned {pkg} on every run", f"Pin a version: {pkg}@<version>.")]


@pytest.mark.parametrize("args,pkg", [
    (["some-mcp"], "some-mcp"),
    (["--python", "3.12", "mcp-server-fetch"], "mcp-server-fetch"),
    (["-p", "3.12", "--with", "extra", "--index-url", "https://pypi.example/simple", "some-mcp"], "some-mcp"),
    (["--from", "some-mcp", "some-bin"], "some-mcp"),
    (["--from=some-mcp", "some-bin"], "some-mcp"),
    (["some-mcp@latest"], "some-mcp"),
])
def test_server_problems_flags_an_unpinned_uvx_package_fetched_every_run(args, pkg):
    assert server_problems({"command": "uvx", "args": args}) == [(f"uvx fetches unpinned {pkg} on every run", f"Pin a version: {pkg}==<version>.")]


@pytest.mark.parametrize("server", [
    {"command": "npx", "args": ["-y", "some-mcp@1.2.3"]},
    {"command": "npx", "args": ["@scope/some-mcp@1.2.3"]},
    {"command": "pnpm", "args": ["dlx", "some-mcp@1.2.3"]},
    {"command": "uvx", "args": ["some-mcp==1.2.3"]},
    {"command": "uvx", "args": ["some-mcp@1.2.3"]},
    {"command": "uvx", "args": ["--python", "3.12", "--from", "some-mcp==1.2.3", "some-bin"]},
    {"command": "pnpm", "args": ["install"]},
    {"command": "node", "args": ["server.js"]},
    {"command": "/usr/local/bin/npx", "args": ["some-mcp"]},
    {"command": "./npx", "args": ["some-mcp"]},
    {"command": "tools\\npx.cmd", "args": ["some-mcp"]},
])
def test_server_problems_allows_pinned_packages_and_non_launchers(server):
    assert server_problems(server) == []


def test_server_problems_flags_plain_http_to_a_remote_host():
    assert server_problems({"type": "http", "url": "http://mcp.example.com/mcp"}) == [("uses plain http to mcp.example.com", HTTPS)]


@pytest.mark.parametrize("url", ["http://localhost:3000/mcp", "http://127.0.0.1/mcp", "http://[::1]:8080/mcp", "https://mcp.example.com/mcp"])
def test_server_problems_allows_https_and_loopback_http(url):
    assert server_problems({"url": url}) == []


def test_server_problems_flags_literal_secrets_by_key_name_only():
    server = {
        "command": "node",
        "env": {"GITHUB_TOKEN": "ghp_0123456789abcdefghij", "API_KEY": "${API_KEY}", "DEBUG_LEVEL": "a-very-long-but-harmless-value"},
        "headers": {"Authorization": "Bearer abcdefghijklmnopqrstuv", "X-Api-Key": "short"},
    }
    assert server_problems(server) == [
        ("literal secret in env.GITHUB_TOKEN", SECRET),
        ("literal secret in headers.Authorization", SECRET),
    ]


def test_server_problems_allows_a_header_that_references_a_variable():
    assert server_problems({"url": "https://x.example", "headers": {"Authorization": "Bearer ${EXAMPLE_TOKEN}"}}) == []


def _write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_check_mcp_reports_user_local_and_project_servers(tmp_path, monkeypatch):
    cfg = tmp_path / "cfg"
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(cfg))
    project = tmp_path / "proj"
    project.mkdir()
    _write_json(cfg / ".claude.json", {
        "mcpServers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp"}},
        "projects": {str(project): {"mcpServers": {"db": {"command": "uvx", "args": ["db-mcp"]}}}, "/other": {"mcpServers": {"x": {"command": "node"}}}},
    })
    _write_json(project / ".mcp.json", {"mcpServers": {"web": {"url": "http://mcp.example.com"}}})
    assert _check_mcp(project) == [
        CheckResult("MCP context7 (user)", "ok"),
        CheckResult("MCP db (local): uvx fetches unpinned db-mcp on every run", "warn", "Pin a version: db-mcp==<version>."),
        CheckResult("MCP web (project): uses plain http to mcp.example.com", "warn", HTTPS),
    ]


def test_check_mcp_reads_home_claude_json_when_claude_config_dir_is_unset(tmp_path, monkeypatch):
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    _write_json(tmp_path / ".claude.json", {"mcpServers": {"a": {"command": "node"}}})
    assert _check_mcp(tmp_path / "nowhere") == [CheckResult("MCP a (user)", "ok")]


def test_check_mcp_replaces_terminal_control_characters_from_a_cloned_repos_mcp_json(tmp_path):
    _write_json(tmp_path / ".mcp.json", {"mcpServers": {"evil\u001b[2J\u009bname": {"command": "npx", "args": ["pkg\u0007"]}}})
    assert _check_mcp(tmp_path) == [
        CheckResult("MCP evil?[2J?name (project): npx fetches unpinned pkg? on every run", "warn", "Pin a version: pkg?@<version>."),
    ]


def test_check_mcp_is_silent_when_no_config_files_exist(tmp_path):
    assert _check_mcp(tmp_path) == []


def test_check_mcp_warns_once_naming_a_file_that_is_not_valid_json(tmp_path):
    (tmp_path / ".mcp.json").write_text("{ nope", encoding="utf-8")
    assert _check_mcp(tmp_path) == [CheckResult(f"{tmp_path / '.mcp.json'} is not valid JSON; its MCP servers were not checked", "warn")]


def test_check_mcp_warns_with_the_error_code_when_a_config_file_cannot_be_read(tmp_path):
    (tmp_path / ".mcp.json").mkdir()
    assert _check_mcp(tmp_path) == [CheckResult(f"{tmp_path / '.mcp.json'} could not be read (EISDIR); its MCP servers were not checked", "warn")]


def test_check_mcp_lists_each_file_warning_in_its_own_scope_position(tmp_path, monkeypatch):
    cfg = tmp_path / "cfg"
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(cfg))
    cfg.mkdir()
    (cfg / ".claude.json").write_text("{ nope", encoding="utf-8")
    _write_json(tmp_path / ".mcp.json", {"mcpServers": {"a": {"command": "node"}}})
    assert [r.label for r in _check_mcp(tmp_path)] == [f"{cfg / '.claude.json'} is not valid JSON; its MCP servers were not checked", "MCP a (project)"]


def test_doctor_lists_mcp_servers_and_never_prints_secret_values(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    _write_json(tmp_path / ".mcp.json", {"mcpServers": {"gh": {"command": "node", "env": {"GITHUB_TOKEN": "ghp_supersecretvalue123456"}}}})
    result = runner.invoke(app, ["doctor"])
    out = " ".join(result.output.split())
    assert "! MCP gh (project): literal secret in env.GITHUB_TOKEN" in out
    assert "ghp_supersecretvalue123456" not in result.output
    assert result.exit_code == 0


def test_doctor_quick_skips_the_mcp_check(mocker, tmp_path):
    from goodvibes_cli.main import app
    _write_json(tmp_path / ".mcp.json", {"mcpServers": {"x": {"command": "npx", "args": ["some-mcp"]}}})
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="value", stderr=""),
    )
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.output == ""


def test_doctor_how_to_fix_lines_join_label_and_remedy_with_a_colon(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path, headroom="warn")
    result = runner.invoke(app, ["doctor"])
    assert "headroom check: Run: uv tool install headroom" in result.output
    assert "—" not in result.output


def test_doctor_quick_adds_a_period_only_when_the_label_lacks_one_and_the_remedy_only_when_present(mocker, tmp_path):
    from goodvibes_cli.main import app
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", side_effect=[
        CheckResult(label="name missing.", status="fail", remedy="Fix it"),
        CheckResult(label="email missing", status="warn"),
    ])
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.output.splitlines() == [
        "goodvibes doctor: ✗ name missing. Fix it",
        "goodvibes doctor: ! email missing.",
    ]


def test_doctor_quick_never_runs_the_path_check(mocker, tmp_path):
    from goodvibes_cli.main import app
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="v", stderr=""))
    which = mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value=None)
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.output == ""
    which.assert_not_called()


def test_doctor_lists_a_broken_manifest_before_every_other_check(mocker, tmp_path):
    from goodvibes_cli.main import app
    (tmp_path / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    mocker.patch("goodvibes_cli.commands.doctor_cmd.pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult("headroom check", "ok"))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", return_value=CheckResult("git check", "fail", "Fix git"))
    full = [l.strip("│ ") for l in runner.invoke(app, ["doctor"]).output.splitlines()]
    checks = [l for l in full if l[:2] in ("✓ ", "! ", "✗ ", "- ")]
    assert checks[0].startswith("✗ .goodvibes.json")
    assert checks[1] == "✓ headroom check"
    quick = runner.invoke(app, ["doctor", "--quick"]).output.splitlines()
    assert quick[0].startswith("goodvibes doctor: ✗ .goodvibes.json")
    assert quick[1] == "goodvibes doctor: ✗ git check. Fix git"


_PACKAGED_HOOK = (pathlib.Path(__file__).resolve().parents[3] / "hooks" / "pre-commit").read_bytes()


@pytest.fixture
def hook_repo(tmp_path, git_env):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True, capture_output=True)
    (repo / "JOURNAL.md").write_text("# J\n")
    return repo


def _hook_file(repo):
    return repo / ".git" / "hooks" / "pre-commit"


def _snapshot(repo):
    return sorted((str(p), p.read_bytes() if p.is_file() and not p.is_symlink() else None) for p in repo.rglob("*"))


def test_check_git_hook_is_ok_when_the_hook_matches_the_package(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    _hook_file(hook_repo).write_bytes(_PACKAGED_HOOK)
    before = _snapshot(hook_repo)
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check installed", "ok")]
    assert _snapshot(hook_repo) == before


def test_check_git_hook_warns_when_the_goodvibes_hook_is_out_of_date(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    _hook_file(hook_repo).write_text("# goodvibes-pre-commit: old\n")
    before = _snapshot(hook_repo)
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check out of date", "warn", "Run: goodvibes update")]
    assert _snapshot(hook_repo) == before


def test_check_git_hook_skips_as_turned_off_when_the_user_removed_it(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    (hook_repo / ".goodvibes.json").write_text(json.dumps({"version": "1.9.1", "files": {}, "gitHook": "user-removed"}))
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check turned off", "skip")]
    assert not _hook_file(hook_repo).exists()


def test_check_git_hook_warns_when_the_hook_is_not_installed(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check not installed", "warn", "Run: goodvibes update")]
    assert not _hook_file(hook_repo).exists()


def test_check_git_hook_skips_when_core_hookspath_is_set(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    subprocess.run(["git", "config", "core.hooksPath", "elsewhere"], cwd=hook_repo, check=True)
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check not managed (core.hooksPath is set)", "skip")]


def test_check_git_hook_skips_a_pre_commit_hook_that_is_not_from_goodvibes(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    _hook_file(hook_repo).write_text("#!/bin/sh\necho mine\n")
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check not managed (your own pre-commit hook)", "skip")]
    assert _hook_file(hook_repo).read_text() == "#!/bin/sh\necho mine\n"


def test_check_git_hook_skips_when_git_hooks_is_a_link(hook_repo, tmp_path):
    import shutil
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    outside = tmp_path / "external"
    outside.mkdir()
    shutil.rmtree(hook_repo / ".git" / "hooks")
    (hook_repo / ".git" / "hooks").symlink_to(outside)
    assert _check_git_hook(hook_repo) == [CheckResult("Git commit check not managed (.git/hooks is a link or outside the git folder)", "skip")]


def test_check_git_hook_reports_nothing_without_a_journal(hook_repo):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    (hook_repo / "JOURNAL.md").unlink()
    assert _check_git_hook(hook_repo) == []


def test_check_git_hook_reports_nothing_outside_a_git_repo(tmp_path, git_env):
    from goodvibes_cli.commands.doctor_cmd import _check_git_hook
    (tmp_path / "plain").mkdir()
    (tmp_path / "plain" / "JOURNAL.md").write_text("# J\n")
    assert _check_git_hook(tmp_path / "plain") == []


def test_doctor_lists_the_git_hook_check_after_the_journal_size_and_before_mcp(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_journal", return_value=[CheckResult("journal size", "ok")])
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_hook", return_value=[CheckResult("Git commit check installed", "ok")])
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_mcp", return_value=[CheckResult("MCP x (user)", "ok")])
    lines = runner.invoke(app, ["doctor"]).output
    assert lines.index("journal size") < lines.index("✓ Git commit check installed") < lines.index("MCP x (user)")


def test_doctor_quick_never_runs_the_git_hook_check(mocker, tmp_path):
    from goodvibes_cli.main import app
    _mock_checks(mocker, tmp_path)
    check = mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_hook", return_value=[])
    result = runner.invoke(app, ["doctor", "--quick"])
    assert result.exit_code == 0
    check.assert_not_called()


def test_doctor_runs_headroom_and_git_without_searching_the_project_folder_for_them(mocker):
    run = mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=subprocess.CompletedProcess(args=[], returncode=0, stdout="x", stderr=""))
    _check_headroom()
    _check_git_config("user.name")
    assert [c.args[0][0] for c in run.call_args_list] == ["headroom", "git"]
    assert all(c.kwargs["env"]["NoDefaultCurrentDirectoryInExePath"] == "1" for c in run.call_args_list)
