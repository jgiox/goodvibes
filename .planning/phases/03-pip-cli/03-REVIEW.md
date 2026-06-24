---
phase: 03-pip-cli
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - scripts/verify-phase3.sh
  - packages/pip/pyproject.toml
  - packages/pip/README.md
  - packages/pip/src/goodvibes_cli/__init__.py
  - packages/pip/src/goodvibes_cli/__main__.py
  - packages/pip/src/goodvibes_cli/utils/__init__.py
  - packages/pip/src/goodvibes_cli/utils/sentinel_merge.py
  - packages/pip/src/goodvibes_cli/utils/detect_python.py
  - packages/pip/src/goodvibes_cli/steps/__init__.py
  - packages/pip/src/goodvibes_cli/steps/copy_templates.py
  - packages/pip/src/goodvibes_cli/steps/install_headroom.py
  - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
  - packages/pip/src/goodvibes_cli/commands/__init__.py
  - packages/pip/src/goodvibes_cli/commands/init_cmd.py
  - packages/pip/src/goodvibes_cli/main.py
  - packages/pip/hatch_build.py
  - packages/pip/tests/conftest.py
  - packages/pip/tests/test_sentinel_merge.py
  - packages/pip/tests/test_copy_templates.py
  - packages/pip/tests/test_install_headroom.py
  - packages/pip/tests/test_configure_mcp.py
  - packages/pip/tests/test_main.py
  - .github/workflows/publish-pip.yml
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the pip CLI package: Typer CLI wiring, sentinel merge utility, file copy orchestrator, headroom installer, MCP configurator, hatch build hook, verification script, and test suite.

Four blocker-level defects found. The most impactful is a data-corruption bug in `sentinel_merge.py` where a missing `SENTINEL_END` in an existing file causes `merge_claude` to compute a wrong `after` slice, silently overwriting user content with garbage. A second blocker is `configure_mcp` re-raising `CalledProcessError` from the fallback path despite its docstring saying "Never raises", which crashes `goodvibes init` with a raw traceback. Third, the `install_headroom` fallback chain stops on the first `CalledProcessError` rather than continuing to `pipx` and `pip`, defeating the purpose of the chain. Fourth, the version guard (`sys.exit(1)`) is duplicated in `main.py` — the actual entry-point module — meaning any library import of `main.py` on Python < 3.10 hard-exits the process. The test suite covers happy paths and fallback-by-ENOENT paths well but has no coverage for the CalledProcessError crash paths identified above.

---

## Critical Issues

### CR-01: `merge_claude` corrupts existing file when `SENTINEL_END` is absent

**File:** `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py:64-76`

**Issue:** `merge_claude` checks `start_idx != -1` (SENTINEL_START present, line 59) and enters Case C logic, but never checks whether `end_idx` is `-1` (SENTINEL_END absent). With `end_idx = -1` and `len(SENTINEL_END) == 22`:

- `existing_block = existing[start_idx : -1 + 22]` — slice ends at position 21, producing a truncated fragment of the file beginning.
- `after = existing[-1 + 22:]` — equals `existing[21:]`, which picks up content starting at position 21 from the start of the file, not from after the missing end marker.

The resulting write silently destroys the user's CLAUDE.md. This triggers on any malformed file (truncated write from a prior crash, manual editing that left an orphan start marker).

Verified by inspection:
```
existing = "before\n<!-- goodvibes:start -->\ntruncated block"
end_idx = -1
existing[start_idx : end_idx + 22]  =>  "<!-- goodvibes"       # garbage
existing[end_idx + 22:]             =>  ":start -->\ntruncated block"  # wrong
```

**Fix:** Add a guard for `end_idx == -1` immediately after computing it:
```python
end_idx = existing.find(SENTINEL_END)
if end_idx == -1:
    # Malformed: start marker present but no end marker.
    # Safe fallback: append fresh block (same as Case B).
    dest_path.write_text(
        existing.rstrip() + "\n\n" + template_block + "\n", encoding="utf-8"
    )
    return
existing_block = existing[start_idx : end_idx + len(SENTINEL_END)]
```

---

### CR-02: `configure_mcp` raises `CalledProcessError` from Step 3 fallback, crashing `goodvibes init`

**File:** `packages/pip/src/goodvibes_cli/steps/configure_mcp.py:79-80`

**Issue:** The module docstring states "Never raises." Line 80 does `raise` on `CalledProcessError` from `headroom mcp install`. `init_cmd` calls `configure_mcp(log_mcp)` with no surrounding `try/except`. A non-zero exit from `headroom mcp install` propagates through Typer and prints a Python traceback to the user — a beginner-hostile crash that contradicts the project's "Fail loud with actionable messages" rule. The test suite has no test for this path.

