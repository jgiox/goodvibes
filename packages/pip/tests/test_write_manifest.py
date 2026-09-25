"""Tests for write_manifest step."""
import json
import pathlib
import re

import pytest

from goodvibes_cli.steps.write_manifest import ManifestError, write_manifest, read_manifest


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


def _manifest(tmp_dir, data):
    (tmp_dir / ".goodvibes.json").write_text(json.dumps(data), encoding="utf-8")
    return tmp_dir / ".goodvibes.json"


@pytest.mark.parametrize("key", [
    "/etc/passwd", ".claude/skills/../../.git/HEAD", "..\\outside.txt", "./AGENTS.md",
    "docs//a.md", "docs/", "", "C:/Windows/x", "evil\x1b[2J.md",
])
def test_read_manifest_rejects_an_unsafe_file_path_with_an_actionable_message(tmp_dir, key):
    p = _manifest(tmp_dir, {"version": "1.0.0", "files": {key: "abc"}})
    with pytest.raises(ManifestError) as e:
        read_manifest(tmp_dir)
    prefix, suffix = f"{p} is not a valid goodvibes manifest (", "); fix it or delete it and run goodvibes init"
    assert re.fullmatch(re.escape(prefix) + r'".*" is not a safe relative path' + re.escape(suffix), str(e.value))


def test_read_manifest_rejects_an_unsafe_path_used_as_a_managed_key(tmp_dir):
    p = _manifest(tmp_dir, {"version": "1.0.0", "files": {}, "managed": {"../x.json": []}})
    with pytest.raises(ManifestError, match=re.escape(f'{p} is not a valid goodvibes manifest ("../x.json" is not a safe relative path)')):
        read_manifest(tmp_dir)


@pytest.mark.parametrize("fields,why", [
    ({"files": []}, '"files" is not a JSON object of file paths to hashes'),
    ({"files": "abc"}, '"files" is not a JSON object of file paths to hashes'),
    ({"files": None}, '"files" is not a JSON object of file paths to hashes'),
    ({"files": {"a.md": 5}}, '"files" is not a JSON object of file paths to hashes'),
    ({"managed": 5}, '"managed" is not a JSON object of file paths to lists of text'),
    ({"managed": "oops"}, '"managed" is not a JSON object of file paths to lists of text'),
    ({"managed": {".mcp.json": "mcp:context7"}}, '"managed" is not a JSON object of file paths to lists of text'),
    ({"managed": {".mcp.json": [1]}}, '"managed" is not a JSON object of file paths to lists of text'),
    ({"scope": "weird"}, '"scope" is not "global" or "project"'),
    ({"gitHook": True}, '"gitHook" is not "installed" or "user-removed"'),
])
def test_read_manifest_rejects_the_wrong_inner_type(tmp_dir, fields, why):
    p = _manifest(tmp_dir, {"version": "1.0.0", "files": {}, **fields})
    with pytest.raises(ManifestError) as e:
        read_manifest(tmp_dir)
    assert str(e.value) == f"{p} is not a valid goodvibes manifest ({why}); fix it or delete it and run goodvibes init"


def test_read_manifest_treats_a_missing_files_map_as_empty(tmp_dir):
    _manifest(tmp_dir, {"version": "1.0.0"})
    assert read_manifest(tmp_dir)["files"] == {}


def test_read_manifest_turns_windows_backslash_managed_keys_into_forward_slashes(tmp_dir):
    _manifest(tmp_dir, {"version": "1.0.0", "files": {}, "managed": {".claude\\settings.json": ["ask:x"]}})
    assert read_manifest(tmp_dir)["managed"] == {".claude/settings.json": ["ask:x"]}


def test_read_manifest_error_text_shows_a_question_mark_instead_of_terminal_escape_codes(tmp_dir):
    (tmp_dir / ".goodvibes.json").write_text('{"a\x1b[31m": 1', encoding="utf-8")
    with pytest.raises(ManifestError) as e:
        read_manifest(tmp_dir)
    assert not re.search(r"[\x00-\x1f]", str(e.value))
