"""Tests for sentinel_merge — Wave 1 (03-02-PLAN.md)."""
import pytest

from .fixtures import SENTINEL_START, SENTINEL_END, TEMPLATE_CONTENT, TEMPLATE_CONTENT_V130


# ---------------------------------------------------------------------------
# version_gte
# ---------------------------------------------------------------------------

def test_version_gte_returns_true_for_equal_versions():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("1.0.0", "1.0.0") is True


def test_version_gte_returns_true_for_newer_major():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("2.0.0", "1.0.0") is True


def test_version_gte_returns_false_for_older_version():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("0.9.0", "1.0.0") is False


def test_version_gte_handles_minor_version_numerically():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    # int comparison: 10 > 9, not lexicographic
    assert version_gte("1.10.0", "1.9.0") is True


def test_version_gte_ranks_a_release_candidate_below_its_release():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("2.0.0rc1", "2.0.0") is False
    assert version_gte("1.9.1", "1.9.1rc1") is True


def test_version_gte_orders_alpha_beta_and_rc_prereleases():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("2.0.0b1", "2.0.0a1") is True
    assert version_gte("2.0.0rc1", "2.0.0b2") is True
    assert version_gte("2.0.0-rc.2", "2.0.0-rc.1") is True
    assert version_gte("2.0.0-beta.1", "2.0.0-rc.1") is False


def test_version_gte_ranks_a_post_release_above_its_release():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("1.9.1.post1", "1.9.1") is True
    assert version_gte("1.9.1", "1.9.1.post1") is False


def test_version_gte_returns_false_instead_of_raising_on_unparseable_versions():
    from goodvibes_cli.utils.sentinel_merge import version_gte
    assert version_gte("banana", "1.0.0") is False
    assert version_gte("1.0.0", "") is False
    assert version_gte("v1.7.0.", "1.7.0") in (True, False)


# ---------------------------------------------------------------------------
# extract_version
# ---------------------------------------------------------------------------

def test_extract_version_returns_version_from_stamp():
    from goodvibes_cli.utils.sentinel_merge import extract_version
    assert extract_version("# goodvibes: v1.0.0") == "1.0.0"


def test_extract_version_returns_none_when_absent():
    from goodvibes_cli.utils.sentinel_merge import extract_version
    assert extract_version("no version here") is None


def test_extract_version_from_full_sentinel_block():
    from goodvibes_cli.utils.sentinel_merge import extract_version
    block = f"{SENTINEL_START}\n# goodvibes: v1.0.0\n\n## Rules\n{SENTINEL_END}"
    assert extract_version(block) == "1.0.0"


def test_extract_version_drops_a_trailing_dot_and_keeps_prerelease_tags():
    from goodvibes_cli.utils.sentinel_merge import extract_version
    assert extract_version("# goodvibes: v1.7.0.") == "1.7.0"
    assert extract_version("# goodvibes: v2.0.0rc1") == "2.0.0rc1"
    assert extract_version("# goodvibes: v2.0.0-beta.1") == "2.0.0-beta.1"


# ---------------------------------------------------------------------------
# merge_claude
# ---------------------------------------------------------------------------

