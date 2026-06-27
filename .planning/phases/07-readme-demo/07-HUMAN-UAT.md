---
status: partial
phase: 07-readme-demo
source: [07-VERIFICATION.md]
started: 2026-06-27T02:35:00Z
updated: 2026-06-27T02:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. docs/demo.gif production via CI
expected: After pushing scripts/demo.tape to main, vhs.yml triggers automatically, runs `vhs scripts/demo.tape`, commits `docs/demo.gif` back to main. GIF is < 2MB, shows dark Dracula terminal, `npx goodvibes init --minimal --dry-run` typed, written/skipped counts visible in completion output, no npm download noise.
result: [pending]

### 2. `npx goodvibes init` command scoping check
expected: The README shows `npx goodvibes init`. This must resolve correctly — either the unscoped `goodvibes` package name is reserved/available on npm for this project, or the command should be `npx @jgiox/goodvibes init`. Verify: `npm show goodvibes` returns no conflicting package OR `npm show @jgiox/goodvibes` confirms the scoped package is the one to use.
result: [pending]

### 3. Shields.io badges live resolution
expected: On github.com/jgiox/goodvibes, all four badges display real data: npm version badge shows current version, PyPI version badge shows current version, CI badge shows passing/green, License badge shows Apache 2.0. No gray "error" shields.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
