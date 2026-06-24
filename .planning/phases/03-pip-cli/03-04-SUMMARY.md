---
phase: 03-pip-cli
plan: "04"
subsystem: pip-cli-entry-point
tags: [python, typer, rich, cli-wiring, tdd, publish, pypi, trusted-publishing]

dependency_graph:
  requires:
    - phase: 03-01
      provides: packages/pip pyproject.toml, uv sync, __main__.py stub
    - phase: 03-02
      provides: sentinel_merge.py, copy_templates.py
    - phase: 03-03
      provides: detect_python.py, install_headroom.py, configure_mcp.py
  provides:
    - packages/pip/src/goodvibes_cli/commands/__init__.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/src/goodvibes_cli/main.py
    - packages/pip/tests/test_main.py
    - .github/workflows/publish-pip.yml
  affects: [Phase 04 — CI scaffolding]

tech-stack:
  added: []
  patterns:
    - typer-subcommand-mode (callback forcing subcommand dispatch)
    - rich-console-status-spinner (status context manager for each step)
    - rich-console-rule-intro-outro (matching @clack/prompts intro/outro)
    - hatchling-build-hook (copies templates into wheel for both source and sdist builds)
    - oidc-trusted-publishing (publish-pip.yml — no API token in repo)

key-files:
  created:
    - packages/pip/src/goodvibes_cli/commands/__init__.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/src/goodvibes_cli/main.py
    - packages/pip/tests/test_main.py
    - .github/workflows/publish-pip.yml
    - packages/pip/hatch_build.py
  modified:
    - packages/pip/pyproject.toml

key-decisions:
  - "D-11: hatchling build hook (hatch_build.py) used instead of force-include to resolve templates for both source and sdist-derived wheel builds"
  - "D-12: publish-pip.yml triggers on pip-v* tags, uses environment: release for OIDC, no NPM_TOKEN equivalent stored in repo"

requirements-completed: [PIP-01, PIP-02, PIP-04, PIP-05]

duration: "~8 minutes"
completed: "2026-06-24"
---

# Phase 03 Plan 04: main.py + init_cmd.py CLI Wiring + PyPI Publish Summary

**Typer CLI fully wired (main.py + init_cmd.py): goodvibes init --dry-run and --minimal work, Rich spinners and rule() intro/outro, 44 tests pass (0 skipped), wheel built with dotfiles — PyPI publish awaiting human checkpoint.**

## Performance

- **Duration:** ~8 minutes
- **Started:** 2026-06-24T07:30:00Z
- **Completed:** 2026-06-24T07:38:44Z
- **Tasks:** 1 of 2 automated (Task 2 is human checkpoint)
- **Files modified:** 7

## Accomplishments

### Task 1: main.py + init_cmd.py + tests (TDD GREEN)

- `main.py`: `sys.version_info < (3, 10)` guard on lines 1-9 before any other import (D-05); `app = typer.Typer(help=...)` with `@app.callback()` forcing subcommand mode; `app.command("init")(init_cmd)`
- `commands/init_cmd.py`: `--dry-run` (preview files, no writes) and `--minimal` (skip headroom + CI workflows); `console.rule()` intro/outro matching `@clack/prompts intro()/outro()`; `console.status()` spinners for each step; next-steps block identical to npm CLI (ponytail plugin)
- `tests/test_main.py`: 8 tests using `typer.testing.CliRunner`; all steps mocked at module boundary; covers `--help`, `--dry-run`, `--minimal`, `copy_templates` call count, headroom skip, ponytail in output
- TDD: RED commit (b7bd401) → GREEN commit (47ef00b)

### Build fix: hatchling build hook

- `hatch_build.py`: custom hook copies templates into `src/goodvibes_cli/templates/` transiently during both source and sdist-derived wheel builds; cleaned up in `finalize()`
- `pyproject.toml`: registers hook; sdist `force-include` bundles `../../templates` → `templates/` in sdist
- `uv build --no-sources` now produces `dist/jgiox_goodvibes-1.0.0-py3-none-any.whl` with `.claude/` and `.github/` directories confirmed in wheel

### PyPI publish workflow

- `.github/workflows/publish-pip.yml`: triggers on `pip-v*` tags; `environment: release`; `id-token: write` for OIDC; `uv build --no-sources` + `uv publish --trusted-publishing always`; no API token in repo (T-03-04-02 mitigated)

## Task Commits

