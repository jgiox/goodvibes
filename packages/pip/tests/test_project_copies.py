"""Tests for project_copies: goodvibes skill copies left in a project that now uses global scope."""
import hashlib


def _sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _skill(root, name, text):
    (root / ".claude" / "skills" / name).mkdir(parents=True)
    (root / ".claude" / "skills" / name / "SKILL.md").write_text(text, encoding="utf-8")


def test_old_skill_copies_splits_tracked_skill_files_into_unedited_and_edited(tmp_path):
    from goodvibes_cli.steps.project_copies import old_skill_copies
    _skill(tmp_path, "caveman", "shipped\n")
    _skill(tmp_path, "mine", "edited\n")
    files = {
        ".claude/skills/caveman/SKILL.md": _sha("shipped\n"),
        ".claude/skills/mine/SKILL.md": _sha("shipped\n"),
        ".claude/skills/gone/SKILL.md": _sha("shipped\n"),
        ".claude/skills/owned/SKILL.md": "user-owned",
        "JOURNAL.md": _sha("x\n"),
    }
    assert old_skill_copies(tmp_path, files) == ([".claude/skills/caveman/SKILL.md"], [".claude/skills/mine/SKILL.md"])


def test_old_skill_copies_never_reads_through_a_symlinked_skills_folder(tmp_path):
    from goodvibes_cli.steps.project_copies import old_skill_copies
    outside = tmp_path / "external"
    _skill(outside, "caveman", "shipped\n")
    proj = tmp_path / "proj"
    (proj / ".claude").mkdir(parents=True)
    (proj / ".claude" / "skills").symlink_to(outside / ".claude" / "skills")
    assert old_skill_copies(proj, {".claude/skills/caveman/SKILL.md": _sha("shipped\n")}) == ([], [])
