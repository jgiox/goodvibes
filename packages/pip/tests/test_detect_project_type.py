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
