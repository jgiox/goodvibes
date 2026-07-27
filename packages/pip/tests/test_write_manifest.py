"""Tests for write_manifest step."""
import json
import pathlib

from goodvibes_cli.steps.write_manifest import write_manifest, read_manifest


def test_write_manifest_creates_goodvibes_json_with_sha256_per_file(tmp_dir):
    (tmp_dir / "CLAUDE.md").write_text("# hello\n", encoding="utf-8")
    write_manifest(tmp_dir, ["CLAUDE.md"], "1.2.0")
    manifest_path = tmp_dir / ".goodvibes.json"
    assert manifest_path.exists()
    data = json.loads(manifest_path.read_text())
    assert data["version"] == "1.2.0"
    assert "CLAUDE.md" in data["files"]
    assert len(data["files"]["CLAUDE.md"]) == 64  # sha256 hex


def test_read_manifest_returns_none_when_file_absent(tmp_dir):
    assert read_manifest(tmp_dir) is None


def test_read_manifest_returns_none_when_json_is_malformed(tmp_dir):
    (tmp_dir / ".goodvibes.json").write_text("not json", encoding="utf-8")
    assert read_manifest(tmp_dir) is None


def test_write_manifest_sets_version(tmp_dir):
    (tmp_dir / "README.md").write_text("hello", encoding="utf-8")
    write_manifest(tmp_dir, ["README.md"], "2.3.4")
    data = json.loads((tmp_dir / ".goodvibes.json").read_text())
    assert data["version"] == "2.3.4"


def test_write_manifest_hashes_actual_dest_content(tmp_dir):
    (tmp_dir / "a.txt").write_text("aaa", encoding="utf-8")
    (tmp_dir / "b.txt").write_text("bbb", encoding="utf-8")
    write_manifest(tmp_dir, ["a.txt", "b.txt"], "1.0.0")
    data = json.loads((tmp_dir / ".goodvibes.json").read_text())
    assert data["files"]["a.txt"] != data["files"]["b.txt"]
