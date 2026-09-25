"""Tests for check_writable (real tmp dirs: symlinks cannot be mocked meaningfully)."""
import pytest

from goodvibes_cli.utils.safe_path import SymlinkError, check_writable


def test_check_writable_allows_a_new_file_in_a_real_folder(tmp_path):
    (tmp_path / "docs").mkdir()
    check_writable(tmp_path, tmp_path / "docs" / "new.md")


def test_check_writable_rejects_a_file_under_a_symlinked_folder(tmp_path):
    outside = tmp_path / "external"
    outside.mkdir()
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / "docs").symlink_to(outside, target_is_directory=True)
    with pytest.raises(SymlinkError, match="docs/a.md: symlink, not written"):
        check_writable(proj, proj / "docs" / "a.md")


def test_check_writable_rejects_a_dangling_symlink(tmp_path):
    (tmp_path / "AGENTS.md").symlink_to(tmp_path / "nowhere" / "x.md")
    with pytest.raises(SymlinkError, match="AGENTS.md: symlink, not written"):
        check_writable(tmp_path, tmp_path / "AGENTS.md")


def test_check_writable_rejects_a_path_that_escapes_the_root(tmp_path):
    proj = tmp_path / "proj"
    proj.mkdir()
    with pytest.raises(SymlinkError, match="outside the project"):
        check_writable(proj, proj / ".." / "x.md")
