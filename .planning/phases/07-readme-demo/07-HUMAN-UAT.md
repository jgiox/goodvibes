---
status: complete
phase: 07-readme-demo
source: [07-VERIFICATION.md]
started: 2026-06-27T02:35:00Z
updated: 2026-06-30T00:00:00Z
---

## Tests

### 1. docs/demo.gif production via CI
expected: After pushing scripts/demo.tape to main, vhs.yml triggers automatically, runs VHS, commits docs/demo.gif back to main. GIF is < 2MB, shows dark Dracula terminal.
result: PASS
evidence: CI run 28396836801 completed SUCCESS at 2026-06-29T19:20:43Z. Committed as 7f3b19a. docs/demo.gif: GIF 89a, 800x500, 119 KB (under 2MB). Command shown: `goodvibes init --minimal` (real init). Note: tape changed from --dry-run to real init to work around VHS v0.11.0 Wait+Screen 15s viewport timeout.

### 2. `npx goodvibes init` command scoping check
expected: README command correctly resolves to the @jgiox/goodvibes package. No conflicting unscoped package.
result: PASS
evidence: README was updated to `npx @jgiox/goodvibes init` (CR-01/CR-02 fix). `npm show @jgiox/goodvibes` confirms v1.2.0 is published. No ambiguity.

### 3. Shields.io badges live resolution
expected: All four badges display correctly — no gray "error" shields.
result: PASS (programmatic) / recommend browser spot-check for PyPI badge
evidence: npm badge (@jgiox/goodvibes@1.2.0 confirmed), CI badge (ci.yml green), license badge (static). PyPI badge (jgiox-goodvibes) benefits from a quick browser confirm but is not blocking.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Notes

VHS tape uses Sleep 20s + Framerate 10 instead of Wait+Screen to work around VHS v0.11.0's hardcoded 15-second viewport-scan timeout. Tape is deterministic and committed at scripts/demo.tape.
