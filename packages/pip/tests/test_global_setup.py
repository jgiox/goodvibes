"""Tests for global (user-level) setup. CLAUDE_CONFIG_DIR points at a temp dir via the conftest autouse fixture."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys

from typer.testing import CliRunner

from goodvibes_cli.main import app
from goodvibes_cli.steps.copy_templates import copy_templates
from goodvibes_cli.steps.global_setup import apply_global_config, ensure_global_cli, format_global, register_context7

TEMPLATES = pathlib.Path(__file__).resolve().parents[3] / "templates"
runner = CliRunner()


def _cfg() -> pathlib.Path:
    return pathlib.Path(os.environ["CLAUDE_CONFIG_DIR"])


def _done(stdout=""):
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=stdout, stderr="")


def test_register_context7_adds_it_at_user_scope_over_http(mocker):
    run = mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", side_effect=[_done("headroom: ok"), _done()])
    assert register_context7(dry_run=False) == {"status": "registered"}
    assert run.call_args_list[1].args[0] == ["claude", "mcp", "add", "--transport", "http", "--scope", "user", "context7", "https://mcp.context7.com/mcp"]


def test_register_context7_does_nothing_when_already_listed(mocker):
    run = mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", return_value=_done("context7: https://mcp.context7.com/mcp (HTTP)"))
    assert register_context7(dry_run=False) == {"status": "already-registered"}
    assert run.call_count == 1


def test_register_context7_reports_manual_command_when_claude_cli_missing(mocker):
    mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", side_effect=FileNotFoundError())
    r = register_context7(dry_run=False)
    assert r["status"] == "skipped"
    assert "claude mcp add --transport http --scope user context7" in r["reason"]


def test_ensure_global_cli_skips_when_goodvibes_is_on_path(mocker):
    mocker.patch("goodvibes_cli.steps.global_setup.shutil.which", return_value="/usr/bin/goodvibes")
    run = mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run")
    assert ensure_global_cli("1.8.0", dry_run=False) == {"status": "already-installed"}
    run.assert_not_called()


def test_ensure_global_cli_installs_unpinned_so_uv_tool_upgrade_can_upgrade_it_later(mocker):
    mocker.patch("goodvibes_cli.steps.global_setup.shutil.which", return_value=None)
    run = mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", return_value=_done())
    assert ensure_global_cli("1.8.0", dry_run=False)["status"] == "installed"
    assert run.call_args.args[0] == ["uv", "tool", "install", "goodvibes-cli>=1.8.0"]


def test_ensure_global_cli_tells_the_user_to_run_uv_tool_update_shell_when_goodvibes_is_still_not_on_path(mocker):
    mocker.patch("goodvibes_cli.steps.global_setup.shutil.which", return_value=None)
    mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", return_value=_done())
    r = ensure_global_cli("1.8.0", dry_run=False)
    assert r["status"] == "installed"
    assert "uv tool update-shell" in r["reason"]
    assert "new terminal" in r["reason"]
    assert "uv tool update-shell" in format_global({"written": [], "kept": [], "settings_changes": []}, r, None)


def test_ensure_global_cli_installs_with_uv_tool_when_goodvibes_is_only_in_the_active_virtualenv(mocker, tmp_path):
    venv = tmp_path / "venv"
    mocker.patch.object(sys, "prefix", str(venv))
    mocker.patch.object(sys, "base_prefix", "/usr")
    mocker.patch("goodvibes_cli.steps.global_setup.shutil.which", return_value=str(venv / "bin" / "goodvibes"))
    run = mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", return_value=_done())
    assert ensure_global_cli("1.8.0", dry_run=False) == {"status": "installed"}
    assert run.call_args.args[0] == ["uv", "tool", "install", "goodvibes-cli>=1.8.0"]


def test_ensure_global_cli_reports_manual_fix_when_uv_is_missing(mocker):
    mocker.patch("goodvibes_cli.steps.global_setup.shutil.which", return_value=None)
    mocker.patch("goodvibes_cli.steps.global_setup.subprocess.run", side_effect=FileNotFoundError())
    r = ensure_global_cli("1.8.0", dry_run=False)
    assert r["status"] == "failed"
    assert 'uv tool install "goodvibes-cli>=1.8.0"' in r["reason"]


def test_apply_global_config_writes_rules_skills_settings_and_manifest():
    r = apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    cfg = _cfg()
    assert r["config_dir"] == str(cfg)
    assert (cfg / "rules" / "goodvibes.md").read_text(encoding="utf-8").startswith("<!-- goodvibes:start -->")
    assert (cfg / "skills" / "model-regression" / "SKILL.md").exists()
    settings = json.loads((cfg / "settings.json").read_text(encoding="utf-8"))
    assert settings["hooks"]["SessionStart"][0]["hooks"][0]["command"].startswith(": goodvibes-doctor;")
    assert "Bash(git push*)" in settings["permissions"]["ask"]
    assert "allow" not in settings["permissions"]
    assert json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))["scope"] == "global"


def test_apply_global_config_keeps_user_settings_and_never_adds_allow():
    cfg = _cfg()
    cfg.mkdir(parents=True)
    (cfg / "settings.json").write_text(json.dumps({"model": "opus", "permissions": {"allow": ["Bash(make*)"]}}), encoding="utf-8")
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    settings = json.loads((cfg / "settings.json").read_text(encoding="utf-8"))
    assert settings["model"] == "opus"
    assert settings["permissions"]["allow"] == ["Bash(make*)"]


def test_apply_global_config_refreshes_untouched_rules_and_keeps_user_edited_skill():
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    skill = cfg / "skills" / "caveman" / "SKILL.md"
    skill.write_text("my own caveman\n", encoding="utf-8")
    (cfg / "rules" / "goodvibes.md").write_text("stale\n", encoding="utf-8")
    manifest = json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))
    manifest["files"]["rules/goodvibes.md"] = hashlib.sha256(b"stale\n").hexdigest()
    (cfg / ".goodvibes.json").write_text(json.dumps(manifest), encoding="utf-8")

    r = apply_global_config(TEMPLATES, "1.8.1", dry_run=False)

    assert (cfg / "rules" / "goodvibes.md").read_text(encoding="utf-8").startswith("<!-- goodvibes:start -->")
    assert skill.read_text(encoding="utf-8") == "my own caveman\n"
    assert "skills/caveman/SKILL.md" in r["kept"]


def test_apply_global_config_writes_nothing_in_dry_run():
    r = apply_global_config(TEMPLATES, "1.8.0", dry_run=True)
    assert "rules/goodvibes.md" in r["written"]
    assert not _cfg().exists()


def test_apply_global_config_leaves_invalid_settings_unchanged_and_reports_it():
    cfg = _cfg()
    cfg.mkdir(parents=True)
    (cfg / "settings.json").write_text("{ nope", encoding="utf-8")
    r = apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    assert (cfg / "settings.json").read_text(encoding="utf-8") == "{ nope"
    assert "not valid JSON" in r["settings_error"]


def test_copy_templates_global_scope_skips_skills_mcp_json_and_rules_block(tmp_path):
    dest = tmp_path / "proj"
    dest.mkdir()
    written, _ = copy_templates(TEMPLATES, dest, scope="global")
    assert not (dest / ".claude" / "skills").exists()
    assert not (dest / ".mcp.json").exists()
    assert (dest / "JOURNAL.md").exists()
    claude = (dest / "CLAUDE.md").read_text(encoding="utf-8")
    assert "**What this is:**" in claude
    assert "goodvibes:start" not in claude
    assert "CLAUDE.md" in written


def test_init_defaults_to_global_scope_end_to_end(mocker, tmp_path):
    proj = tmp_path / "proj"
    proj.mkdir()
    mocker.patch("pathlib.Path.cwd", return_value=proj)
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=TEMPLATES)
    mocker.patch("goodvibes_cli.commands.init_cmd.ensure_global_cli", return_value={"status": "already-installed"})
    mocker.patch("goodvibes_cli.commands.init_cmd.register_context7", return_value={"status": "already-registered"})
    mocker.patch("goodvibes_cli.commands.init_cmd.start_telemetry_thread", return_value=None)

    result = runner.invoke(app, ["init", "--minimal"])

    assert result.exit_code == 0, result.output
    assert (_cfg() / "rules" / "goodvibes.md").exists()
    assert json.loads((proj / ".goodvibes.json").read_text(encoding="utf-8"))["scope"] == "global"
    assert "goodvibes:start" not in (proj / "CLAUDE.md").read_text(encoding="utf-8")
    assert not (proj / ".mcp.json").exists()


def test_update_in_global_scope_project_refreshes_config_and_leaves_project_claude_md_alone(mocker, tmp_path):
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / "CLAUDE.md").write_text("# CLAUDE.md\n\n## Project\n", encoding="utf-8")
    (proj / ".goodvibes.json").write_text(json.dumps({"version": "1.8.0", "files": {"CLAUDE.md": "x"}, "scope": "global"}), encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=proj)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=TEMPLATES)

    result = runner.invoke(app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert (proj / "CLAUDE.md").read_text(encoding="utf-8") == "# CLAUDE.md\n\n## Project\n"
    assert not (proj / ".claude" / "skills").exists()
    assert (_cfg() / "rules" / "goodvibes.md").exists()


def test_apply_global_config_reports_settings_that_are_not_a_json_object():
    cfg = _cfg()
    cfg.mkdir(parents=True)
    (cfg / "settings.json").write_text("[]", encoding="utf-8")
    r = apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    assert (cfg / "settings.json").read_text(encoding="utf-8") == "[]"
    assert "not a JSON object; left unchanged" in r["settings_error"]


def test_update_does_not_recreate_a_skill_the_user_deleted_from_the_config_dir():
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    (cfg / "skills" / "caveman" / "SKILL.md").unlink()

    r = apply_global_config(TEMPLATES, "1.8.1", dry_run=False, restore=False)

    assert not (cfg / "skills" / "caveman" / "SKILL.md").exists()
    assert "skills/caveman/SKILL.md" in r["removed"]
    assert json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))["files"]["skills/caveman/SKILL.md"] == "user-removed"
    assert "skills/caveman/SKILL.md: removed by you, not re-added (run goodvibes init to restore)" in format_global(r, None, None)


def test_init_restores_a_skill_the_user_deleted_from_the_config_dir():
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    (cfg / "skills" / "caveman" / "SKILL.md").unlink()

    apply_global_config(TEMPLATES, "1.8.1", dry_run=False)

    assert (cfg / "skills" / "caveman" / "SKILL.md").exists()


def _snapshot(root: pathlib.Path) -> dict:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def _stale_config_and_project(mocker, tmp_path):
    from goodvibes_cli.steps import global_setup
    mocker.patch("goodvibes_cli.commands.update_cmd.apply_global_config", global_setup.apply_global_config)
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    (cfg / "rules" / "goodvibes.md").write_text("stale\n", encoding="utf-8")
    manifest = json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))
    manifest["files"]["rules/goodvibes.md"] = hashlib.sha256(b"stale\n").hexdigest()
    (cfg / ".goodvibes.json").write_text(json.dumps(manifest), encoding="utf-8")
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / "AGENTS.md").write_text("old agents\n", encoding="utf-8")
    (proj / ".goodvibes.json").write_text(json.dumps({"version": "1.8.0", "scope": "global", "files": {"AGENTS.md": hashlib.sha256(b"old agents\n").hexdigest()}}), encoding="utf-8")
    mocker.patch("pathlib.Path.cwd", return_value=proj)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=TEMPLATES)
    return cfg, proj


def test_update_cancelled_at_the_prompt_leaves_the_config_dir_and_project_untouched(mocker, tmp_path):
    cfg, proj = _stale_config_and_project(mocker, tmp_path)
    before_cfg, before_proj = _snapshot(cfg), _snapshot(proj)

    result = runner.invoke(app, ["update"], input="n\n")

    assert result.exit_code == 0, result.output
    assert _snapshot(cfg) == before_cfg
    assert _snapshot(proj) == before_proj
    assert "rules/goodvibes.md" in result.output
    assert "Will overwrite (1): AGENTS.md" in result.output


def test_update_asks_once_before_changing_the_config_dir(mocker, tmp_path):
    cfg, proj = _stale_config_and_project(mocker, tmp_path)
    before_cfg = _snapshot(cfg)
    seen = []

    def confirm(question, **kwargs):
        seen.append(_snapshot(cfg) == before_cfg)
        return True

    mocker.patch("goodvibes_cli.commands.update_cmd.typer.confirm", side_effect=confirm)

    result = runner.invoke(app, ["update"])

    assert result.exit_code == 0, result.output
    assert seen == [True]
    assert (cfg / "rules" / "goodvibes.md").read_text(encoding="utf-8").startswith("<!-- goodvibes:start -->")
    assert (proj / "AGENTS.md").read_text(encoding="utf-8") != "old agents\n"


def test_deleted_rules_stay_deleted_across_two_updates_and_init_restores_them():
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    rules = cfg / "rules" / "goodvibes.md"
    rules.unlink()

    first = apply_global_config(TEMPLATES, "1.8.1", dry_run=False, restore=False)
    second = apply_global_config(TEMPLATES, "1.8.1", dry_run=False, restore=False)

    assert not rules.exists()
    assert first["removed"] == ["rules/goodvibes.md"]
    assert second["removed"] == []
    assert json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))["files"]["rules/goodvibes.md"] == "user-removed"

    apply_global_config(TEMPLATES, "1.8.1", dry_run=False)

    assert rules.exists()
    assert json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))["files"]["rules/goodvibes.md"] == hashlib.sha256(rules.read_bytes()).hexdigest()


def test_init_records_a_recreated_user_removed_skill_as_user_owned_and_keeps_it():
    cfg = _cfg()
    apply_global_config(TEMPLATES, "1.8.0", dry_run=False)
    skill = cfg / "skills" / "caveman" / "SKILL.md"
    skill.unlink()
    apply_global_config(TEMPLATES, "1.8.1", dry_run=False, restore=False)
    skill.write_text("my own caveman\n", encoding="utf-8")

    apply_global_config(TEMPLATES, "1.8.1", dry_run=False)

    assert skill.read_text(encoding="utf-8") == "my own caveman\n"
    assert json.loads((cfg / ".goodvibes.json").read_text(encoding="utf-8"))["files"]["skills/caveman/SKILL.md"] == "user-owned"
