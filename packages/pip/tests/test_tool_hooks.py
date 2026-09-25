"""Each tool's hook file must run the exact commands from .claude/settings.json, on that tool's shell and file-read actions."""
import json
import pathlib
import re

TEMPLATES = pathlib.Path(__file__).resolve().parents[3] / "templates"


def _read(rel):
    return json.loads((TEMPLATES / rel).read_text(encoding="utf-8"))


CLAUDE = _read(".claude/settings.json")


def _id(cmd):
    m = re.match(r"^: goodvibes-([a-z-]+);", cmd or "")
    return m.group(1) if m else None


def _command(hook_id):
    return next(h["command"] for g in CLAUDE["hooks"]["PreToolUse"] for h in g["hooks"] if _id(h["command"]) == hook_id)


def _nested(hooks, field="command"):
    return [(event, g["matcher"], _id(h[field])) for event, groups in hooks.items() for g in groups for h in g["hooks"]]


def test_keeps_the_claude_code_matchers_that_cursor_and_the_copilot_cli_map_onto_their_own_shell_and_read_tools_and_sends_grep_through_the_read_guard():
    assert _nested({"PreToolUse": CLAUDE["hooks"]["PreToolUse"]}) == [
        ("PreToolUse", "Bash", "journal-gate"),
        ("PreToolUse", "Read|Bash|Grep", "read-guard"),
    ]


def test_gives_devin_cli_both_checks_on_exec_and_the_read_guard_on_read_and_grep_in_a_hooks_file_without_a_wrapper():
    assert _nested(_read(".devin/hooks.v1.json")) == [
        ("PreToolUse", "^exec$", "journal-gate"),
        ("PreToolUse", "^(read|exec|grep)$", "read-guard"),
    ]


def test_gives_codex_cli_both_checks_on_its_bash_tool_in_codex_hooks_json():
    f = _read(".codex/hooks.json")
    assert list(f) == ["hooks"]
    assert _nested(f["hooks"]) == [("PreToolUse", "Bash", "journal-gate"), ("PreToolUse", "Bash", "read-guard")]


def test_gives_gemini_cli_both_checks_on_run_shell_command_and_the_read_guard_on_read_file_read_many_files_and_grep_search():
    assert _nested(_read(".gemini/settings.json")["hooks"]) == [
        ("BeforeTool", "^run_shell_command$", "journal-gate"),
        ("BeforeTool", "^(run_shell_command|read_file|read_many_files|grep_search)$", "read-guard"),
    ]


def test_gives_the_copilot_cloud_agent_and_vs_code_both_checks_as_bash_commands_only():
    f = _read(".github/hooks/goodvibes.json")
    assert f["version"] == 1
    assert _nested(f["hooks"], "bash") == [("PreToolUse", "Bash", "journal-gate"), ("PreToolUse", "Read|Bash|Grep", "read-guard")]
    assert all("command" not in h and "powershell" not in h for g in f["hooks"]["PreToolUse"] for h in g["hooks"])


def test_gives_windsurf_both_checks_before_a_command_and_the_read_guard_before_a_file_read():
    f = _read(".windsurf/hooks.json")
    assert [(event, _id(h["command"])) for event, hooks in f["hooks"].items() for h in hooks] == [
        ("pre_run_command", "journal-gate"),
        ("pre_run_command", "read-guard"),
        ("pre_read_code", "read-guard"),
    ]


def test_gives_kiro_both_checks_on_shell_and_the_read_guard_on_read():
    f = _read(".kiro/hooks/goodvibes.json")
    assert f["version"] == "v1"
    assert [(h["trigger"], h["matcher"], h["action"]["type"], _id(h["action"]["command"])) for h in f["hooks"]] == [
        ("PreToolUse", "shell", "command", "journal-gate"),
        ("PreToolUse", "shell", "command", "read-guard"),
        ("PreToolUse", "read", "command", "read-guard"),
    ]


def test_runs_the_exact_claude_settings_command_in_every_file_so_the_checks_cannot_drift_apart():
    commands = [
        *(h["command"] for g in _read(".devin/hooks.v1.json")["PreToolUse"] for h in g["hooks"]),
        *(h["command"] for g in _read(".codex/hooks.json")["hooks"]["PreToolUse"] for h in g["hooks"]),
        *(h["command"] for g in _read(".gemini/settings.json")["hooks"]["BeforeTool"] for h in g["hooks"]),
        *(h["bash"] for g in _read(".github/hooks/goodvibes.json")["hooks"]["PreToolUse"] for h in g["hooks"]),
        *(h["command"] for hs in _read(".windsurf/hooks.json")["hooks"].values() for h in hs),
        *(h["action"]["command"] for h in _read(".kiro/hooks/goodvibes.json")["hooks"]),
    ]
    assert len(commands) == 14
    for cmd in commands:
        assert cmd == _command(_id(cmd))
