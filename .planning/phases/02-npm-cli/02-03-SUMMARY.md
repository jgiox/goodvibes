---
phase: 02-npm-cli
plan: "03"
subsystem: cli-tooling
tags: [typescript, execa, python-detection, headroom, mcp, vitest, subprocess, install-chain]

dependency_graph:
  requires:
    - phase: 02-npm-cli
      plan: "01"
      provides: packages/npm scaffold, vitest config, Wave 0 todo-stub test files
  provides:
    - packages/npm/src/utils/detect-python.ts (Python 3.10+ detection with ENOENT + Windows Store guard)
    - packages/npm/src/steps/install-headroom.ts (uv→pipx→pip install chain with graceful Python-absent skip)
    - packages/npm/src/steps/configure-mcp.ts (idempotent MCP registration Strategy B primary, Strategy A fallback)
    - packages/npm/src/utils/detect-python.test.ts (7 passing unit tests with mocked execa)
    - packages/npm/src/steps/install-headroom.test.ts (6 passing unit tests with mocked execa)
    - packages/npm/src/steps/configure-mcp.test.ts (5 passing unit tests with mocked execa)
  affects:
    - 02-04 (init command wiring — will import installHeadroom and configureMcp)
    - Phase 5 (upgrade command — may reuse detectPython)

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: test file committed first (fails), then implementation committed (passes)"
    - "log parameter pattern: all step functions accept log(msg) instead of console.log — enables test assertion on output without side effects"
    - "ENOENT guard pattern: catch unknown error, cast to NodeJS.ErrnoException, check .code === ENOENT, then continue/re-throw"
    - "Two-layer idempotency in configureMcp: headroom mcp status (exit 0) AND claude mcp list stdout includes 'headroom'"
    - "which/where dispatch: process.platform === 'win32' → where, otherwise which — for absolute path resolution"
    - "No shell:true anywhere — all execa calls use args array; bracket chars like [all] passed verbatim to subprocess"

key-files:
  created:
    - packages/npm/src/utils/detect-python.ts
    - packages/npm/src/steps/install-headroom.ts
    - packages/npm/src/steps/configure-mcp.ts
    - packages/npm/src/utils/detect-python.test.ts
    - packages/npm/src/steps/install-headroom.test.ts
    - packages/npm/src/steps/configure-mcp.test.ts
  modified: []

key-decisions:
  - "detectPython checks both stdout and stderr for version string — Python < 3.4 printed 'Python X.Y.Z' to stderr; both must be checked"
  - "Windows Store guard implemented by validating output matches /Python \\d+\\.\\d+/ before accepting — empty/non-version output treated as not found"
  - "installHeadroom graceful-degrade on all-ENOENT: logs warning and returns void rather than throwing — per HDR-02 spirit"
  - "configureMcp: Strategy B primary (claude mcp add -s user) avoids CLAUDE_CONFIG_DIR bug (headroom issue #872); Strategy A (headroom mcp install) is fallback only"
  - "Absolute path from which/where passed as discrete array element to execa — never interpolated into shell string (T-02-03-B)"
  - "ONNX warning printed BEFORE the install subprocess runs (HDR-03) — verified in test by asserting log was called before execa mock executes"

patterns-established:
  - "Pattern: log(msg) parameter for all step functions (installHeadroom, configureMcp) — caller provides the output function, enables test isolation"
  - "Pattern: ordered installer probe loop with ENOENT continue + other-error re-throw (uv → pipx → pip)"
  - "Pattern: two-layer idempotency guard for external state (exit-code check + stdout grep)"

requirements-completed:
  - HDR-01
  - HDR-02
  - HDR-03
  - HDR-04
  - HDR-05
  - HDR-06

duration: 12min
completed: "2026-06-23"
---

# Phase 02 Plan 03: headroom Integration — Python Detection, Install Chain, MCP Registration Summary

**Python 3.10+ detection with Windows Store guard, uv→pipx→pip install chain with graceful Python-absent skip, and idempotent MCP registration using `claude mcp add -s user` with absolute headroom path**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-23T12:38:00Z
- **Completed:** 2026-06-23T12:42:00Z
- **Tasks:** 2
- **Files modified:** 6 created

## Accomplishments

- Implemented `detectPython()` probing python3→python→py with ENOENT handling, version 3.10+ gate, stderr fallback (Python < 3.4 compat), and Windows Store guard (validates output matches `/Python \d+\.\d+/` before accepting)
- Implemented `installHeadroom(log)` with uv→pipx→pip fallback chain; always uses `headroom-ai[all]`; prints ONNX model warning before install; returns gracefully when Python absent or all installers ENOENT (never throws, never exits 1)
- Implemented `configureMcp(log)` with two-layer idempotency (mcp status + mcp list), Strategy B primary (claude mcp add -s user with absolute path via which/where), Strategy A fallback (headroom mcp install) with CLAUDE_CONFIG_DIR warning
- 18 unit tests across 3 files all passing; npm test exits 0; zero shell:true anywhere in packages/npm/src/

## Task Commits

Each task followed RED/GREEN TDD cycle:

