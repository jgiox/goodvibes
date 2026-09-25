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


def test_read_manifest_raises_a_clear_error_when_json_is_malformed(tmp_dir):
    import pytest
    (tmp_dir / ".goodvibes.json").write_text("not json", encoding="utf-8")
    with pytest.raises(ValueError) as e:
        read_manifest(tmp_dir)
    msg = str(e.value)
    assert msg.startswith(f"{tmp_dir / '.goodvibes.json'} is not valid JSON (")
    assert msg.endswith("); fix it or delete it and run goodvibes init")


def test_read_manifest_rejects_a_manifest_that_is_not_a_json_object(tmp_dir):
    import pytest
    (tmp_dir / ".goodvibes.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="is not valid JSON"):
        read_manifest(tmp_dir)


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


def test_write_manifest_merges_preserved_entries_without_rehashing(tmp_dir):
    (tmp_dir / "CLAUDE.md").write_text("# hello\n", encoding="utf-8")
    write_manifest(tmp_dir, ["CLAUDE.md"], "1.0.0", preserved={"skipped.md": "preserved-hash-value"})
    data = json.loads((tmp_dir / ".goodvibes.json").read_text())
    assert data["files"]["skipped.md"] == "preserved-hash-value"
    assert len(data["files"]["CLAUDE.md"]) == 64


def test_read_manifest_turns_windows_backslash_keys_into_forward_slashes(tmp_dir):
    import json
    (tmp_dir / ".goodvibes.json").write_text(json.dumps({"version": "1.0.0", "files": {".github\\workflows\\ci.yml": "abc"}}), encoding="utf-8")
    assert read_manifest(tmp_dir)["files"] == {".github/workflows/ci.yml": "abc"}


def test_write_manifest_writes_forward_slash_keys(tmp_dir):
    import json
    (tmp_dir / "docs").mkdir()
    (tmp_dir / "docs" / "a.md").write_text("a", encoding="utf-8")
    write_manifest(tmp_dir, ["docs/a.md"], "1.0.0", preserved={"docs\\b.md": "x"})
    files = json.loads((tmp_dir / ".goodvibes.json").read_text(encoding="utf-8"))["files"]
    assert set(files) == {"docs/a.md", "docs/b.md"}