1. **Task 1 (RED):** `b7bd401` — test(03-04): add failing tests for main.py + init_cmd CLI wiring
2. **Task 1 (GREEN):** `47ef00b` — feat(03-04): implement main.py + init_cmd.py Typer CLI wiring
3. **Publish workflow:** `ce4d512` — chore(03-04): add publish-pip.yml trusted publishing workflow for PyPI
4. **Build fix:** `06c3566` — fix(03-04): hatch build hook so uv build --no-sources produces wheel from sdist

## Verification Results

```
bash scripts/verify-phase3.sh --quick: 12/12 PASS
bash scripts/verify-phase3.sh (full):  19/19 PASS — Phase 3 gate: PASS
uv run pytest tests/ -v:               44 passed, 0 failed, 0 skipped
uv run goodvibes --help:               exits 0, "goodvibes" in output
uv run goodvibes init --help:          "dry-run" and "minimal" in output
dist/jgiox_goodvibes-1.0.0-py3-none-any.whl: exists, .claude/ and .github/ confirmed
```

## Human Checkpoint: PyPI Publish (Task 2)

The wheel is built and verified locally. To publish `jgiox-goodvibes` v1.0.0 to PyPI:

### Step 1 — Set up Trusted Publishing on pypi.org (browser required)
1. Go to https://pypi.org/manage/account/publishing/
2. Under "Add a new pending publisher": fill in:
   - PyPI Project Name: `jgiox-goodvibes`
   - GitHub owner: `jgiox` (or your actual username)
   - Repository name: `goodvibes`
   - Workflow filename: `publish-pip.yml`
   - Environment name: `release`
3. Click "Add"

### Step 2 — Push the release tag
```bash
git tag pip-v1.0.0 && git push origin pip-v1.0.0
```
Or create a GitHub Release via GitHub UI with tag `pip-v1.0.0`.

### Step 3 — Confirm on PyPI
```bash
pip index versions jgiox-goodvibes
# Expected: "jgiox-goodvibes (1.0.0)"
```
Or visit: https://pypi.org/project/jgiox-goodvibes/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] hatchling `uv build --no-sources` failed when building wheel from sdist**
- **Found during:** Full mode verify-phase3.sh (PIP-UV-BUILD check)
- **Issue:** `[tool.hatch.build.targets.wheel.force-include]` used `"../../templates"`, which resolves correctly from the source tree (`packages/pip/` → `GoodVibes/templates`). However, `uv build --no-sources` first builds an sdist, then builds the wheel FROM the sdist in a temp directory. In the sdist extraction context, `../../templates` resolves to a non-existent path inside the temp dir.
- **Fix:** Created `hatch_build.py` — a custom hatchling build hook that checks both `../../templates` (source build) and `templates/` (sdist build) and copies whichever exists into `src/goodvibes_cli/templates/` transiently. Added `force-include` in sdist section to bundle `../../templates` → `templates/` in the sdist.
- **Files modified:** `packages/pip/hatch_build.py` (new), `packages/pip/pyproject.toml` (hook registration + sdist force-include)
- **Commit:** `06c3566`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (`test(...)` commit) | b7bd401 | PASS |
| GREEN (`feat(...)` commit) | 47ef00b | PASS |
| REFACTOR | not needed | N/A |

## Known Stubs

None. The CLI wiring is complete and functional:
- `copy_templates` wired with real templates dir resolution
- `install_headroom` and `configure_mcp` wired (mocked only in tests)
- Output panels populated with real data (not hardcoded)

## Threat Surface Scan

No new security-relevant surface beyond what was in the threat model:
- `T-03-04-02` (Repudiation — PyPI publish without trusted publishing): **mitigated** — `publish-pip.yml` uses `--trusted-publishing always` + `id-token: write` OIDC, no token in repo
- `T-03-04-SC` (npm/pip/cargo installs): **mitigated** — no new runtime deps added; hatchling hook is a build-time dependency already in `[build-system] requires`

No new endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- packages/pip/src/goodvibes_cli/commands/__init__.py: EXISTS
- packages/pip/src/goodvibes_cli/commands/init_cmd.py: EXISTS, exports init_cmd
- packages/pip/src/goodvibes_cli/main.py: EXISTS, sys.version_info guard on lines 1-9
- packages/pip/tests/test_main.py: EXISTS, 8 tests, 0 skipped
- .github/workflows/publish-pip.yml: EXISTS, contains "trusted-publishing"
- packages/pip/hatch_build.py: EXISTS, registered in pyproject.toml
- dist/jgiox_goodvibes-1.0.0-py3-none-any.whl: EXISTS, .claude/ and .github/ in wheel
- Commits: b7bd401, 47ef00b, ce4d512, 06c3566 — all verified in git log

---
*Phase: 03-pip-cli*
*Completed: 2026-06-24*
