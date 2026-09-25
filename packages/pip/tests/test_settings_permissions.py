"""The shipped .claude/settings.json must not auto-approve commands that run arbitrary code."""
import fnmatch
import json
import pathlib
import re

from goodvibes_cli.utils.json_merge import RETIRED_ALLOW, merge_managed_json

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
    for cmd in FORCE_PUSHES:
        assert [r for r in perms["deny"] if _bash_matches(r, cmd)], cmd


def _bash_matches(rule, cmd):
    # Claude Code Bash rules: `*` matches any text; a lone trailing ` *` also matches the bare command.
    body = rule[len("Bash("):-1]
    if body.endswith(" *") and body.index("*") == len(body) - 1:
        pattern = re.escape(body[:-2]) + "( .*)?"
    else:
        pattern = ".*".join(re.escape(part) for part in body.split("*"))
    return re.fullmatch(pattern, cmd, re.S) is not None


FORCE_PUSHES = [
    "git push --force",
    "git push --force origin main",
    "git push origin main --force",
    "git push origin --force main",
    "git push -f",
    "git push -f origin main",
    "git push origin main -f",
    "git push origin +main",
    "git push +main",
    "git push origin main --force-with-lease --force",
    "git reset --hard",
    "git reset --hard HEAD~1",
]
LEASE_PUSHES = ["git push --force-with-lease", "git push --force-with-lease origin main", "git push origin main --force-with-lease", "git push --force-with-lease=main:abc123 origin main"]


def test_shipped_settings_ask_before_force_with_lease_instead_of_refusing_it():
    perms = _perms()
    for cmd in LEASE_PUSHES:
        assert [r for r in perms["deny"] if _bash_matches(r, cmd)] == [], cmd
        assert [r for r in perms["ask"] if _bash_matches(r, cmd)], cmd


def test_shipped_settings_drop_write_rule_that_claude_code_ignores_and_update_retires_it():
    assert "Write(**)" not in _perms()["allow"]
    assert "Write(**)" in RETIRED_ALLOW
    merged, changes = merge_managed_json(".claude/settings.json", {}, {"permissions": {"allow": ["Read(**)", "Edit(**)", "Write(**)"]}}, [], retire_allow=True)
    assert merged["permissions"]["allow"] == ["Read(**)", "Edit(**)"]
    assert "- permissions.allow: Write(**)" in changes


SECRET_READ_DENY = [
    "Read(./.env)",
    "Read(./.env.local)",
    "Read(./.env.production)",
    "Read(**/.env)",
    "Read(~/.ssh/**)",
    "Read(~/.aws/credentials)",
    "Read(~/.git-credentials)",
    "Read(~/.netrc)",
    "Read(**/*.pem)",
    "Read(**/id_rsa)",
    "Read(**/id_ed25519)",
]


def test_shipped_settings_deny_reading_env_files_ssh_keys_and_credentials():
    assert [p for p in SECRET_READ_DENY if p not in _perms()["deny"]] == []


def _read_matches(rule, path):
    # Gitignore-style: `**/` spans folders, `*` stays inside one path segment.
    glob = rule[len("Read("):-1].removeprefix("./")
    pattern = "(.*/)?".join(re.escape(part).replace(r"\*", "[^/]*") for part in glob.split("**/"))
    return re.fullmatch(pattern, path) is not None


def test_shipped_settings_deny_env_variants_ecdsa_and_dsa_keys_in_subfolders():
    reads = [p for p in _perms()["deny"] if p.startswith("Read(")]
    paths = ["apps/web/.env.local", "apps/web/.env.staging.local", "apps/web/.env.production", "apps/web/.env.prod", "apps/web/.env.development", "apps/web/.env.dev", "apps/web/.env.staging", "apps/web/.env.test", "keys/id_ecdsa", "keys/id_dsa", "id_dsa"]
    for path in paths:
        assert [r for r in reads if _read_matches(r, path)], path


def test_shipped_settings_never_deny_reading_env_example():
    # Gitignore-style `.env.*` also matches .env.example, which must stay readable.
    reads = [p for p in _perms()["deny"] if p.startswith("Read(")]
    assert reads
    globs = {p: p[len("Read("):-1].removeprefix("./").removeprefix("**/") for p in reads}
    assert [p for p, g in globs.items() if fnmatch.fnmatchcase(".env.example", g)] == []
    assert fnmatch.fnmatchcase(".env.example", ".env.*")


def test_shipped_settings_ask_before_editing_settings_mcp_servers_and_hooks():
    guard = ["Edit(./.claude/settings.json)", "Edit(./.claude/settings.local.json)", "Edit(./.mcp.json)", "Edit(./.cursor/mcp.json)", "Edit(./.vscode/mcp.json)", "Edit(./.claude/hooks/**)", "Edit(./.codex/hooks.json)", "Edit(./.gemini/settings.json)", "Edit(./.github/hooks/**)", "Edit(./.windsurf/hooks.json)", "Edit(./.kiro/hooks/**)", "Edit(./.devin/hooks.v1.json)"]
    assert [p for p in guard if p not in _perms()["ask"]] == []
    assert [p for p in _perms()["ask"] if "CLAUDE.md" in p or "JOURNAL.md" in p] == []
