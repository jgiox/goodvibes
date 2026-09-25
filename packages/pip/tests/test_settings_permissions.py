"""The shipped .claude/settings.json must not auto-approve commands that run arbitrary code."""
import json
import pathlib

SETTINGS = pathlib.Path(__file__).resolve().parents[3] / "templates" / ".claude" / "settings.json"
REMOVED_ALLOW = [
    "Bash(node*)",
    "Bash(python*)",
    "Bash(npx*)",
    "Bash(uv*)",
    "Bash(npm run*)",
    "Bash(npm install*)",
    "Bash(pip install*)",
    "Bash(git restore *)",
]


def _perms():
    return json.loads(SETTINGS.read_text(encoding="utf-8"))["permissions"]


def test_shipped_allow_list_has_no_arbitrary_code_install_or_discard_patterns():
    assert [p for p in REMOVED_ALLOW if p in _perms()["allow"]] == []


def test_shipped_settings_ask_before_destructive_git_and_deny_every_force_push_form():
    perms = _perms()
    for p in ["Bash(git restore*)", "Bash(git branch -D*)", "Bash(git stash drop*)", "Bash(git clean*)", "Bash(git push --force-with-lease*)"]:
        assert p in perms["ask"]
    for p in ["Bash(git push -f*)", "Bash(git push * -f*)", "Bash(git push * --force*)", "Bash(git push * +*)"]:
        assert p in perms["deny"]
