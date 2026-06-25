#!/usr/bin/env bash

cd "$(dirname "$0")/.."

QUICK=0
for arg in "$@"; do
  if [ "$arg" = "--quick" ]; then
    QUICK=1
  fi
done

set -euo pipefail

pass=0; fail=0

check() {
  if bash -c "$2" > /dev/null 2>&1; then
    echo "PASS [$1]"
    pass=$((pass + 1))
  else
    echo "FAIL [$1]: $2"
    fail=$((fail + 1))
  fi
}

# -----------------------------------------------------------------------
# File existence checks (always run, --quick safe)
# -----------------------------------------------------------------------

check "UPGRADE-TS"        "test -f packages/npm/src/commands/upgrade.ts"
check "UPGRADE-TEST-TS"   "test -f packages/npm/src/commands/upgrade.test.ts"
check "UPGRADE-PY"        "test -f packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py"
check "UPGRADE-TEST-PY"   "test -f packages/pip/tests/test_upgrade_cmd.py"
check "VERIFY-PHASE5"     "test -f scripts/verify-phase5.sh"

# -----------------------------------------------------------------------
# Content correctness checks (always run, --quick safe)
# -----------------------------------------------------------------------

# Use grep -v '^#' | grep -q to exclude comment lines (T-05-01)
check "UPGRADE-IN-INDEX"   "grep -v '^#' packages/npm/src/index.ts | grep -q 'registerUpgradeCommand'"
check "UPGRADE-IN-MAIN"    "grep -v '^#' packages/pip/src/goodvibes_cli/main.py | grep -q 'upgrade_cmd'"
check "UPGRADE-DRY-RUN-TS" "grep -q 'dry-run' packages/npm/src/commands/upgrade.ts"
check "UPGRADE-DRY-RUN-PY" "grep -q 'dry.run' packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py"
check "UPGRADE-MANAGED-TS" "grep -q '\.claude/skills' packages/npm/src/commands/upgrade.ts"

# -----------------------------------------------------------------------
# Unit test checks (only without --quick)
# -----------------------------------------------------------------------

if [ "$QUICK" -eq 0 ]; then
  echo ""
  echo "--- Unit test checks (full mode) ---"

  check "NPM-TESTS"  "cd packages/npm && npm test"
  check "PIP-TESTS"  "cd packages/pip && uv run --extra dev pytest tests/ -x -q"

  echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo ""
echo "Results: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then
  echo "Phase 5 gate: PASS"
else
  echo "Phase 5 gate: FAIL" >&2
  exit 1
fi
