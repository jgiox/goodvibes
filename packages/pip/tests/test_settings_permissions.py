"""The shipped .claude/settings.json must not auto-approve commands that run arbitrary code."""
import fnmatch
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


def test_shipped_settings_never_deny_reading_env_example():
    # Gitignore-style `.env.*` also matches .env.example, which must stay readable.
    reads = [p for p in _perms()["deny"] if p.startswith("Read(")]
    assert reads
    globs = {p: p[len("Read("):-1].removeprefix("./").removeprefix("**/") for p in reads}
    assert [p for p, g in globs.items() if fnmatch.fnmatchcase(".env.example", g)] == []
    assert fnmatch.fnmatchcase(".env.example", ".env.*")