**Fix:**
```python
    except subprocess.CalledProcessError as e:
        lines = (e.stderr or "").splitlines()
        first_line = lines[0] if lines else "unknown error"
        log(
            f"headroom MCP install failed: {first_line}. "
            "Run `headroom mcp install` manually to complete MCP setup."
        )
        return  # soft-fail — do not propagate
```

---

### CR-03: `install_headroom` fallback chain aborts on `CalledProcessError` instead of trying the next installer

**File:** `packages/pip/src/goodvibes_cli/steps/install_headroom.py:41-46`

**Issue:** The `except subprocess.CalledProcessError` block on lines 41-46 logs an error and `return`s immediately, stopping the chain after the first installer that is found but fails. The docstring describes "uv → pipx → pip fallback chain" but only `FileNotFoundError` actually advances the chain. If `uv` is installed but fails (network timeout, build error), `pipx` and `pip --user` are never tried. The test `test_called_process_error_soft_fail` validates the current (broken) behavior as correct.

**Fix:** Change `return` to `continue` so the chain progresses to the next installer, and move the "all failed" message after the loop:
```python
        except subprocess.CalledProcessError as e:
            lines = (e.stderr or "").splitlines()
            first_line = lines[0] if lines else "unknown error"
            log(f"{cmd_list[0]} install failed: {first_line} — trying next installer")
            continue  # advance to pipx / pip fallback

    # All three installers tried and all failed
    log(
        "headroom install failed with all available installers. "
        'Run manually: uv tool install "headroom-ai[all]"'
    )
```

---

### CR-04: Version guard with `sys.exit(1)` in `main.py` fires on any library import of the module

**File:** `packages/pip/src/goodvibes_cli/main.py:1-9`

**Issue:** The version guard block (lines 1-9) is a copy of the one in `__main__.py`. The console entry point `goodvibes_cli.main:app` causes Python to import `main.py` at module level. Any tool, test, or library that does `from goodvibes_cli.main import app` on Python < 3.10 will hit `sys.exit(1)` — including pytest, build tools, and any downstream package that embeds goodvibes. The correct location for a CLI-only guard is `__main__.py`. The `requires-python = ">=3.10"` constraint in `pyproject.toml` already prevents installation on incompatible interpreters via the entry-point path; the guard in `main.py` is redundant and harmful.

**Fix:** Remove lines 1-9 from `main.py`:
```python
# main.py — remove this entire block:
# import sys
# if sys.version_info < (3, 10):
#     print(...)
#     sys.exit(1)

import typer  # no noqa needed once guard is removed
from goodvibes_cli.commands.init_cmd import init_cmd
```

The guard in `__main__.py` remains as the safety net for `python -m goodvibes_cli` invocations.

---

## Warnings

### WR-01: `configure_mcp` Step 2 does not catch `CalledProcessError` from `claude mcp add`

**File:** `packages/pip/src/goodvibes_cli/steps/configure_mcp.py:50-58`

**Issue:** The `try` block on line 31 that wraps Step 2 only catches `FileNotFoundError` on line 58. If `claude mcp add -s user headroom <path>` returns non-zero (e.g. permission error, quota, unsupported flag in an older claude version), the `CalledProcessError` is not caught and propagates to `init_cmd`, which has no handler. This is a second, distinct crash path from CR-02 (which is about Step 3). Neither is tested.

**Fix:**
```python
    except FileNotFoundError:
        log("claude CLI not found — falling back to headroom mcp install")
        log("Warning: if you use CLAUDE_CONFIG_DIR, you may need to run `headroom mcp install` manually")
    except subprocess.CalledProcessError as e:
        lines = (e.stderr or "").splitlines()
        log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
        log("Run `headroom mcp install` manually.")
        return
```

---

### WR-02: `hatch_build.py` silently returns when templates directory is absent — ships a broken wheel

**File:** `packages/pip/hatch_build.py:30-31`

**Issue:** When neither `../../templates` nor a local `templates/` directory is found, `initialize` returns silently. The wheel builds without a `goodvibes_cli/templates/` directory. At runtime, `resolve_templates_dir()` raises `FileNotFoundError`, which propagates as an unhandled exception through `init_cmd`. The `PIP-DOTFILES` check in `verify-phase3.sh` only runs in full mode (not `--quick`), so a broken wheel can pass the quick gate.

**Fix:**
```python
        else:
            raise RuntimeError(
                "goodvibes templates not found at ../../templates or ./templates. "
                "Run `uv build` from the monorepo root."
            )
```

---

### WR-03: `detect_python` bare `except Exception: continue` silences real OS errors

**File:** `packages/pip/src/goodvibes_cli/utils/detect_python.py:35-36`

**Issue:** The bare `except Exception: continue` on lines 35-36 catches `PermissionError`, `OSError`, and `UnicodeDecodeError`, treating them identically to "Python not found". If all three probes (`python3`, `python`, `py`) fail with `PermissionError`, `detect_python` returns `None` and `install_headroom` logs "Python 3.10+ not found" — even though Python is present but unexecutable. The CLAUDE.md convention is explicit: no swallowed exceptions. The `except Exception` catch is also broader than the documented cases ("ENOENT" and "Windows Store guard") which are already handled by `FileNotFoundError` and the `match` guard above.

