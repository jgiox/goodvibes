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
    assert "manifest" in output.lower()
    assert "v1.2.0" not in output
    assert "goodvibes init" in output


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


def test_update_prompts_confirm_before_overwriting_without_force(mocker, tmp_path):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    (tmp_path / "CLAUDE.md").write_text("# mine\n", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
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
    (project_dir / "CLAUDE.md").write_text("# mine\n", encoding="utf-8")

    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
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


def test_update_exits_1_with_a_clear_message_when_goodvibes_json_is_broken(mocker, tmp_path):
    (tmp_path / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=tmp_path)
    result = runner.invoke(app, ["update", "--force"])
    out = " ".join(_ANSI.sub("", result.output).split())
    assert result.exit_code == 1
    assert "is not valid JSON" in out
    assert "fix it or delete it and run goodvibes init" in out
    assert "not set up" not in out


def test_update_exits_1_when_the_global_manifest_is_broken(mocker, tmp_path, monkeypatch):
    cfg = tmp_path / "claude-config"
    cfg.mkdir()
    (cfg / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    proj = tmp_path / "proj"
    proj.mkdir()
    mocker.patch("pathlib.Path.cwd", return_value=proj)
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 1
    assert "is not valid JSON" in _ANSI.sub("", result.output)


def test_update_matches_backslash_manifest_keys_written_on_windows(mocker, tmp_path):
    template_dir = tmp_path / "templates"
    (template_dir / "docs").mkdir(parents=True)
    (template_dir / "docs" / "onboarding.md").write_text("v2\n", encoding="utf-8")
    project_dir = tmp_path / "project"
    (project_dir / "docs").mkdir(parents=True)
    (project_dir / "docs" / "onboarding.md").write_text("v1\n", encoding="utf-8")
    _write_manifest(project_dir, {"docs\\onboarding.md": _sha("v1\n")})
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert (project_dir / "docs" / "onboarding.md").read_text(encoding="utf-8") == "v2\n"
    assert list(_read(project_dir, ".goodvibes.json")["files"]) == ["docs/onboarding.md"]


def test_update_reports_broken_claude_md_markers_updates_the_rest_and_exits_non_zero(mocker, tmp_path):
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    (template_dir / "CLAUDE.md").write_text("<!-- goodvibes:start -->\n# goodvibes: v2.0.0\nnew\n<!-- goodvibes:end -->\n", encoding="utf-8")
    (template_dir / "AGENTS.md").write_text("agents v2\n", encoding="utf-8")
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    broken = "# Mine\n<!-- goodvibes:start -->\nno end marker, my notes\n"
    (project_dir / "CLAUDE.md").write_text(broken, encoding="utf-8")
    (project_dir / "AGENTS.md").write_text("agents v1\n", encoding="utf-8")
    _write_manifest(project_dir, {"CLAUDE.md": "x", "AGENTS.md": _sha("agents v1\n")})
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code != 0
    assert (project_dir / "CLAUDE.md").read_text(encoding="utf-8") == broken
    assert (project_dir / "AGENTS.md").read_text(encoding="utf-8") == "agents v2\n"
    assert "fix CLAUDE.md by hand" in " ".join(_ANSI.sub("", result.output).split())


def test_update_reports_settings_that_are_not_a_json_object_and_leaves_them_unchanged(merge_dirs):
    (merge_dirs / ".claude" / "settings.json").write_text("[]", encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": "old-hash"})

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert (merge_dirs / ".claude" / "settings.json").read_text(encoding="utf-8") == "[]"
    assert ".claude/settings.json: not a JSON object; left unchanged" in _ANSI.sub("", result.output)


def test_update_merge_keeps_non_ascii_text_in_settings(merge_dirs):
    (merge_dirs / ".claude" / "settings.json").write_text(json.dumps({"env": {"GREETING": "héllo"}}, ensure_ascii=False), encoding="utf-8")
    _write_manifest(merge_dirs, {".claude/settings.json": "old-hash"})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    assert "héllo" in (merge_dirs / ".claude" / "settings.json").read_text(encoding="utf-8")


@pytest.mark.parametrize("recorded", ["unchanged", "user-edited"])
def test_update_does_not_write_through_a_symlinked_claude_dir(mocker, tmp_path, recorded):
    template_dir = tmp_path / "templates"
    (template_dir / ".claude" / "skills" / "x").mkdir(parents=True)
    (template_dir / ".claude" / "settings.json").write_text(_TPL_SETTINGS, encoding="utf-8")
    (template_dir / ".claude" / "skills" / "x" / "SKILL.md").write_text("skill\n", encoding="utf-8")
    outside = tmp_path / "external" / "claude"
    outside.mkdir(parents=True)
    theirs = json.dumps({"permissions": {"allow": ["Bash(make*)"]}})
    (outside / "settings.json").write_text(theirs, encoding="utf-8")
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    (project_dir / ".claude").symlink_to(outside, target_is_directory=True)
    _write_manifest(project_dir, {".claude/settings.json": _sha(theirs) if recorded == "unchanged" else "old-hash"})
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])

    assert (outside / "settings.json").read_text(encoding="utf-8") == theirs
    assert sorted(p.name for p in outside.iterdir()) == ["settings.json"]
    assert ".claude/settings.json: symlink, not written" in _ANSI.sub("", result.output)
    assert "Traceback" not in result.output


def test_assert_safe_accepts_paths_inside_a_drive_root_and_rejects_escapes(tmp_path):
    from goodvibes_cli.commands.update_cmd import _assert_safe
    _assert_safe(pathlib.Path(tmp_path.anchor), tmp_path.relative_to(tmp_path.anchor).as_posix())
    with pytest.raises(ValueError):
        _assert_safe(tmp_path, "../outside.txt")


def _tpl(template_dir, rels):
    for rel in rels:
        (template_dir / rel).parent.mkdir(parents=True, exist_ok=True)
        (template_dir / rel).write_text(f"template {rel}\n", encoding="utf-8")


@pytest.fixture
def plain_dirs(mocker, tmp_path):
    template_dir, project_dir = tmp_path / "templates", tmp_path / "project"
    template_dir.mkdir()
    project_dir.mkdir()
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)
    return template_dir, project_dir


