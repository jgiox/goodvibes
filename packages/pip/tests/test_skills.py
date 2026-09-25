import pathlib

SKILLS = pathlib.Path(__file__).resolve().parents[3] / "templates" / ".claude" / "skills"
LIMIT = 12 * 1024


def test_every_shipped_skill_md_is_at_most_12_kb():
    sizes = {p.relative_to(SKILLS).as_posix(): p.stat().st_size for p in SKILLS.glob("*/SKILL.md")}
    assert sizes
    assert [f"{name} is {size} bytes (limit {LIMIT})" for name, size in sizes.items() if size > LIMIT] == []