**Fix:**
```python
        except FileNotFoundError:
            continue
        except OSError:
            # Covers PermissionError, broken PATH entries on some platforms
            continue
        # Remove: except Exception: continue
```

---

### WR-04: Missing tests for `configure_mcp` crash paths (CR-02 and WR-01)

**File:** `packages/pip/tests/test_configure_mcp.py`

**Issue:** No test covers `headroom mcp install` raising `CalledProcessError` (Step 3 re-raise, CR-02), and no test covers `claude mcp add` raising `CalledProcessError` (Step 2, WR-01). Both are real production paths that crash `goodvibes init`. The test suite passes today only because the crash paths are untested.

**Fix:** Add two tests:
```python
def test_headroom_mcp_install_called_process_error_soft_fails(mocker):
    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list[0] == "claude":
            raise FileNotFoundError
        if cmd_list == ["headroom", "mcp", "install"]:
            raise subprocess.CalledProcessError(1, cmd_list, stderr="install failed")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    mocker.patch("goodvibes_cli.steps.configure_mcp.subprocess.run", side_effect=side_effect)
    log_calls: list[str] = []
    from goodvibes_cli.steps.configure_mcp import configure_mcp
    configure_mcp(log_calls.append)  # must not raise
    assert any("failed" in m or "manually" in m for m in log_calls)

def test_claude_mcp_add_called_process_error_soft_fails(mocker):
    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list == ["claude", "mcp", "list"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
        if cmd_list[:3] == ["claude", "mcp", "add"]:
            raise subprocess.CalledProcessError(1, cmd_list, stderr="permission denied")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    mocker.patch("goodvibes_cli.steps.configure_mcp.subprocess.run", side_effect=side_effect)
    mocker.patch("goodvibes_cli.steps.configure_mcp.shutil.which", return_value="/usr/bin/headroom")
    log_calls: list[str] = []
    from goodvibes_cli.steps.configure_mcp import configure_mcp
    configure_mcp(log_calls.append)  # must not raise
```

---

### WR-05: Missing test for `merge_claude` with malformed sentinel (start present, end absent)

**File:** `packages/pip/tests/test_sentinel_merge.py`

**Issue:** The data-corruption bug from CR-01 has no regression test. The test suite only exercises well-formed sentinels and completely absent sentinels. A malformed file (SENTINEL_START present, SENTINEL_END absent) is a realistic scenario (truncated prior write, manual editing).

**Fix:** Add:
```python
def test_merge_claude_malformed_start_without_end_does_not_corrupt(tmp_dir):
    from goodvibes_cli.utils.sentinel_merge import merge_claude
    dest = tmp_dir / "CLAUDE.md"
    dest.write_text("# User content\n\n<!-- goodvibes:start -->\norphaned start")
    merge_claude(dest, TEMPLATE_CONTENT)
    content = dest.read_text()
    assert "# User content" in content      # user content preserved
    assert SENTINEL_END in content           # end marker now present
    assert content.count(SENTINEL_START) == 1
```

---

## Info

### IN-01: `pytest-asyncio>=0.25` declared as dev dependency but no async tests exist

**File:** `packages/pip/pyproject.toml:34`

**Issue:** No `async def test_*` functions exist in the test suite. Per the Ponytail ruleset, unused dependencies should be removed.

**Fix:** Remove `"pytest-asyncio>=0.25",` from `[project.optional-dependencies] dev`.

---

### IN-02: Version hardcoded in two places — will drift on release

**File:** `packages/pip/pyproject.toml:3` and `packages/pip/src/goodvibes_cli/__init__.py:1`

**Issue:** `version = "1.0.0"` in `pyproject.toml` and `__version__ = "1.0.0"` in `__init__.py` are independent strings. Hatchling supports dynamic versioning from `__init__.py`, eliminating the duplication.

**Fix:**
```toml
[project]
dynamic = ["version"]

[tool.hatch.version]
path = "src/goodvibes_cli/__init__.py"
```
Then remove the static `version = "1.0.0"` line from `[project]`.

---

### IN-03: GitHub Actions workflow uses mutable floating tags

**File:** `.github/workflows/publish-pip.yml:16,19`

**Issue:** `actions/checkout@v4` and `astral-sh/setup-uv@v5` are mutable tag references. The publish workflow holds `id-token: write` (OIDC trusted publishing). A compromised or force-pushed tag would execute attacker-controlled code with publish rights. Pin to commit SHAs for supply-chain integrity.

**Fix:**
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: astral-sh/setup-uv@f0ec1fc3b38f5e7cd731bb6ce540c5af426746bb  # v5.4.1
```

---

_Reviewed: 2026-06-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
