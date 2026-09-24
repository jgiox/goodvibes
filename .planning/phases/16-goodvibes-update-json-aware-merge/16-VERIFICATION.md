---
phase: 16-goodvibes-update-json-aware-merge
verified: 2026-09-24T21:40:00Z
status: passed
score: 4/4 success criteria verified
human_verification:
  - test: "pip install the built wheel, init a blank project, hand-edit settings.json, run `goodvibes update --dry-run` then `update`"
    expected: "Same merge result as the npm tarball run below"
    why_human: "pip path covered by pytest real-tmpdir tests, not by an installed-wheel run"
---

# Phase 16 Verification: goodvibes update JSON-Aware Merge

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Hand-edited settings.json: only goodvibes keys added/updated, user keys untouched | VERIFIED | npm `update.integration.test.ts` "adds the journal-gate hook and ask rules to a hand-edited settings.json..."; pip `test_update_merges_journal_gate_and_ask_rules_into_hand_edited_settings`; unit tests for in-place hook replacement next to a user hook |
| 2 | Hand-edited .mcp.json: only context7 added/updated, other servers untouched | VERIFIED | "adds context7 to a user .mcp.json that init never recorded..." (npm, pip); unit test keeps user `headers` on context7 |
| 3 | `--dry-run` previews exact JSON keys, writes nothing | VERIFIED | dry-run tests assert `+ hooks.PreToolUse: goodvibes-journal-gate` and unchanged file bytes (npm, pip) |
| 4 | Untouched files keep whole-file categorization | VERIFIED | "still overwrites an untouched settings.json whole-file" (npm, pip) |

Additional: opt-out survives (`does not re-add the journal-gate hook after the user deleted it`), invalid JSON left unchanged and reported.

## Evidence (2026-09-24)

```
packages/npm$ npx vitest run      Tests  203 passed | 1 skipped | 2 todo
packages/pip$ uv run --extra dev pytest tests/      204 passed
```

Packed tarball (`npm pack`) installed to a temp prefix, blank project:

```
init --minimal                 exit 0; .goodvibes.json version 1.7.1, managed {settings.json: 25, .mcp.json: 1}
(hand-edit: drop hooks, keep 2 ask rules, add Bash(make*), replace servers with postgres, strip `managed`)
update --dry-run               + 20 permissions.ask entries, + hooks.PreToolUse: goodvibes-journal-gate, + mcpServers.context7
update --force                 exit 0; Bash(make*) kept; hook back; ask 22; mcp [context7, postgres]
```

Published `goodvibes-cli@1.7.1` reproduced the init crash (exit 1, no manifest) before the fix.

## Known limits

- Formatting of a merged file is normalised to 2-space JSON.
- A 1.7.x project that deliberately removed a template deny rule before 1.8 gets it back once, because 1.7.x manifests have no managed record; dry-run shows it.
