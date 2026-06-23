#!/usr/bin/env bash
set -e

pass=0; fail=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "PASS [$1]"
    pass=$((pass + 1))
  else
    echo "FAIL [$1]: $2"
    fail=$((fail + 1))
  fi
}

check "CLAUDEMD-01" "test -f templates/CLAUDE.md"
check "CLAUDEMD-02" "[ \$(wc -l < templates/CLAUDE.md) -le 100 ] && [ \$(wc -l < templates/CLAUDE.md) -ge 80 ]"
check "CLAUDEMD-03" "grep -q 'goodvibes: v1.0.0' templates/CLAUDE.md"
check "CLAUDEMD-04" "grep -q 'goodvibes:start' templates/CLAUDE.md"
check "CLAUDEMD-05" "grep -q 'Think before' templates/CLAUDE.md && grep -q 'Simplicity' templates/CLAUDE.md"
check "CAV-01"      "test -d templates/.claude/skills/caveman"
check "CAV-02"      "grep -q 'Julius Brussee' NOTICE"
check "HYG-01"      "test -d templates/.claude/skills/goodvibes-hygiene"
check "HYG-03"      "grep -q 'plugin marketplace add' templates/.claude/skills/goodvibes-hygiene/SKILL.md"
check "DOCS-01"     "test -f templates/CONTRIBUTING.md && ! grep -q 'TODO\|YOUR_PROJECT' templates/CONTRIBUTING.md"
check "DOCS-02"     "test -f templates/SECURITY.md"
check "DOCS-03"     "test -f templates/JOURNAL.md"
check "DOCS-04"     "test -f templates/CHANGELOG.md"
check "DOCS-05"     "test -f templates/.github/ISSUE_TEMPLATE/bug_report.yml && test -f templates/.github/ISSUE_TEMPLATE/feature_request.yml"
check "DOCS-06"     "test -f templates/.github/PULL_REQUEST_TEMPLATE.md"
check "DOCS-07"     "test -f templates/docs/onboarding.md"
check "REPO-01"     "test -f LICENSE"
check "REPO-02"     "test -f NOTICE"
check "REPO-03"     "grep -q 'npx goodvibes init' README.md"

echo ""
echo "Results: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "Phase 1 gate: PASS" || { echo "Phase 1 gate: FAIL"; exit 1; }
