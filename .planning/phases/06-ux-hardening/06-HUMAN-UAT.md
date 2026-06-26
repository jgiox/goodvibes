---
status: partial
phase: 06-ux-hardening
source: [06-VERIFICATION.md]
started: 2026-06-26T12:55:00Z
updated: 2026-06-26T12:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Non-empty notice appears before spinners
expected: When running `goodvibes init` in a non-empty directory, the "Non-empty project detected" notice appears visually before the spinner tasks begin
result: [pending]

### 2. --minimal shows "Skipped layers" panel
expected: Running `goodvibes init --minimal` displays a "Skipped layers" Rich/clack panel explaining how to add CI/docs later
result: [pending]

### 3. Second run reports ci.yml as skipped, not overwritten
expected: Running `goodvibes init` twice — on the second run, ci.yml is reported in the "Files skipped" count, not overwritten
result: [pending]

### 4. --dry-run --minimal excludes CI and docs from preview
expected: Running `goodvibes init --dry-run --minimal` shows template file list without .github/ or docs/ entries
result: [pending]

### 5. EACCES produces plain-English message, no stack trace
expected: When a permission error occurs during file copy, user sees a plain-English error message (not a stack trace), and process exits with code 1
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