def test_update_does_not_recreate_a_tracked_file_the_user_deleted(plain_dirs):
    template_dir, project_dir = plain_dirs
    _tpl(template_dir, ["docs/onboarding.md", "JOURNAL.md"])
    (project_dir / "JOURNAL.md").write_text("template JOURNAL.md\n", encoding="utf-8")
    _write_manifest(project_dir, {"docs/onboarding.md": _sha("template docs/onboarding.md\n"), "JOURNAL.md": _sha("template JOURNAL.md\n")})

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert not (project_dir / "docs" / "onboarding.md").exists()
    out = " ".join(_ANSI.sub("", result.output).split())
    assert "docs/onboarding.md: removed by you, not re-added (run goodvibes init to restore)" in out
    assert _read(project_dir, ".goodvibes.json")["files"]["docs/onboarding.md"] == "user-removed"


def test_update_adds_new_github_and_docs_files_only_to_groups_the_manifest_already_tracks(plain_dirs):
    template_dir, project_dir = plain_dirs
    _tpl(template_dir, ["JOURNAL.md", "NEW.md", ".github/workflows/security.yml", ".github/dependabot.yml", "docs/onboarding.md"])
    (project_dir / "JOURNAL.md").write_text("template JOURNAL.md\n", encoding="utf-8")
    _write_manifest(project_dir, {"JOURNAL.md": _sha("template JOURNAL.md\n")})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    assert (project_dir / "NEW.md").exists()
    assert not (project_dir / ".github").exists()
    assert not (project_dir / "docs").exists()


def test_update_adds_a_new_workflow_when_the_manifest_tracks_a_workflow_but_not_other_github_files(plain_dirs):
    template_dir, project_dir = plain_dirs
    _tpl(template_dir, [".github/workflows/ci-both.yml", ".github/workflows/security.yml", ".github/dependabot.yml", "docs/onboarding.md"])
    ci = project_dir / ".github" / "workflows" / "ci.yml"
    ci.parent.mkdir(parents=True)
    ci.write_text("template .github/workflows/ci-both.yml\n", encoding="utf-8")
    _write_manifest(project_dir, {".github/workflows/ci.yml": _sha("template .github/workflows/ci-both.yml\n")})

    assert runner.invoke(app, ["update", "--force"]).exit_code == 0

    assert (project_dir / ".github" / "workflows" / "security.yml").exists()
    assert not (project_dir / ".github" / "dependabot.yml").exists()
    assert not (project_dir / "docs").exists()


def test_update_never_overwrites_a_removed_file_the_user_recreated(plain_dirs):
    template_dir, project_dir = plain_dirs
    _tpl(template_dir, ["AGENTS.md"])
    (project_dir / "AGENTS.md").write_text("my own agents\n", encoding="utf-8")
    _write_manifest(project_dir, {"AGENTS.md": "user-removed"})

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert (project_dir / "AGENTS.md").read_text(encoding="utf-8") == "my own agents\n"
    assert _read(project_dir, ".goodvibes.json")["files"]["AGENTS.md"] == "user-owned"
