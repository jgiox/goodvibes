"""Unit tests for install_git_hook; real temp repos, because this is git plumbing."""
from __future__ import annotations

import os
import pathlib
import stat
import subprocess

import pytest

from goodvibes_cli.steps.copy_templates import resolve_hooks_dir
from goodvibes_cli.steps.git_hook import install_git_hook

PACKAGED = (pathlib.Path(__file__).resolve().parents[3] / "hooks" / "pre-commit").read_bytes()


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


@pytest.fixture
def repo(tmp_path, git_env):
    d = tmp_path / "repo"
    d.mkdir()
    _git(d, "init", "-q", "-b", "main")
    return d


def _target(repo):
    return repo / ".git" / "hooks" / "pre-commit"


def test_returns_not_a_repo_outside_a_git_repository(tmp_path, git_env):
    plain = tmp_path / "plain"
    plain.mkdir()
    assert install_git_hook(plain, False)["status"] == "not-a-repo"
    assert not (plain / ".git").exists()


def test_returns_not_a_repo_when_git_is_missing(tmp_path, mocker):
    mocker.patch("goodvibes_cli.steps.git_hook.subprocess.run", side_effect=FileNotFoundError("git"))
    assert install_git_hook(tmp_path, False)["status"] == "not-a-repo"


def test_installs_the_packaged_hook_with_mode_0755_at_an_absolute_path(repo):
    result = install_git_hook(repo, False)
    target = _target(repo)
    assert result == {"status": "installed", "path": str(target)}
    assert pathlib.Path(result["path"]).is_absolute()
    assert target.read_bytes() == PACKAGED
    assert stat.S_IMODE(target.stat().st_mode) == 0o755


def test_creates_the_hooks_folder_when_it_is_missing(repo):
    import shutil
    shutil.rmtree(repo / ".git" / "hooks")
    assert install_git_hook(repo, False)["status"] == "installed"
    assert _target(repo).read_bytes() == PACKAGED


def test_returns_current_when_the_installed_hook_matches_the_package(repo):
    install_git_hook(repo, False)
    assert install_git_hook(repo, False)["status"] == "current"
    assert _target(repo).read_bytes() == PACKAGED


def test_rewrites_an_older_goodvibes_hook_and_returns_updated(repo):
    _target(repo).write_text("#!/bin/sh\n# goodvibes-pre-commit: old\nexit 0\n")
    assert install_git_hook(repo, False)["status"] == "updated"
    assert _target(repo).read_bytes() == PACKAGED
    assert stat.S_IMODE(_target(repo).stat().st_mode) == 0o755


def test_leaves_a_hook_without_the_goodvibes_marker_alone(repo):
    _target(repo).write_text("#!/bin/sh\necho mine\n")
    result = install_git_hook(repo, False)
    assert result["status"] == "existing-hook"
    assert _target(repo).read_text() == "#!/bin/sh\necho mine\n"


def test_leaves_a_symlinked_hook_alone_even_when_its_target_has_the_marker(repo, tmp_path):
    outside = tmp_path / "external" / "pre-commit"
    outside.parent.mkdir()
    outside.write_text("#!/bin/sh\n# goodvibes-pre-commit: old\n")
    _target(repo).symlink_to(outside)
    assert install_git_hook(repo, False)["status"] == "existing-hook"
    assert _target(repo).is_symlink()
    assert outside.read_text() == "#!/bin/sh\n# goodvibes-pre-commit: old\n"


def test_leaves_a_dangling_symlinked_hook_alone(repo, tmp_path):
    missing = tmp_path / "external" / "gone"
    _target(repo).symlink_to(missing)
    assert install_git_hook(repo, False)["status"] == "existing-hook"
    assert not missing.exists()


def test_refuses_to_write_through_a_git_hooks_symlink_to_a_folder_outside_the_repository(repo, tmp_path):
    import shutil
    outside = tmp_path / "external"
    outside.mkdir()
    shutil.rmtree(repo / ".git" / "hooks")
    (repo / ".git" / "hooks").symlink_to(outside)
    assert install_git_hook(repo, False) == {"status": "linked-hooks", "path": ""}
    assert install_git_hook(repo, True) == {"status": "linked-hooks", "path": ""}
    assert not (outside / "pre-commit").exists()