def test_merge_claude_case_a_creates_file_when_not_exists(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "subdir" / "CLAUDE.md"
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == TEMPLATE_CONTENT


def test_merge_claude_case_b_appends_sentinel_block(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = "# My existing CLAUDE.md\n\nUser content here."
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert "# My existing CLAUDE.md" in content
    assert "User content here." in content
    assert SENTINEL_START in content
    assert content.index("User content here.") < content.index(SENTINEL_START)


def test_merge_claude_case_b_idempotent_on_no_sentinel_file(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_text("# My existing CLAUDE.md\n")
    merge_claude(dest, TEMPLATE_CONTENT)
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert content.count(SENTINEL_START) == 1


def test_merge_claude_case_c_replaces_older_sentinel_block(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    old_block = f"{SENTINEL_START}\n# goodvibes: v0.9.0\n\nOld rules.\n{SENTINEL_END}"
    dest.write_text(f"# User content before\n\n{old_block}\n\nUser content after.")
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert "# User content before" in content
    assert "User content after." in content
    assert "# goodvibes: v1.0.0" in content
    assert "v0.9.0" not in content


def test_merge_claude_case_d_skips_write_when_version_equal(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = f"# My CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v1.0.0\n\nCurrent rules.\n{SENTINEL_END}\n"
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == existing


def test_merge_claude_case_d2_skips_write_when_version_newer(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = f"# My CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v2.0.0\n\nNewer rules.\n{SENTINEL_END}\n"
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == existing


def test_merge_claude_case_d_skips_write_when_version_is_v1_3_0(tmp_dir):
    # Covers the same-version skip real users hit on every re-run after v1.3.0 install
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = f"# My CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v1.3.0\n\nCurrent rules.\n{SENTINEL_END}\n"
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT_V130)
    assert dest.read_text() == existing


def _bad_markers(tmp_dir, content):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_bytes(content.encode("utf-8"))
    with pytest.raises(ValueError) as e:
        merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_bytes() == content.encode("utf-8")
    assert "fix CLAUDE.md by hand" in str(e.value)
    return str(e.value)


def test_merge_claude_refuses_a_start_marker_without_an_end_marker_and_keeps_the_text(tmp_dir):
    msg = _bad_markers(tmp_dir, "# User content\n\n<!-- goodvibes:start -->\norphaned start\nmy notes after it\n")
    assert "no <!-- goodvibes:end --> line" in msg


def test_merge_claude_refuses_an_end_marker_before_the_start_marker(tmp_dir):
    msg = _bad_markers(tmp_dir, f"# Mine\n{SENTINEL_END}\nkeep me\n{SENTINEL_START}\nrules\n")
    assert "before" in msg


def test_merge_claude_refuses_two_start_markers(tmp_dir):
    msg = _bad_markers(tmp_dir, f"{SENTINEL_START}\na\n{SENTINEL_START}\nb\n{SENTINEL_END}\nmine\n")
    assert "2" in msg


def test_merge_claude_refuses_two_end_markers(tmp_dir):
    _bad_markers(tmp_dir, f"{SENTINEL_START}\na\n{SENTINEL_END}\nmine\n{SENTINEL_END}\n")


def test_merge_claude_ignores_markers_that_are_not_alone_on_their_line(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    mention = f"Never edit between `{SENTINEL_START}` and `{SENTINEL_END}` by hand.\n"
    dest.write_text("# Mine\n" + mention, encoding="utf-8")
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text(encoding="utf-8")
    assert content.startswith("# Mine\n" + mention)
    assert "# goodvibes: v1.0.0" in content


def test_merge_claude_accepts_marker_lines_with_trailing_whitespace(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_text(f"# Mine\n{SENTINEL_START}   \n# goodvibes: v0.1.0\nold\n{SENTINEL_END}\t\nafter\n", encoding="utf-8")
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text(encoding="utf-8")
    assert "old" not in content
    assert content.startswith("# Mine\n")
    assert content.endswith("after\n")
    assert "# goodvibes: v1.0.0" in content


def test_merge_claude_keeps_crlf_line_endings_when_replacing_the_block(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_bytes(f"# Mine\r\n{SENTINEL_START}\r\n# goodvibes: v0.1.0\r\nold\r\n{SENTINEL_END}\r\nafter\r\n".encode())
    merge_claude(dest, TEMPLATE_CONTENT)
    raw = dest.read_bytes()
    assert b"old" not in raw
    assert b"# goodvibes: v1.0.0" in raw
    assert raw.count(b"\n") == raw.count(b"\r\n")
    assert raw.startswith(b"# Mine\r\n") and raw.endswith(b"after\r\n")


def test_merge_claude_keeps_crlf_line_endings_when_appending_the_block(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_bytes(b"# Mine\r\nnotes\r\n")
    merge_claude(dest, TEMPLATE_CONTENT)
    raw = dest.read_bytes()
    assert b"# goodvibes: v1.0.0" in raw
    assert raw.count(b"\n") == raw.count(b"\r\n")


def test_merge_claude_gives_a_clear_error_for_a_claude_md_that_is_not_utf8(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_bytes(b"# caf\xe9 notes\n")
    with pytest.raises(ValueError) as e:
        merge_claude(dest, TEMPLATE_CONTENT)
    assert not isinstance(e.value, UnicodeDecodeError)
    assert "UTF-8" in str(e.value)
    assert dest.read_bytes() == b"# caf\xe9 notes\n"
