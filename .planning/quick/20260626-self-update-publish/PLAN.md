---
quick_id: 260626-2u0
slug: self-update-publish
date: 2026-06-26
status: in-progress
---

# Self-update + publish workflow_dispatch

## Goal
Upgrade command self-updates the installed package before applying templates.
Publish workflows gain a manual button (workflow_dispatch).
User gets PyPI trusted publishing setup instructions.

## Tasks

### T1 — workflow_dispatch on publish workflows
Files: `.github/workflows/publish-npm.yml`, `.github/workflows/publish-pip.yml`
Add `workflow_dispatch:` trigger alongside existing tag trigger.

### T2 — Python self-update (`upgrade_cmd.py`)
- `_check_pypi_version()` — hits `https://pypi.org/pypi/jgiox-goodvibes/json` via urllib, 5s timeout, returns latest version string or None on error
- `_get_package_version()` — `importlib.metadata.version("jgiox-goodvibes")`, returns None on PackageNotFoundError
- `_self_update_pip()` — tries `uv tool upgrade jgiox-goodvibes`, falls back to `pip install --upgrade jgiox-goodvibes`
- Guard in `upgrade_cmd`: if `_GV_UPGRADING` not in env AND newer version found → run update → `os.execve(sys.argv[0], sys.argv, {**os.environ, "_GV_UPGRADING": "1"})`

### T3 — TypeScript self-update (`upgrade.ts`)
- `checkLatestNpmVersion()` — `execa('npm', ['view', '@jgiox/goodvibes', 'version'])`, returns trimmed stdout or null
- `getInstalledVersion()` — reads `version` from bundled `package.json` via `new URL('../../package.json', import.meta.url)`
- `selfUpdateNpm(version)` — `execa('npm', ['install', '-g', '@jgiox/goodvibes@{version}'], {stdio:'inherit'})`
- Guard in `registerUpgradeCommand`: if `_GV_UPGRADING` not in env AND newer version found → update → spawn updated binary + exit

### T4 — Tests
- Python: mock `_check_pypi_version`, `_get_package_version`, `_self_update_pip`, `os.execve` — test update path and skip-when-env-set
- TypeScript: mock the three new helpers — test update path and skip-when-env-set

### T5 — PyPI setup instructions
Write step-by-step instructions for the user (displayed in output, not committed).

## Success criteria
- `npm test` green (58+2 new tests)
- `pytest` green (62+2 new tests)  
- `goodvibes upgrade` self-updates when run against a project with older goodvibes version
- Both publish workflows have `workflow_dispatch:` trigger
