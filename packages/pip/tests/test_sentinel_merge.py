"""Test stubs for sentinel_merge — implement in Wave 1 (03-02-PLAN.md)."""
import pytest

from .conftest import SENTINEL_START, SENTINEL_END, TEMPLATE_CONTENT


# ---------------------------------------------------------------------------
# versionGte
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_version_gte_returns_true_for_equal_versions():
    from goodvibes_cli.sentinel_merge import version_gte
    assert version_gte("1.0.0", "1.0.0") is True


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_version_gte_returns_true_for_newer_major():
    from goodvibes_cli.sentinel_merge import version_gte
    assert version_gte("2.0.0", "1.0.0") is True


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_version_gte_returns_false_for_older_version():
    from goodvibes_cli.sentinel_merge import version_gte
    assert version_gte("0.9.0", "1.0.0") is False


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_version_gte_handles_minor_version_numerically():
    from goodvibes_cli.sentinel_merge import version_gte
    assert version_gte("1.10.0", "1.9.0") is True


# ---------------------------------------------------------------------------
# extractVersion
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_extract_version_returns_version_from_stamp():
    from goodvibes_cli.sentinel_merge import extract_version
    assert extract_version("# goodvibes: v1.0.0") == "1.0.0"


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_extract_version_returns_none_when_absent():
    from goodvibes_cli.sentinel_merge import extract_version
    assert extract_version("no version here") is None


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_extract_version_from_full_sentinel_block():
    from goodvibes_cli.sentinel_merge import extract_version
    block = f"{SENTINEL_START}\n# goodvibes: v1.0.0\n\n## Rules\n{SENTINEL_END}"
    assert extract_version(block) == "1.0.0"


# ---------------------------------------------------------------------------
# mergeClaude
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_a_creates_file_when_not_exists(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "subdir" / "CLAUDE.md"
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == TEMPLATE_CONTENT


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_b_appends_sentinel_block(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = "# My existing CLAUDE.md\n\nUser content here."
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert "# My existing CLAUDE.md" in content
    assert "User content here." in content
    assert SENTINEL_START in content
    assert content.index("User content here.") < content.index(SENTINEL_START)


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_b_idempotent_on_no_sentinel_file(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_text("# My existing CLAUDE.md\n")
    merge_claude(dest, TEMPLATE_CONTENT)
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert content.count(SENTINEL_START) == 1


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_c_replaces_older_sentinel_block(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    old_block = f"{SENTINEL_START}\n# goodvibes: v0.9.0\n\nOld rules.\n{SENTINEL_END}"
    dest.write_text(f"# User content before\n\n{old_block}\n\nUser content after.")
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert "# User content before" in content
    assert "User content after." in content
    assert "# goodvibes: v1.0.0" in content
    assert "v0.9.0" not in content


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_d_skips_write_when_version_equal(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = f"# My CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v1.0.0\n\nCurrent rules.\n{SENTINEL_END}\n"
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == existing


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_merge_claude_case_d2_skips_write_when_version_newer(tmp_dir):
    from goodvibes_cli.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    existing = f"# My CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v2.0.0\n\nNewer rules.\n{SENTINEL_END}\n"
    dest.write_text(existing)
    merge_claude(dest, TEMPLATE_CONTENT)
    assert dest.read_text() == existing
