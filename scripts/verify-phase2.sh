#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

QUICK=0
for arg in "$@"; do
  if [ "$arg" = "--quick" ]; then
    QUICK=1
  fi
done

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
# Static checks (always run, --quick safe)
# -----------------------------------------------------------------------

# NPM-08 / NPM-09: package.json exists
check "NPM-PKG-01" "test -f packages/npm/package.json"

# NPM-11: name field is "goodvibes"
check "NPM-PKG-02" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.name==='goodvibes'?0:1)\""

# NPM-01: bin.goodvibes points to ./dist/index.js
check "NPM-PKG-03" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.bin&&p.bin.goodvibes==='./dist/index.js'?0:1)\""

# NPM-08: engines.node contains >=20
check "NPM-PKG-04" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.engines&&p.engines.node&&p.engines.node.indexOf('>=20')!==-1?0:1)\""

# HDR-06: package.json does NOT contain scripts.postinstall
check "HDR-06" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.scripts&&p.scripts.postinstall?1:0)\""

# NPM-08: src/index.ts exists
check "NPM-08-SRC" "test -f packages/npm/src/index.ts"

# NPM-08: src/index.ts starts with shebang on line 1
check "NPM-08-SHEBANG" "head -1 packages/npm/src/index.ts | grep -q '#!/usr/bin/env node'"

# NPM-08: src/index.ts contains process.version (Node version check)
check "NPM-08-VERSION" "grep -q 'process.version' packages/npm/src/index.ts"

# NPM-09: tsup.config.ts exists
check "NPM-09-TSUP" "test -f packages/npm/tsup.config.ts"

# NPM-09: tsup.config.ts references src/index.ts
check "NPM-09-ENTRY" "grep -q 'src/index.ts' packages/npm/tsup.config.ts"

# NPM-09: tsconfig.json exists
check "NPM-09-TSCONFIG" "test -f packages/npm/tsconfig.json"

# NPM-02 / NPM-03 / NPM-04 / NPM-05: vitest.config.ts exists
check "NPM-TEST-CFG" "test -f packages/npm/vitest.config.ts"

# NPM-08: version check appears BEFORE the first import statement
check "NPM-08-ORDER" "
  idx_version=\$(grep -n 'process.version' packages/npm/src/index.ts | head -1 | cut -d: -f1)
  idx_import=\$(grep -n '^import ' packages/npm/src/index.ts | head -1 | cut -d: -f1)
  [ -n \"\$idx_version\" ] && [ -n \"\$idx_import\" ] && [ \"\$idx_version\" -lt \"\$idx_import\" ]
"

# HDR-06: npm pkg get scripts.postinstall returns empty string (no postinstall hook)
check "HDR-06-PKG" "cd packages/npm && result=\$(npm pkg get scripts.postinstall 2>/dev/null); [ \"\$result\" = '{}' ] || [ -z \"\$result\" ]"

# NPM-06: --dry-run option mentioned in src/index.ts (stub wired)
check "NPM-06-DRYRUN-SRC" "grep -q 'dry-run' packages/npm/src/index.ts"

# NPM-07: --minimal option mentioned in src/index.ts (stub wired)
check "NPM-07-MINIMAL-SRC" "grep -q 'minimal' packages/npm/src/index.ts"

# NPM-10: execa dependency present in package.json (cross-spawn met via execa)
check "NPM-10-EXECA" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.dependencies&&p.dependencies.execa?0:1)\""

# HDR-01: uv/pipx/pip install chain — package.json has execa dep (runtime prerequisite)
check "HDR-01-EXECA-DEP" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.dependencies&&p.dependencies.execa?0:1)\""

# HDR-02: detect-python test stub exists (covers Python detection)
check "HDR-02-TEST-STUB" "test -f packages/npm/src/utils/detect-python.test.ts"

# HDR-03: install-headroom test stub exists (covers ONNX warning)
check "HDR-03-TEST-STUB" "test -f packages/npm/src/steps/install-headroom.test.ts"

# HDR-04: configure-mcp test stub exists (covers MCP registration)
check "HDR-04-TEST-STUB" "test -f packages/npm/src/steps/configure-mcp.test.ts"

# HDR-05: configure-mcp test stub covers idempotency
check "HDR-05-TEST-STUB" "grep -q 'already' packages/npm/src/steps/configure-mcp.test.ts"

# NPM-04: completion file-list requirement — init.test.ts stub exists
check "NPM-04-TEST-STUB" "test -f packages/npm/src/commands/init.test.ts"

# NPM-05: next-steps requirement — init.test.ts mentions next-steps
check "NPM-05-TEST-STUB" "grep -q 'next-steps\|Next steps' packages/npm/src/commands/init.test.ts"

# NPM-11: package name is "goodvibes" (publish target check)
check "NPM-11-NAME" "node -e \"const p=JSON.parse(require('fs').readFileSync('packages/npm/package.json','utf8'));process.exit(p.name==='goodvibes'?0:1)\""

# -----------------------------------------------------------------------
# Build checks (only without --quick)
# -----------------------------------------------------------------------

if [ "$QUICK" -eq 0 ]; then
  echo ""
  echo "--- Build checks (full mode) ---"

  # NPM-09: npm install runs successfully
  check "NPM-INSTALL" "cd packages/npm && npm install --silent 2>/dev/null"

  # NPM-09: npm run build succeeds and produces dist/index.js
  check "NPM-BUILD" "cd packages/npm && npm run build --silent 2>/dev/null && test -f dist/index.js"

  # NPM-08: dist/index.js starts with shebang on line 1
  check "NPM-SHEBANG-DIST" "head -1 packages/npm/dist/index.js | grep -q '#!/usr/bin/env node'"

  # NPM-01: node dist/index.js --help exits 0 and prints "goodvibes"
  check "NPM-01-HELP" "node packages/npm/dist/index.js --help 2>&1 | grep -q 'goodvibes'"

  # NPM-06: node dist/index.js init --help prints "dry-run"
  check "NPM-06-DRYRUN" "node packages/npm/dist/index.js init --help 2>&1 | grep -q 'dry-run'"

  # NPM-07: node dist/index.js init --help prints "minimal"
  check "NPM-07-MINIMAL" "node packages/npm/dist/index.js init --help 2>&1 | grep -q 'minimal'"

  # NPM-02: npm test exits 0 (todo stubs pass, zero-config verification)
  check "NPM-02-TEST" "cd packages/npm && npm test --silent 2>/dev/null"

  echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo ""
echo "Results: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then
  echo "Phase 2 gate: PASS"
else
  echo "Phase 2 gate: FAIL" >&2
  exit 1
fi
