"""Tests for detect_project_type — CI-05."""
import pathlib
import pytest


def test_returns_node_when_only_package_json_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "package.json").write_text("{}")
    assert detect_project_type(tmp_dir) == "node"


def test_returns_python_when_only_pyproject_toml_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "pyproject.toml").write_text("[project]")
    assert detect_project_type(tmp_dir) == "python"


def test_returns_python_when_only_requirements_txt_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "requirements.txt").write_text("pytest")
    assert detect_project_type(tmp_dir) == "python"


def test_returns_both_when_package_json_and_pyproject_toml_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "package.json").write_text("{}")
    (tmp_dir / "pyproject.toml").write_text("[project]")
    assert detect_project_type(tmp_dir) == "both"


def test_returns_both_when_neither_marker_exists(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    # Empty dir — safe default
    assert detect_project_type(tmp_dir) == "both"


_TPL = 'version: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    directory: "/"\n'


def _block(eco):
    return (f'  - package-ecosystem: "{eco}"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n'
            '    open-pull-requests-limit: 5\n    cooldown:\n      default-days: 7\n')


def test_dependabot_yml_keeps_only_github_actions_in_a_folder_with_no_package_files(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import dependabot_yml
    assert dependabot_yml(_TPL, tmp_dir) == _TPL


def test_dependabot_yml_adds_npm_when_package_json_exists(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import dependabot_yml
    (tmp_dir / "package.json").write_text("{}")
    assert dependabot_yml(_TPL, tmp_dir) == _TPL + _block("npm")


def test_dependabot_yml_adds_uv_and_not_pip_when_uv_lock_exists_next_to_pyproject_toml(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import dependabot_yml
    (tmp_dir / "pyproject.toml").write_text("[project]")
    (tmp_dir / "uv.lock").write_text("")
    assert dependabot_yml(_TPL, tmp_dir) == _TPL + _block("uv")


def test_dependabot_yml_adds_pip_when_requirements_txt_or_pyproject_toml_exists_without_uv_lock(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import dependabot_yml
    (tmp_dir / "requirements.txt").write_text("pytest")
    assert dependabot_yml(_TPL, tmp_dir) == _TPL + _block("pip")
    (tmp_dir / "requirements.txt").unlink()
    (tmp_dir / "pyproject.toml").write_text("[project]")
    assert dependabot_yml(_TPL, tmp_dir) == _TPL + _block("pip")


def test_dependabot_yml_adds_npm_then_pip_for_a_project_with_package_json_and_requirements_txt(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import dependabot_yml
    (tmp_dir / "package.json").write_text("{}")
    (tmp_dir / "requirements.txt").write_text("pytest")
    assert dependabot_yml(_TPL, tmp_dir) == _TPL + _block("npm") + _block("pip")
