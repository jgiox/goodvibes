---
phase: 04-ci-cd-scaffolding
plan: 04
status: complete
completed: 2026-06-25
---

# Plan 04-04 Summary — Human Verification of Generated CI Workflows

## Outcome

All three checkpoint tasks passed. Phase 4 is complete.

## Task 1: Node CI (local verification — earlier session)

- Created `/tmp/test-gv-node` with `package.json`
- Ran `node dist/index.js init` from goodvibes npm local build
- Confirmed `.github/workflows/ci.yml` written (not `ci-node.yml`)
- Confirmed `ci.yml` contains `npm install`, `--if-present`, matrix node 20/22
- Node CI verified locally. (Push to GitHub deferred to Task 2/3 shared repo.)

## Task 2: Python CI

- Created `/tmp/test-gv-python` with `pyproject.toml`
- Ran `/home/ygiokas/GoodVibes/packages/pip/.venv/bin/goodvibes init`
- `detect_project_type` detected `pyproject.toml` → `'python'`
- `.github/workflows/` contains `ci.yml` (renamed from `ci-python.yml`), `security.yml`, `dependency-review.yml`
- Pushed to `github.com/jgiox/test-gv-python`

## Task 3: Security and Dependency Review

GitHub Actions run URLs:

- **CI (Python 3.10/3.11/3.12)**: https://github.com/jgiox/test-gv-python/actions/runs/28152904156 — ✓ success
- **Dependency Review**: https://github.com/jgiox/test-gv-python/actions/runs/28152904169 — ✓ success (PR only, not push)
- **Security scan (CodeQL)**: https://github.com/jgiox/test-gv-python/actions/runs/28152904187 — ✓ success
- **Dependabot**: Fired automatically for github-actions, pip, npm ecosystems — ✓

## Bugs Found and Fixed During Verification

1. **`templates/templates` self-referencing symlink** — Created accidentally when `ln -sf` followed an existing symlink into the target dir. Caused `shutil.copytree` to raise `shutil.Error` mid-copy, preventing the `ci-python.yml → ci.yml` rename from running. Fixed by removing the symlink.

2. **`setup-uv@v8` action tag does not exist** — v8 series uses immutable versioned tags (`v8.0.0`, `v8.1.0`, `v8.2.0`), not major-version aliases. Fixed: pinned to `astral-sh/setup-uv@v8.2.0`.

3. **`security.yml` hardcoded matrix `['javascript-typescript', 'python']`** — Always ran both language analyzers even for single-language projects, causing CodeQL exit 32 ("no source code found"). Fixed: shell step detects languages from actual file extensions at runtime, sets `$GITHUB_OUTPUT`, CodeQL init consumes the output.

## Files Changed (fixes during verification)

- `templates/.github/workflows/ci-python.yml` — `setup-uv@v8` → `v8.2.0`
- `templates/.github/workflows/ci-both.yml` — `setup-uv@v8` → `v8.2.0`
- `templates/.github/workflows/security.yml` — runtime language detection replacing hardcoded matrix