def test_refuses_a_git_hooks_symlink_even_when_it_points_inside_the_git_folder(repo):
    import shutil
    shutil.rmtree(repo / ".git" / "hooks")
    (repo / ".git" / "my-hooks").mkdir()
    (repo / ".git" / "hooks").symlink_to(repo / ".git" / "my-hooks")
    assert install_git_hook(repo, False)["status"] == "linked-hooks"
    assert not (repo / ".git" / "my-hooks" / "pre-commit").exists()


def test_returns_custom_path_and_writes_nothing_when_core_hookspath_is_set(repo):
    _git(repo, "config", "core.hooksPath", "my-hooks")
    result = install_git_hook(repo, False)
    assert result["status"] == "custom-path"
    assert result["detail"] == "my-hooks"
    assert not _target(repo).exists()
    assert not (repo / "my-hooks").exists()


def test_dry_run_reports_installed_without_writing(repo):
    assert install_git_hook(repo, True)["status"] == "installed"
    assert not _target(repo).exists()


def test_dry_run_reports_updated_without_rewriting(repo):
    _target(repo).write_text("# goodvibes-pre-commit: old\n")
    assert install_git_hook(repo, True)["status"] == "updated"
    assert _target(repo).read_text() == "# goodvibes-pre-commit: old\n"


def test_installs_into_the_shared_hooks_folder_from_a_linked_worktree(repo, tmp_path):
    (repo / "a.txt").write_text("a\n")
    _git(repo, "add", "a.txt")
    _git(repo, "commit", "-q", "-m", "base")
    wt = tmp_path / "wt"
    _git(repo, "worktree", "add", "-q", str(wt))
    result = install_git_hook(wt, False)
    assert result["status"] == "installed"
    assert pathlib.Path(result["path"]).resolve() == _target(repo).resolve()


def test_runs_every_git_call_with_fsmonitor_off_and_explicit_bare_repos_and_no_shell(repo, mocker):
    spy = mocker.spy(subprocess, "run")
    install_git_hook(repo, True)
    assert spy.call_count == 3
    for call in spy.call_args_list:
        assert call.args[0][:5] == ["git", "-c", "core.fsmonitor=false", "-c", "safe.bareRepository=explicit"]
        assert not call.kwargs.get("shell")


def test_resolve_hooks_dir_falls_back_to_the_repo_hooks_in_a_source_checkout(mocker, tmp_path):
    mocker.patch("goodvibes_cli.steps.copy_templates.importlib.resources.files", return_value=tmp_path / "site-packages" / "goodvibes_cli")
    assert resolve_hooks_dir() == pathlib.Path(__file__).resolve().parents[3] / "hooks"


def test_resolve_hooks_dir_prefers_the_bundled_hooks(mocker, tmp_path):
    (tmp_path / "hooks").mkdir()
    mocker.patch("goodvibes_cli.steps.copy_templates.importlib.resources.files", return_value=tmp_path)
    assert resolve_hooks_dir() == tmp_path / "hooks"


def test_hook_line_prefixes_would_only_for_installed_and_updated_in_a_dry_run():
    from goodvibes_cli.steps.git_hook import hook_line
    assert hook_line({"status": "updated"}, True) == "Would: Git commit check updated (.git/hooks/pre-commit)"
    assert hook_line({"status": "updated"}, False) == "Git commit check updated (.git/hooks/pre-commit)"
    assert hook_line({"status": "custom-path", "detail": "x"}, True) == "Git commit check skipped: git uses its own hooks folder here (core.hooksPath = x), so goodvibes left your hooks alone."
    assert hook_line({"status": "current"}, True) is None
    assert hook_line({"status": "linked-hooks", "path": ""}, False) == "Git commit check skipped: .git/hooks is a link or points outside this repository's git folder, so goodvibes left it alone."
    assert hook_line({"status": "linked-hooks", "path": ""}, True) == "Git commit check skipped: .git/hooks is a link or points outside this repository's git folder, so goodvibes left it alone."

