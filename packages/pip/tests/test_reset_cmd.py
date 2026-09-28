"""Tests for reset_cmd: real template files in a temporary project and Claude Code settings folder."""
import hashlib
import json
import pathlib
import re

import pytest
from typer.testing import CliRunner

from goodvibes_cli.commands.reset_cmd import backup
from goodvibes_cli.main import app
from goodvibes_cli.steps.copy_templates import resolve_templates_dir
from goodvibes_cli.steps.global_setup import apply_global_config, claude_config_dir
from goodvibes_cli.steps.write_manifest import USER_OWNED, USER_REMOVED

runner = CliRunner()
_ANSI = re.compile(r'\x1b\[[0-9;]*m|[│╭╮╰╯─]')
TPL = resolve_templates_dir()
GATE = ": goodvibes-journal-gate;"


def _out(result) -> str:
    return " ".join(_ANSI.sub("", result.output).split())


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _manifest(root: pathlib.Path) -> dict:
    return json.loads((root / ".goodvibes.json").read_text(encoding="utf-8"))


@pytest.fixture
def project(tmp_path, monkeypatch):
    """A project set up in project scope with AGENTS.md, a docs file, CLAUDE.md and .claude/settings.json, all as goodvibes wrote them."""
    root = tmp_path / "project"
    files = {}
    for rel in ("AGENTS.md", "docs/onboarding.md", "CLAUDE.md", ".claude/settings.json"):
        data = (TPL / rel).read_bytes()
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_bytes(data)
        files[rel] = _sha(data)
    tpl = json.loads((TPL / ".claude/settings.json").read_text(encoding="utf-8"))
    managed = {".claude/settings.json": [*(f"ask:{p}" for p in tpl["permissions"]["ask"]), *(f"deny:{p}" for p in tpl["permissions"]["deny"])]}
    (root / ".goodvibes.json").write_text(json.dumps({"version": "1.11.1", "scope": "project", "files": files, "managed": managed}), encoding="utf-8")
    monkeypatch.chdir(root)
    return root


def test_backup_uses_a_new_name_when_an_earlier_backup_exists(tmp_path):
    f = tmp_path / "AGENTS.md"
    f.write_text("second\n", encoding="utf-8")
    (tmp_path / "AGENTS.md.goodvibes-backup").write_text("first\n", encoding="utf-8")

    made = backup(f)

    assert made == tmp_path / "AGENTS.md.goodvibes-backup-2"
    assert made.read_text(encoding="utf-8") == "second\n"
    assert (tmp_path / "AGENTS.md.goodvibes-backup").read_text(encoding="utf-8") == "first\n"


