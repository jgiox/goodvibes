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

check "CI-NODE-YML"      "test -f templates/.github/workflows/ci-node.yml"
check "CI-PYTHON-YML"    "test -f templates/.github/workflows/ci-python.yml"
check "CI-BOTH-YML"      "test -f templates/.github/workflows/ci-both.yml"
check "SECURITY-YML"     "test -f templates/.github/workflows/security.yml"
check "DEP-REVIEW-YML"   "test -f templates/.github/workflows/dependency-review.yml"
check "DEPENDABOT-YML"   "test -f templates/.github/dependabot.yml"
check "FILE-SIZE-YML"    "test -f templates/.github/workflows/file-size.yml && test -f templates/.github/scripts/check-file-sizes.mjs"

# -----------------------------------------------------------------------
# Content correctness checks (always run, --quick safe)
# -----------------------------------------------------------------------

check "CI-NODE-IF-PRESENT"   "grep -q '\-\-if-present' templates/.github/workflows/ci-node.yml"
check "CI-PYTHON-UV-RUN"     "grep -q 'uv run pytest' templates/.github/workflows/ci-python.yml && ! grep -q '\-\-extra dev' templates/.github/workflows/ci-python.yml"
check "CI-PYTHON-MATRIX"     "grep -q 'python-version:' templates/.github/workflows/ci-python.yml"
check "SECURITY-EXTENDED"    "grep -q 'queries: security-extended' templates/.github/workflows/security.yml"
check "DEP-REVIEW-PR"        "grep -q 'pull_request' templates/.github/workflows/dependency-review.yml"
# dependency-review.yml must NOT have a push: trigger
check "DEP-REVIEW-NO-PUSH"   "! grep -q 'push:' templates/.github/workflows/dependency-review.yml"
check "DEPENDABOT-ACTIONS"   "grep -q 'github-actions' templates/.github/dependabot.yml"
# The template lists only github-actions; init and update add npm, uv or pip from the project's files.
check "DEPENDABOT-ACTIONS-ONLY" "test \"\$(grep -c 'package-ecosystem:' templates/.github/dependabot.yml)\" -eq 1"

# -----------------------------------------------------------------------
# Unit test checks (only without --quick)
# -----------------------------------------------------------------------

if [ "$QUICK" -eq 0 ]; then
  echo ""
  echo "--- Unit test checks (full mode) ---"

  check "NPM-TESTS"  "cd packages/npm && npm test"
  check "PIP-TESTS"  "cd packages/pip && uv run --extra dev pytest tests/ -x -q"
  check "DEPENDABOT-BY-PROJECT-NPM" "cd packages/npm && npx vitest run src/utils/detect-project-type.test.ts src/steps/copy-templates.integration.test.ts -t 'ependabot'"
  check "DEPENDABOT-BY-PROJECT-PIP" "cd packages/pip && uv run --extra dev pytest tests/test_detect_project_type.py tests/test_copy_templates.py -q -o addopts='' -k dependabot"

  echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo ""
echo "Results: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then
  echo "Phase 4 gate: PASS"
else
  echo "Phase 4 gate: FAIL" >&2
  exit 1
fi