1. **Task 1 RED: Failing tests for detect-python and install-headroom** — `fc1ed59` (test)
2. **Task 1 GREEN: Implement detect-python.ts and install-headroom.ts** — `51f6e2a` (feat)
3. **Task 2 RED: Failing tests for configure-mcp** — `da55270` (test)
4. **Task 2 GREEN: Implement configure-mcp.ts** — `6673e81` (feat)

## Files Created/Modified

- `packages/npm/src/utils/detect-python.ts` — Python 3.10+ detection via execa probes; handles ENOENT, version parse, Windows Store guard, stdout+stderr
- `packages/npm/src/steps/install-headroom.ts` — uv→pipx→pip chain; headroom-ai[all] in all paths; ONNX warning before install; graceful Python-absent skip
- `packages/npm/src/steps/configure-mcp.ts` — Idempotent MCP registration; Strategy B primary (claude mcp add -s user + absolute path); Strategy A fallback; CLAUDE_CONFIG_DIR warning
- `packages/npm/src/utils/detect-python.test.ts` — 7 tests: python3 found, python fallback, 2.7 too old, Windows Store guard, all ENOENT, minor < 10, stderr check
- `packages/npm/src/steps/install-headroom.test.ts` — 6 tests: Python-absent skip, uv install, pipx fallback, pip fallback, ONNX warning order, all-ENOENT graceful
- `packages/npm/src/steps/configure-mcp.test.ts` — 5 tests: mcp status idempotency, claude mcp add primary, mcp list idempotency, ENOENT fallback with CLAUDE_CONFIG_DIR warning, absolute path as discrete arg

## Decisions Made

1. **log(msg) parameter pattern:** Step functions accept a `log: (msg: string) => void` parameter rather than calling `console.log` directly. This enables test assertions on output without stdout/stderr side effects. Callers (the init command in 02-04) will pass `@clack/prompts` output or console.error.

2. **All-ENOENT graceful return in installHeadroom:** When uv, pipx, and pip are all ENOENT, the function logs a warning and returns void rather than throwing. This honors HDR-02's "exits 0 and prints plain-English skip message when Python is absent" spirit — the user's machine simply lacks a supported Python installer at this time.

3. **Two-layer idempotency in configureMcp:** Uses both `headroom mcp status` (exit 0) AND `claude mcp list` stdout grep for 'headroom'. Belt-and-suspenders because the two commands represent different views of registration state (headroom's own status vs. Claude Code's registration list).

4. **Windows Store guard via regex validation:** Rather than trying to detect Windows or intercept a Store redirect URL, the guard simply requires output to match `/Python \d+\.\d+/`. Any output that doesn't match (empty string, Store URL, error text) is treated as "not found" and the next probe is attempted.

## Deviations from Plan

None — plan executed exactly as written. All behaviors from the plan's `<behavior>` blocks are covered by tests, and all tests pass.

## Issues Encountered

None. All 4 commits (2 RED, 2 GREEN) applied cleanly. The `vi.mock` module hoisting in vitest required using `vi.resetAllMocks()` in `beforeEach` to prevent test cross-contamination when the mocked module is imported inside each test (dynamic import pattern). This is standard vitest idiom for ESM mocking and required no plan deviation.

## Known Stubs

None. All three modules export real implementations. No placeholder values, hardcoded empty returns, or TODO markers in the created files.

## Threat Surface Scan

No new threat surface beyond what is in the plan's `<threat_model>`. All STRIDE threats documented in the plan are mitigated:
- T-02-03-A (command injection): all execa calls use args arrays, zero shell:true
- T-02-03-B (path injection from which/where): absolute path passed as discrete array element, never shell-interpolated
- T-02-03-C (bracket chars in [all]): execa passes to subprocess directly, no shell expansion
- T-02-03-D (pip --user elevation): accepted — installs to user's local site-packages as intended
- T-02-03-E (log messages): status text only, no credentials or PII

## User Setup Required

None — no external service configuration required. headroom and claude CLI are probed at runtime during `goodvibes init`; their absence is handled gracefully.

## Next Phase Readiness

- 02-04 (init command wiring) can import `installHeadroom` and `configureMcp` with their `log` parameter pattern
- All 6 Wave 1 test files now have real implementations replacing todos; `npm test` exits 0 with 40 passing tests
- `packages/npm/src/steps/copy-templates.ts` (from 02-02) and the three files from this plan complete the steps/ directory — the init command handler in 02-04 has all step functions available

---
*Phase: 02-npm-cli*
*Completed: 2026-06-23*

## Self-Check: PASSED

- packages/npm/src/utils/detect-python.ts exists: FOUND
- packages/npm/src/steps/install-headroom.ts exists: FOUND
- packages/npm/src/steps/configure-mcp.ts exists: FOUND
- packages/npm/src/utils/detect-python.test.ts exists: FOUND
- packages/npm/src/steps/install-headroom.test.ts exists: FOUND
- packages/npm/src/steps/configure-mcp.test.ts exists: FOUND
- Commit fc1ed59 exists: FOUND
- Commit 51f6e2a exists: FOUND
- Commit da55270 exists: FOUND
- Commit 6673e81 exists: FOUND
- npm test exits 0: VERIFIED (40 passing, 5 test files passing)