def test_reset_puts_back_goodvibes_version_of_an_edited_file_and_keeps_a_backup(project):
    (project / "AGENTS.md").write_text("mine\n", encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    assert (project / "AGENTS.md").read_bytes() == (TPL / "AGENTS.md").read_bytes()
    assert (project / "AGENTS.md.goodvibes-backup").read_text(encoding="utf-8") == "mine\n"
    assert "AGENTS.md: reset to goodvibes' version; your copy is in AGENTS.md.goodvibes-backup" in _out(result)
    assert _manifest(project)["files"]["AGENTS.md"] == _sha((TPL / "AGENTS.md").read_bytes())


def test_reset_restores_a_file_the_user_deleted(project):
    (project / "docs" / "onboarding.md").unlink()
    m = _manifest(project)
    m["files"]["docs/onboarding.md"] = USER_REMOVED
    (project / ".goodvibes.json").write_text(json.dumps(m), encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    assert (project / "docs" / "onboarding.md").read_bytes() == (TPL / "docs/onboarding.md").read_bytes()
    assert "docs/onboarding.md: restored goodvibes' version" in _out(result)
    assert _manifest(project)["files"]["docs/onboarding.md"] == _sha((TPL / "docs/onboarding.md").read_bytes())


def test_reset_dry_run_lists_the_plan_and_writes_nothing(project):
    (project / "AGENTS.md").write_text("mine\n", encoding="utf-8")
    (project / "docs" / "onboarding.md").unlink()
    before = (project / ".goodvibes.json").read_text(encoding="utf-8")

    result = runner.invoke(app, ["reset", "--dry-run"])

    assert result.exit_code == 0, result.output
    out = _out(result)
    assert "Will replace with goodvibes' version (1): AGENTS.md" in out
    assert "Will restore, deleted (1): docs/onboarding.md" in out
    assert "Each changed file is copied to <file>.goodvibes-backup first." in out
    assert "Run without --dry-run to reset these files." in out
    assert (project / "AGENTS.md").read_text(encoding="utf-8") == "mine\n"
    assert not (project / "docs" / "onboarding.md").exists()
    assert not (project / "AGENTS.md.goodvibes-backup").exists()
    assert (project / ".goodvibes.json").read_text(encoding="utf-8") == before


def test_reset_only_touches_the_files_named(project):
    (project / "AGENTS.md").write_text("mine\n", encoding="utf-8")
    (project / "docs" / "onboarding.md").write_text("my notes\n", encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes", "docs/onboarding.md"])

    assert result.exit_code == 0, result.output
    assert (project / "docs" / "onboarding.md").read_bytes() == (TPL / "docs/onboarding.md").read_bytes()
    assert (project / "AGENTS.md").read_text(encoding="utf-8") == "mine\n"
    assert _manifest(project)["files"]["AGENTS.md"] == _sha((TPL / "AGENTS.md").read_bytes())


def test_reset_leaves_a_file_goodvibes_never_wrote_alone_unless_it_is_named(project):
    (project / "AGENTS.md").write_text("my own agents file\n", encoding="utf-8")
    m = _manifest(project)
    m["files"]["AGENTS.md"] = USER_OWNED
    (project / ".goodvibes.json").write_text(json.dumps(m), encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    assert (project / "AGENTS.md").read_text(encoding="utf-8") == "my own agents file\n"
    assert "Nothing to reset: everything goodvibes manages here already matches goodvibes' version." in _out(result)

    named = runner.invoke(app, ["reset", "--yes", "AGENTS.md"])

    assert named.exit_code == 0, named.output
    assert (project / "AGENTS.md").read_bytes() == (TPL / "AGENTS.md").read_bytes()
    assert (project / "AGENTS.md.goodvibes-backup").read_text(encoding="utf-8") == "my own agents file\n"


def test_reset_refuses_a_file_goodvibes_does_not_manage_and_changes_nothing(project):
    (project / "AGENTS.md").write_text("mine\n", encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes", "AGENTS.md", "src/app.py"])

    assert result.exit_code == 1
    assert "src/app.py: goodvibes does not manage this file here, so reset cannot restore it. Nothing was changed." in _out(result)
    assert (project / "AGENTS.md").read_text(encoding="utf-8") == "mine\n"


def test_reset_asks_first_and_changes_nothing_when_the_answer_is_no(project):
    (project / "AGENTS.md").write_text("mine\n", encoding="utf-8")

    result = runner.invoke(app, ["reset"], input="n\n")

    assert result.exit_code == 0, result.output
    out = _out(result)
    assert "Reset 1 file(s) to goodvibes' version? Your copies are backed up first." in out
    assert "Reset cancelled. Nothing was changed." in out
    assert (project / "AGENTS.md").read_text(encoding="utf-8") == "mine\n"
    assert not (project / "AGENTS.md.goodvibes-backup").exists()


def test_reset_says_so_when_there_is_nothing_to_reset(project):
    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    assert "Nothing to reset: everything goodvibes manages here already matches goodvibes' version." in _out(result)
    assert not list(project.rglob("*.goodvibes-backup"))


def test_reset_without_a_manifest_says_so_and_exits_1(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 1
    assert "No .goodvibes.json in this folder, so goodvibes manages no files here. To reset goodvibes' files in your Claude Code settings folder, run goodvibes reset --global." in _out(result)


def test_reset_puts_back_an_edited_rules_block_and_keeps_the_text_around_it(project):
    text = (project / "CLAUDE.md").read_text(encoding="utf-8")
    edited = text.replace("Every rule below is an order, not a suggestion.", "Rules are suggestions.") + "\n## My notes\nkeep me\n"
    (project / "CLAUDE.md").write_text(edited, encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    now = (project / "CLAUDE.md").read_text(encoding="utf-8")
    assert "Every rule below is an order, not a suggestion." in now
    assert "Rules are suggestions." not in now
    assert now.endswith("## My notes\nkeep me\n")
    assert (project / "CLAUDE.md.goodvibes-backup").read_text(encoding="utf-8") == edited
    assert not (project / "CLAUDE.md.goodvibes-new").exists()


def test_reset_puts_back_goodvibes_settings_entries_and_keeps_the_users_own(project):
    path = project / ".claude" / "settings.json"
    s = json.loads(path.read_text(encoding="utf-8"))
    gate = s["hooks"]["PreToolUse"][0]["hooks"][0]
    gate["command"] = gate["command"].replace("goodvibes-journal-gate;", "goodvibes-journal-gate; true;", 1)
    s["permissions"]["ask"].remove("Bash(git branch -D*)")
    s["permissions"]["allow"].append("Bash(ls*)")
    path.write_text(json.dumps(s), encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    tpl = json.loads((TPL / ".claude/settings.json").read_text(encoding="utf-8"))
    now = json.loads(path.read_text(encoding="utf-8"))
    assert now["hooks"]["PreToolUse"][0] == tpl["hooks"]["PreToolUse"][0]
    assert "Bash(git branch -D*)" in now["permissions"]["ask"]
    assert "Bash(ls*)" in now["permissions"]["allow"]
    assert json.loads((project / ".claude" / "settings.json.goodvibes-backup").read_text(encoding="utf-8")) == s
    assert "ask:Bash(git branch -D*)" in _manifest(project)["managed"][".claude/settings.json"]
    out = _out(result)
    assert "~ hooks.PreToolUse: goodvibes-journal-gate" in out
    assert "+ permissions.ask: Bash(git branch -D*)" in out


def test_reset_does_not_put_back_an_ask_rule_the_users_allow_rule_covers(project):
    path = project / ".claude" / "settings.json"
    s = json.loads(path.read_text(encoding="utf-8"))
    s["permissions"]["ask"].remove("Bash(git push*)")
    path.write_text(json.dumps(s), encoding="utf-8")
    (project / ".claude" / "settings.local.json").write_text(json.dumps({"permissions": {"allow": ["Bash(git push:*)"]}}), encoding="utf-8")

    result = runner.invoke(app, ["reset", "--yes"])

    assert result.exit_code == 0, result.output
    assert "Bash(git push*)" not in json.loads(path.read_text(encoding="utf-8"))["permissions"]["ask"]
    assert (
        ".claude/settings.json: goodvibes' ask rule Bash(git push*) stays out because your allow rule Bash(git push:*) covers it; "
        "delete Bash(git push:*), then run goodvibes reset again to have Claude Code ask first"
    ) in _out(result)


def test_reset_global_puts_back_the_rules_file_and_an_edited_settings_hook(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    apply_global_config(TPL, "1.11.1", dry_run=False)
    cfg = claude_config_dir()
    (cfg / "rules" / "goodvibes.md").write_text("my rules\n", encoding="utf-8")
    s = json.loads((cfg / "settings.json").read_text(encoding="utf-8"))
    gate = s["hooks"]["PreToolUse"][0]["hooks"][0]
    gate["command"] = gate["command"].replace("goodvibes-journal-gate;", "goodvibes-journal-gate; true;", 1)
    s["model"] = "mine"
    (cfg / "settings.json").write_text(json.dumps(s), encoding="utf-8")

    result = runner.invoke(app, ["reset", "--global", "--yes"])

    assert result.exit_code == 0, result.output
    fresh = tmp_path / "fresh"
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(fresh))
    apply_global_config(TPL, "1.11.1", dry_run=False)
    assert (cfg / "rules" / "goodvibes.md").read_bytes() == (fresh / "rules" / "goodvibes.md").read_bytes()
    assert (cfg / "rules" / "goodvibes.md.goodvibes-backup").read_text(encoding="utf-8") == "my rules\n"
    now = json.loads((cfg / "settings.json").read_text(encoding="utf-8"))
    assert now["hooks"] == json.loads((fresh / "settings.json").read_text(encoding="utf-8"))["hooks"]
    assert now["model"] == "mine"
    assert json.loads((cfg / "settings.json.goodvibes-backup").read_text(encoding="utf-8")) == s
    assert _manifest(cfg)["files"]["rules/goodvibes.md"] == _sha((fresh / "rules" / "goodvibes.md").read_bytes())
    assert "rules/goodvibes.md: reset to goodvibes' version; your copy is in rules/goodvibes.md.goodvibes-backup" in _out(result)


def test_reset_global_without_a_global_setup_says_so_and_exits_1(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    result = runner.invoke(app, ["reset", "--global", "--yes"])

    assert result.exit_code == 1
    assert "goodvibes is not set up in your Claude Code settings folder" in _out(result)
