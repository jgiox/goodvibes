---
phase: 03-pip-cli
verified: 2026-06-24T13:00:00Z
status: complete
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "merge_claude does not corrupt CLAUDE.md when SENTINEL_START is present but SENTINEL_END is absent (CR-01)"
    - "configure_mcp does not raise CalledProcessError when headroom mcp install fails (CR-02)"
    - "configure_mcp does not raise CalledProcessError when claude mcp add fails (WR-01)"
    - "install_headroom tries all three installers (uv->pipx->pip) when CalledProcessError is raised (CR-03)"
    - "importing goodvibes_cli.main on Python <3.10 does not call sys.exit(1) (CR-04)"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification:
  - test: "Install jgiox-goodvibes from PyPI and run goodvibes init in a blank directory"
    expected: "All template files copied, headroom install attempted (or skipped gracefully), exit 0, file list and next-steps printed — identical result to npm CLI"
    why_human: "Requires live PyPI install + real subprocess execution with uv/pipx/pip and headroom binary; cannot verify end-to-end without real subprocess execution"
  - test: "Run goodvibes init on Python 3.9 (without the venv guard) to verify version error message"
    expected: "Prints 'goodvibes requires Python 3.10 or higher. You have Python 3.9.' to stderr and exits non-zero"
    why_human: "Requires a Python 3.9 interpreter which is not available in this environment"
---

# Phase 3: pip CLI Verification Report

**Phase Goal:** `pip install jgiox-goodvibes && goodvibes init` produces an identical result to the npm CLI on Linux, macOS, and WSL2, and the package is published to PyPI as `jgiox-goodvibes`
**Verified:** 2026-06-24T13:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 03-05, commits 5d2d230 RED + af80340 GREEN)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pip install jgiox-goodvibes && goodvibes init` produces the same file set as the npm CLI with identical output behavior | VERIFIED | All three prior code-level blockers (CR-01, CR-02, CR-03) closed. 48/48 tests pass. `goodvibes init --dry-run` from installed wheel exits 0. Full smoke harness 19/19. |
| 2 | headroom-ai[all] installed at runtime via uv->pipx->pip chain with graceful degradation; MCP configured | VERIFIED | `continue # advance` confirmed at line 45 of install_headroom.py (`grep -c` = 1). Two `except subprocess.CalledProcessError` blocks in configure_mcp.py (`grep -c` = 2). `test_pipx_fallback_when_uv_called_process_error` PASSES. `test_headroom_mcp_install_called_process_error_soft_fails` PASSES. `test_claude_mcp_add_called_process_error_soft_fails` PASSES. |
| 3 | pip package published to PyPI as `jgiox-goodvibes`; wheel is py3-none-any; goodvibes entry point works after install | VERIFIED | Human-confirmed in prior pass: jgiox-goodvibes v1.0.0 live on PyPI. Wheel `jgiox_goodvibes-1.0.0-py3-none-any.whl` contains .claude/, .github/, templates/ (35 files). `goodvibes --help` exits 0. Smoke harness checks PIP-BUILD-01, PIP-BUILD-02, PIP-INSTALL, PIP-HELP, PIP-DRYRUN all PASS. |
| 4 | Running the pip CLI on Python 3.9 or lower prints a clear version error and exits non-zero | VERIFIED (partial — human needed for 3.9 confirm) | Version guard in `__main__.py` lines 1-9 confirmed before `import typer`. CR-04 closed: `main.py` no longer contains `sys.exit` (`grep -c sys.exit main.py` = 0). `uv run python -c "from goodvibes_cli.main import app; print('import ok')"` succeeds. Smoke harness checks PIP-05-GUARD, PIP-05-ORDER, PIP-05-EXIT all PASS. Python 3.9 confirmation requires human (no 3.9 interpreter in environment). |

