"""Tests for init_cmd — Phase 6 UX hardening."""
import pathlib
import pytest
import typer
from typer.testing import CliRunner


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def app():
    from goodvibes_cli.commands.init_cmd import init_cmd
    _app = typer.Typer()
    _app.command()(init_cmd)
    return _app


@pytest.fixture(autouse=True)
def mock_telemetry(mocker):
    mocker.patch("goodvibes_cli.commands.init_cmd.start_telemetry_thread", return_value=None)


@pytest.fixture(autouse=True)
def mock_write_manifest(mocker):
    mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    mocker.patch("importlib.metadata.version", return_value="1.2.0")


def test_non_empty_dir_prints_notice_before_tasks(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    # Simulate non-empty cwd
    mocker.patch("pathlib.Path.iterdir", return_value=iter([pathlib.Path("existing.txt")]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "non-empty" in result.output.lower() or "existing" in result.output.lower()


def test_completion_shows_files_written_and_skipped_panels(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.copy_templates",
        return_value=(["CLAUDE.md"], ["JOURNAL.md"]),
    )
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "written" in result.output.lower()
    assert "skipped" in result.output.lower()
    assert "CLAUDE.md" in result.output
    assert "JOURNAL.md" in result.output


def test_permission_error_prints_plain_english_and_exits_1(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.copy_templates",
        side_effect=PermissionError("Permission denied"),
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 1
    assert "permission" in result.output.lower() or "error" in result.output.lower()


def test_normal_run_shows_headroom_panel(runner, app, mocker, tmp_path):
    """goodvibes init (non-minimal) shows Headroom Panel with actual install and MCP status."""
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.install_headroom",
        return_value={"status": "installed", "reason": ""}
    )
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.configure_mcp",
        return_value={"status": "registered", "reason": ""}
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, [])
    assert result.exit_code == 0
    assert "Headroom" in result.output
    assert "headroom: installed" in result.output
    assert "MCP: registered" in result.output


def test_dry_run_minimal_excludes_github_and_docs(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.list_template_files",
        return_value=[
            "CLAUDE.md",
            ".github/workflows/ci.yml",
            "docs/onboarding.md",
            ".claude/skills/caveman/SKILL.md",
        ],
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--dry-run", "--minimal"])
    assert result.exit_code == 0
    assert "CLAUDE.md" in result.output
    assert ".github" not in result.output
    assert "docs/onboarding.md" not in result.output


def test_shows_privacy_panel_with_disclosure_text_when_not_opted_out(runner, app, mocker, tmp_path):
    mocker.patch.dict("os.environ", {"DO_NOT_TRACK": "", "GOODVIBES_NO_TELEMETRY": "", "CI": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "Anonymous usage stats are collected" in result.output
    assert "DO_NOT_TRACK=1" in result.output
    assert "Privacy" in result.output


def test_does_not_call_start_telemetry_thread_during_dry_run(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.list_template_files",
        return_value=["CLAUDE.md"],
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    # mock_telemetry autouse fixture patches start_telemetry_thread — grab the spy
    tel_mock = mocker.patch("goodvibes_cli.commands.init_cmd.start_telemetry_thread", return_value=None)
    result = runner.invoke(app, ["--dry-run"])
    assert result.exit_code == 0
    tel_mock.assert_not_called()


def test_does_not_show_privacy_panel_when_do_not_track_is_1(runner, app, mocker, tmp_path):
    mocker.patch.dict("os.environ", {"DO_NOT_TRACK": "1"})
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "Anonymous usage stats are collected" not in result.output


def test_init_calls_write_manifest_once_on_normal_run(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "skipped", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "skipped", "reason": ""})
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    mock_wm = mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert mock_wm.call_count == 1


def test_init_dry_run_does_not_call_write_manifest(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.list_template_files",
        return_value=["CLAUDE.md"],
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    mock_wm = mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    result = runner.invoke(app, ["--dry-run"])
    assert result.exit_code == 0
    assert mock_wm.call_count == 0


def test_does_not_show_privacy_panel_when_do_not_track_is_true(runner, app, mocker, tmp_path):
    mocker.patch.dict("os.environ", {"DO_NOT_TRACK": "True"})
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "Anonymous usage stats are collected" not in result.output


def test_init_exits_1_with_a_clear_message_when_the_global_manifest_is_broken(runner, app, mocker, tmp_path):
    from goodvibes_cli.steps.write_manifest import ManifestError
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.apply_global_config", side_effect=ManifestError("/x/.goodvibes.json is not valid JSON (oops); fix it or delete it and run goodvibes init"))
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 1
    assert "is not valid JSON" in result.output


_TEMPLATES = pathlib.Path(__file__).resolve().parents[3] / "templates"


@pytest.fixture
def real_project(mocker, tmp_path):
    """A real project dir where init and update read and write the real manifest (headroom/MCP still mocked)."""
    from goodvibes_cli.steps.write_manifest import write_manifest as real_write_manifest
    from goodvibes_cli.utils.json_merge import managed_record as real_managed_record
    proj = tmp_path / "proj"
    proj.mkdir()
    mocker.patch("pathlib.Path.cwd", return_value=proj)
    mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest", real_write_manifest)
    mocker.patch("goodvibes_cli.commands.init_cmd.managed_record", real_managed_record)
    for mod in ("init_cmd", "update_cmd"):
        mocker.patch(f"goodvibes_cli.commands.{mod}.resolve_templates_dir", return_value=_TEMPLATES)
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "already-installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "already-registered", "reason": ""})
    return proj


def _manifest_files(proj):
    import json
    return json.loads((proj / ".goodvibes.json").read_text(encoding="utf-8"))["files"]


def test_init_records_only_files_it_wrote_so_update_never_overwrites_the_users_own_files(runner, real_project):
    from goodvibes_cli.main import app as main_app
    proj = real_project
    (proj / ".github").mkdir()
    (proj / ".github" / "dependabot.yml").write_text("# my own dependabot\n", encoding="utf-8")
    (proj / "src").mkdir()
    (proj / "src" / "app.py").write_text("print('mine')\n", encoding="utf-8")
    (proj / ".git").mkdir()
    (proj / ".git" / "config").write_text("[core]\n", encoding="utf-8")

    result = runner.invoke(main_app, ["init"])
    assert result.exit_code == 0, result.output

    files = _manifest_files(proj)
    assert "JOURNAL.md" in files
    for mine in (".github/dependabot.yml", "src/app.py", ".git/config"):
        assert mine not in files

    result = runner.invoke(main_app, ["update", "--force"])
    assert result.exit_code == 0, result.output
    assert (proj / ".github" / "dependabot.yml").read_text(encoding="utf-8") == "# my own dependabot\n"
    assert (proj / "src" / "app.py").read_text(encoding="utf-8") == "print('mine')\n"


def test_running_init_twice_keeps_every_manifest_entry(runner, real_project):
    from goodvibes_cli.main import app as main_app
    assert runner.invoke(main_app, ["init"]).exit_code == 0
    first = _manifest_files(real_project)

    result = runner.invoke(main_app, ["init"])

    assert result.exit_code == 0, result.output
    assert _manifest_files(real_project) == first


def test_rerunning_init_keeps_a_hook_the_user_deleted_deleted(runner, real_project):
    import json
    from goodvibes_cli.main import app as main_app
    settings = real_project / ".claude" / "settings.json"
    assert runner.invoke(main_app, ["init", "--scope", "project"]).exit_code == 0
    edited = json.loads(settings.read_text(encoding="utf-8"))
    del edited["hooks"]
    settings.write_text(json.dumps(edited, indent=2), encoding="utf-8")

    assert runner.invoke(main_app, ["init", "--scope", "project"]).exit_code == 0
    result = runner.invoke(main_app, ["update", "--force"])

    assert result.exit_code == 0, result.output
    assert "hooks" not in json.loads(settings.read_text(encoding="utf-8"))


def test_init_exits_1_and_leaves_a_broken_project_manifest_alone(runner, real_project):
    from goodvibes_cli.main import app as main_app
    (real_project / ".goodvibes.json").write_text("{ broken", encoding="utf-8")
    result = runner.invoke(main_app, ["init"])
    assert result.exit_code == 1
    assert "is not valid JSON" in result.output
    assert (real_project / ".goodvibes.json").read_text(encoding="utf-8") == "{ broken"


def test_init_does_not_write_through_symlinked_claude_md_or_docs(runner, real_project, tmp_path):
    from goodvibes_cli.main import app as main_app
    outside = tmp_path / "external"
    (outside / "docs").mkdir(parents=True)
    (outside / "CLAUDE.md").write_text("outside claude\n", encoding="utf-8")
    (real_project / "CLAUDE.md").symlink_to(outside / "CLAUDE.md")
    (real_project / "docs").symlink_to(outside / "docs", target_is_directory=True)

    result = runner.invoke(main_app, ["init", "--scope", "project"])

    assert result.exit_code == 0, result.output
    assert (outside / "CLAUDE.md").read_text(encoding="utf-8") == "outside claude\n"
    assert list((outside / "docs").iterdir()) == []
    out = " ".join(result.output.split())
    assert "CLAUDE.md: symlink, not written" in out
    assert "docs: symlink, not written" in out
    assert "CLAUDE.md" not in _manifest_files(real_project)


def test_init_skips_dangling_symlinks_instead_of_writing_through_them(runner, real_project, tmp_path):
    from goodvibes_cli.main import app as main_app
    target = tmp_path / "external" / "agents.md"
    target.parent.mkdir()
    (real_project / "AGENTS.md").symlink_to(target)
    manifest_target = tmp_path / "external" / "manifest.json"
    (real_project / ".goodvibes.json").symlink_to(manifest_target)

    result = runner.invoke(main_app, ["init", "--minimal"])

    assert result.exit_code == 0, result.output
    assert not target.exists()
    assert not manifest_target.exists()
    assert ".goodvibes.json: symlink, not written" in " ".join(result.output.split())


def test_deleted_agents_md_stays_deleted_across_two_updates_and_init_restores_it(runner, real_project):
    import hashlib
    from goodvibes_cli.main import app as main_app
    agents = real_project / "AGENTS.md"
    assert runner.invoke(main_app, ["init"]).exit_code == 0
    agents.unlink()

    first = runner.invoke(main_app, ["update", "--force"])
    second = runner.invoke(main_app, ["update", "--force"])

    assert first.exit_code == 0 and second.exit_code == 0, first.output + second.output
    assert not agents.exists()
    assert "AGENTS.md: removed by you" in " ".join(first.output.split())
    assert "removed by you" not in second.output
    assert _manifest_files(real_project)["AGENTS.md"] == "user-removed"

    assert runner.invoke(main_app, ["init"]).exit_code == 0

    assert agents.exists()
    assert _manifest_files(real_project)["AGENTS.md"] == hashlib.sha256(agents.read_bytes()).hexdigest()
