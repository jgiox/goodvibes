"""Tests for update_cmd."""
import hashlib
import json
import re
import pathlib

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()
_ANSI = re.compile(r'\x1b\[[0-9;]*m')


def test_update_shows_no_manifest_message_and_exits_0_when_goodvibes_json_absent(mocker):
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=None)
    result = runner.invoke(app, ["update"])
    assert result.exit_code == 0
    output = _ANSI.sub("", result.output)
    assert "manifest" in output.lower() or "v1.2.0" in output


def test_update_dry_run_prints_three_categories_without_writing(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    mock_copy = mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    result = runner.invoke(app, ["update", "--dry-run"])
    assert result.exit_code == 0
    output = _ANSI.sub("", result.output)
    assert "dry run" in output.lower()
    mock_write.assert_not_called()
    mock_copy.assert_not_called()


def test_update_force_skips_confirm_prompt(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_confirm = mocker.patch("goodvibes_cli.commands.update_cmd.typer.confirm")
    # template_dir is a MagicMock so template_src.exists() is truthy; mock merge_claude to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_confirm.assert_not_called()


def test_update_prompts_confirm_before_overwriting_without_force(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_confirm = mocker.patch("goodvibes_cli.commands.update_cmd.typer.confirm", return_value=True)
    # template_dir is a MagicMock so template_src.exists() is truthy; mock merge_claude to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update"])
    mock_confirm.assert_called_once()


def test_update_calls_write_manifest_after_applying_changes(mocker):
    manifest = {"version": "1.0.0", "files": {"README.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    # template_dir is a MagicMock so template_src.exists() is truthy; mock copy2 to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_write.assert_called_once()


def test_update_skips_user_modified_files(mocker):
    """Files with a different SHA than the manifest are categorised as skip and excluded from write_manifest.

    Uses a non-CLAUDE.md fixture — CLAUDE.md is always routed to overwrite via
    merge_claude regardless of whole-file hash; see test_update_refreshes_claude_block_*.
    """
    manifest = {"version": "1.0.0", "files": {"docs/onboarding.md": "expectedsha"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    # File exists with different content → real sha256 ≠ "expectedsha" → skip
    mocker.patch("pathlib.Path.exists", return_value=True)
    mocker.patch("pathlib.Path.read_bytes", return_value=b"user-modified content")
    mocker.patch("goodvibes_cli.commands.update_cmd.managed_record", return_value={})
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    assert mock_write.called
    written_files = mock_write.call_args[0][1]
    assert "docs/onboarding.md" not in written_files


def test_update_uses_merge_claude_for_claude_md(mocker, tmp_path):
    """CLAUDE.md is updated via merge_claude, never via shutil.copy2."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    (template_dir / "CLAUDE.md").write_text("# Template\n", encoding="utf-8")
    project_dir = tmp_path / "project"
    project_dir.mkdir()

    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    # cwd → project_dir (no CLAUDE.md) so dest doesn't exist → overwrite
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)
    mock_copy = mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    mock_merge = mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_merge.assert_called_once()
    mock_copy.assert_not_called()


def test_update_keeps_user_modified_file_across_two_runs(mocker, tmp_path):
    """A file skipped as user-modified on run 1 must not be reclassified as net-new (and overwritten) on run 2."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    original_content = "template content v1\n"
    (template_dir / "tracked.md").write_text(original_content, encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    user_content = "user edited this file\n"
    (project_dir / "tracked.md").write_text(user_content, encoding="utf-8")
    (project_dir / ".goodvibes.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "files": {"tracked.md": hashlib.sha256(original_content.encode("utf-8")).hexdigest()},
            }
        ),
        encoding="utf-8",
    )

    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    assert (project_dir / "tracked.md").read_text(encoding="utf-8") == user_content

    result2 = runner.invoke(app, ["update", "--force"])
    assert result2.exit_code == 0
    assert (project_dir / "tracked.md").read_text(encoding="utf-8") == user_content


def test_update_does_not_overwrite_pre_existing_file_missing_from_manifest(mocker, tmp_path):
    """A file init skipped (it already existed) is absent from the manifest; update must not treat it as net-new and overwrite it."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    (template_dir / "AGENTS.md").write_text("goodvibes template\n", encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    user_agents = "my own agent rules, written before goodvibes init\n"
    (project_dir / "AGENTS.md").write_text(user_agents, encoding="utf-8")
    (project_dir / ".goodvibes.json").write_text(json.dumps({"version": "1.0.0", "files": {}}), encoding="utf-8")

    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    for _ in range(2):
        result = runner.invoke(app, ["update", "--force"])
        assert result.exit_code == 0
        assert (project_dir / "AGENTS.md").read_text(encoding="utf-8") == user_agents


def test_update_refreshes_claude_block_and_preserves_outside_content(mocker, tmp_path):
    """CLAUDE.md's sentinel block refreshes via update even when the whole-file hash never matches."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    template_claude_md = (
        "<!-- goodvibes:start -->\n# goodvibes: v2.0.0\n\nnew rules\n<!-- goodvibes:end -->\n"
    )
    (template_dir / "CLAUDE.md").write_text(template_claude_md, encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    # Manifest records the hash as written by init (block only, no custom prose yet).
    initial_claude_md = (
        "<!-- goodvibes:start -->\n# goodvibes: v1.0.0\n\nold rules\n<!-- goodvibes:end -->\n"
    )
    # The user then appended custom prose outside the block — the whole-file hash no
    # longer matches the manifest even though the sentinel block itself is untouched.
    existing_claude_md = "# My Project\n\nCustom prose that must survive.\n\n" + initial_claude_md
    (project_dir / "CLAUDE.md").write_text(existing_claude_md, encoding="utf-8")
    (project_dir / ".goodvibes.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "files": {"CLAUDE.md": hashlib.sha256(initial_claude_md.encode("utf-8")).hexdigest()},
            }
        ),
        encoding="utf-8",
    )

    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    updated = (project_dir / "CLAUDE.md").read_text(encoding="utf-8")
    assert "Custom prose that must survive." in updated
    assert "new rules" in updated
    assert "old rules" not in updated


_REPO_TEMPLATES = pathlib.Path(__file__).resolve().parents[3] / "templates"
_TPL_SETTINGS = (_REPO_TEMPLATES / ".claude" / "settings.json").read_text(encoding="utf-8")
_TPL_MCP = (_REPO_TEMPLATES / ".mcp.json").read_text(encoding="utf-8")


@pytest.fixture
def merge_dirs(mocker, tmp_path):
    template_dir = tmp_path / "templates"
    project_dir = tmp_path / "project"
    for d in (template_dir, project_dir):
        (d / ".claude").mkdir(parents=True)
    (template_dir / ".claude" / "settings.json").write_text(_TPL_SETTINGS, encoding="utf-8")
    (template_dir / ".mcp.json").write_text(_TPL_MCP, encoding="utf-8")
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)
    return project_dir


def _write_manifest(project_dir, files):
    (project_dir / ".goodvibes.json").write_text(json.dumps({"version": "1.7.1", "files": files}), encoding="utf-8")


def _sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _read(project_dir, rel):
    return json.loads((project_dir / rel).read_text(encoding="utf-8"))


def test_update_merges_journal_gate_and_ask_rules_into_hand_edited_settings(merge_dirs):
    v171 = json.dumps({"permissions": {"allow": ["Read(**)"], "deny": ["Bash(git reset --hard*)"]}}, indent=2)
    user = {
        "permissions": {"allow": ["Read(**)", "Bash(make*)"], "deny": ["Bash(git reset --hard*)"]},
        "hooks": {"PostToolUse": [{"matcher": "Edit", "hooks": [{"type": "command", "command": "npx prettier --write ."}]}]},
    }
    (merge_dirs / ".claude" / "settings.json").write_text(json.dumps(user, indent=2), encoding="utf-8")
    (merge_dirs / ".mcp.json").write_text(_TPL_MCP, encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": _sha(v171), ".mcp.json": _sha(_TPL_MCP)})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    s = _read(merge_dirs, ".claude/settings.json")
    assert s["permissions"]["allow"] == ["Read(**)", "Bash(make*)"]
    assert s["hooks"]["PostToolUse"] == user["hooks"]["PostToolUse"]
    assert s["hooks"]["PreToolUse"][0]["hooks"][0]["command"].startswith(": goodvibes-journal-gate;")
    assert s["permissions"]["ask"] == json.loads(_TPL_SETTINGS)["permissions"]["ask"]


def test_update_adds_context7_to_unrecorded_user_mcp_json_and_keeps_other_servers(merge_dirs):
    (merge_dirs / ".mcp.json").write_text(json.dumps({"mcpServers": {"postgres": {"command": "pg-mcp"}}}), encoding="utf-8")
    _write_manifest(merge_dirs, {})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    m = _read(merge_dirs, ".mcp.json")
    assert m["mcpServers"]["postgres"] == {"command": "pg-mcp"}
    assert m["mcpServers"]["context7"] == json.loads(_TPL_MCP)["mcpServers"]["context7"]


def test_update_dry_run_lists_json_keys_it_would_add_without_writing(merge_dirs):
    user_file = json.dumps({"permissions": {"allow": ["Bash(make*)"]}})
    (merge_dirs / ".claude" / "settings.json").write_text(user_file, encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": "old-hash"})

    result = runner.invoke(app, ["update", "--dry-run"])

    out = _ANSI.sub("", result.output)
    assert "Will merge goodvibes keys into .claude/settings.json" in out
    assert "+ hooks.PreToolUse: goodvibes-journal-gate" in out
    assert (merge_dirs / ".claude" / "settings.json").read_text(encoding="utf-8") == user_file


def test_update_still_overwrites_untouched_settings_whole_file(merge_dirs):
    v171 = json.dumps({"permissions": {"allow": ["Read(**)"]}}, indent=2)
    (merge_dirs / ".claude" / "settings.json").write_text(v171, encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": _sha(v171)})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    assert (merge_dirs / ".claude" / "settings.json").read_text(encoding="utf-8") == _TPL_SETTINGS


def test_update_does_not_readd_journal_gate_after_user_deleted_it(merge_dirs):
    (merge_dirs / ".claude" / "settings.json").write_text(json.dumps({"permissions": {"allow": ["Bash(make*)"]}}), encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": "old-hash"})
    assert runner.invoke(app, ["update", "--force"]).exit_code == 0
    after_first = _read(merge_dirs, ".claude/settings.json")
    del after_first["hooks"]
    (merge_dirs / ".claude" / "settings.json").write_text(json.dumps(after_first, indent=2), encoding="utf-8")

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    assert "hooks" not in _read(merge_dirs, ".claude/settings.json")


def test_update_leaves_invalid_settings_unchanged_and_reports_it(merge_dirs):
    (merge_dirs / ".claude" / "settings.json").write_text("{ not json", encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": "old-hash"})

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0
    assert (merge_dirs / ".claude" / "settings.json").read_text(encoding="utf-8") == "{ not json"
    assert ".claude/settings.json: not valid JSON" in _ANSI.sub("", result.output)