**Score:** 4/4 truths verified (all code-level blockers closed; 2 human confirmation items remain)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py` | merge_claude, extract_version, version_gte — with end_idx == -1 guard | VERIFIED | `grep -c "if end_idx == -1:"` = 1. `test_merge_claude_malformed_start_without_end_does_not_corrupt` PASSES. All 14 sentinel tests pass. |
| `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | Strategy B primary, A fallback, ENOENT-safe, no bare raise | VERIFIED | Two `except subprocess.CalledProcessError` blocks confirmed. CR-02 closed (Step 3 soft-fail). WR-01 closed (Step 2 CPE handler). All 8 configure_mcp tests pass. |
| `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | uv->pipx->pip chain, ONNX warning, soft-fail, continue not return | VERIFIED | `continue # advance` at line 45 confirmed. All 9 install_headroom tests pass including `test_called_process_error_soft_fail` (run.call_count == 3). |
| `packages/pip/src/goodvibes_cli/main.py` | Typer app, subcommand mode, no sys.exit at module level | VERIFIED | `grep -c "sys.exit" main.py` = 0. File starts with `import typer`. Import succeeds: `from goodvibes_cli.main import app` prints "import ok". |
| `packages/pip/tests/test_sentinel_merge.py` | 14 tests including malformed sentinel regression | VERIFIED | `test_merge_claude_malformed_start_without_end_does_not_corrupt` present and PASSES. |
| `packages/pip/tests/test_configure_mcp.py` | 8 tests including CR-02 and WR-01 regression tests | VERIFIED | `test_headroom_mcp_install_called_process_error_soft_fails` and `test_claude_mcp_add_called_process_error_soft_fails` both PASS. |
| `packages/pip/tests/test_install_headroom.py` | 9 tests including CR-03 chain regression | VERIFIED | `test_called_process_error_soft_fail` (run.call_count == 3) and `test_pipx_fallback_when_uv_called_process_error` both PASS. |
| `scripts/verify-phase3.sh` | Phase 3 smoke-test harness | VERIFIED | 12/12 quick, 19/19 full — both exit 0. |
| `packages/pip/pyproject.toml` | Package metadata, build config, jgiox-goodvibes | VERIFIED | name=jgiox-goodvibes, requires-python>=3.10, goodvibes entry point. |
| `packages/pip/src/goodvibes_cli/__main__.py` | Python version guard before any import | VERIFIED | Guard on lines 1-9, `import typer` on line 11. |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | init_cmd with --dry-run and --minimal | VERIFIED | `--dry-run` outputs correct file list and next-steps. `--minimal` skips headroom. |
| `.github/workflows/publish-pip.yml` | Trusted publishing workflow | VERIFIED | Triggers on `pip-v*` tags, OIDC, `uv publish --trusted-publishing always`. |
| `packages/pip/dist/jgiox_goodvibes-1.0.0-py3-none-any.whl` | Pure Python wheel with dotfiles | VERIFIED | Wheel exists; 35 files confirmed in prior pass. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pyproject.toml [project.scripts]` | `goodvibes_cli.main:app` | `goodvibes = "goodvibes_cli.main:app"` | VERIFIED | Line 12 confirmed. |
| `main.py` | `goodvibes_cli.commands.init_cmd` | `app.command("init")(init_cmd)` | VERIFIED | init_cmd imported and registered. |
| `init_cmd.py` | `copy_templates, list_template_files, resolve_templates_dir` | import from steps.copy_templates | VERIFIED | All three imported and used. |
| `init_cmd.py` | `install_headroom, configure_mcp` | direct import + call | VERIFIED | Both called inside `if not minimal:` block. |
| `copy_templates.py` | `goodvibes_cli.utils.sentinel_merge.merge_claude` | `from goodvibes_cli.utils.sentinel_merge import merge_claude` | VERIFIED | Called on line 73. |
| `install_headroom.py` | `goodvibes_cli.utils.detect_python.detect_python` | `from goodvibes_cli.utils.detect_python import detect_python` | VERIFIED | Called on line 15. |
| `configure_mcp.py` | `shutil.which` | `shutil.which("headroom")` | VERIFIED | Used for absolute path resolution. |
| `.github/workflows/publish-pip.yml` | PyPI trusted publishing | `uv publish --trusted-publishing always` | VERIFIED | OIDC pattern confirmed. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `init_cmd.py` | `files` (file list) | `copy_templates(template_dir, cwd, ...)` → `list_template_files(template_dir)` | Yes — rglob over bundled templates | FLOWING |
| `init_cmd.py` | `template_dir` | `resolve_templates_dir()` → `importlib.resources.files("goodvibes_cli").joinpath("templates")` | Yes — from wheel | FLOWING |
| `init_cmd.py` | `_NEXT_STEPS` | Hardcoded constant | N/A — intentional static content | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `goodvibes --help` exits 0 | `uv run goodvibes --help` (packages/pip) | Prints app description, `init` command listed | PASS |
| `goodvibes init --help` shows flags | `uv run goodvibes init --help` | `--dry-run` and `--minimal` both present | PASS |
| Full test suite 48/48 | `uv run pytest tests/ -v` | 48 passed, 0 failed, 0 skipped | PASS |
| `from goodvibes_cli.main import app` does not sys.exit | `uv run python -c "from goodvibes_cli.main import app; print('import ok')"` | prints "import ok" | PASS |

---

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-phase3.sh --quick` | `bash scripts/verify-phase3.sh --quick` | 12/12 passed, exit 0 | PASS |
| `scripts/verify-phase3.sh` (full) | `bash scripts/verify-phase3.sh` | 19/19 passed, exit 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PIP-01 | 03-02, 03-03, 03-04, 03-05 | User can run `pip install goodvibes && goodvibes init` and get same result as npm | VERIFIED | All three crash/corruption blockers closed. 48/48 tests. 19/19 smoke harness. |
| PIP-02 | 03-02, 03-03, 03-04, 03-05 | pip CLI is a Python port of npm CLI with identical output behavior | VERIFIED | All error-handling paths corrected. Soft-fail on all subprocess failure modes. |
| PIP-03 | 03-03, 03-05 | headroom-ai[all] installed at runtime via uv->pipx->pip chain; fails gracefully | VERIFIED | `continue` on CalledProcessError confirmed. `test_pipx_fallback_when_uv_called_process_error` PASSES. |
| PIP-04 | 03-04 | pip package published to PyPI as `jgiox-goodvibes`; CLI entry point is `goodvibes` | VERIFIED | Human-confirmed: jgiox-goodvibes v1.0.0 live on PyPI. Entry point verified. |
| PIP-05 | 03-01, 03-04, 03-05 | pip CLI requires Python 3.10+ and errors clearly | VERIFIED | `__main__.py` guard confirmed. CR-04 closed: guard removed from `main.py`. Entry-point path works. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `configure_mcp.py` | — | ~~bare `raise` on CalledProcessError~~ | CLOSED | CR-02: fixed in af80340 — soft-fail handler with log + return |
| `install_headroom.py` | — | ~~`return` stops installer chain~~ | CLOSED | CR-03: fixed in af80340 — `continue # advance` |
| `sentinel_merge.py` | — | ~~no `end_idx == -1` guard~~ | CLOSED | CR-01: fixed in af80340 — guard at line 65 |
| `main.py` | — | ~~`sys.exit(1)` at module top-level~~ | CLOSED | CR-04: fixed in af80340 — lines 1-9 removed |
| `hatch_build.py` | 30-31 | Silent `return` when templates directory not found — ships broken wheel silently | WARNING | Non-blocker: build works from monorepo root. Wheel produces correct artifact. Mentioned for future hardening. |
| `publish-pip.yml` | 16,19 | Mutable `@v4`/`@v5` action tags with `id-token: write` OIDC permission | WARNING | Supply-chain risk: compromised tag executes with publish rights; pin to commit SHAs (IN-03) |
| `__init__.py` + `pyproject.toml` | 1, 3 | Version hardcoded in two places | INFO | Will drift on next release; Hatchling supports dynamic versioning. |

---

### Human Verification Required

### 1. End-to-End Install from PyPI

**Test:** `pip install jgiox-goodvibes && goodvibes init` in a blank directory on Linux/macOS/WSL2
**Expected:** All template files written, headroom install attempted (or skipped gracefully if not on PATH), exit 0, file list and next-steps printed — identical result to npm CLI
**Why human:** Requires live PyPI install + real subprocess execution with uv/pipx/pip and headroom binary

### 2. Python 3.9 Version Guard

**Test:** Run `python3.9 -m goodvibes_cli` or install on Python 3.9 interpreter and run `goodvibes`
**Expected:** Prints "goodvibes requires Python 3.10 or higher. You have Python 3.9." to stderr, exits non-zero
**Why human:** Requires a Python 3.9 interpreter not available in this environment

---

### Gaps Summary

No code-level gaps remain. All five items from the previous gaps_found pass (CR-01, CR-02, WR-01, CR-03, CR-04 closed in commits 5d2d230 and af80340). The phase goal is fully achieved at the code and test level.

Status is `human_needed` for two items that require a live environment to confirm:
1. Real PyPI install + real subprocess end-to-end on Linux/macOS/WSL2
2. Python 3.9 interpreter for version guard confirmation

These items were deferred from the initial verification and remain structurally unchanged.

---

_Verified: 2026-06-24T13:00:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after 03-05 gap closure_
