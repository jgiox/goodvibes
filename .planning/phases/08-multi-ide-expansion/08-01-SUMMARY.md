---
phase: 08-multi-ide-expansion
plan: "01"
subsystem: templates
tags: [cursor, copilot, windsurf, kiro, ide-rules, mdc, markdown]

requires:
  - phase: 06-ux-hardening
    provides: copy-templates.ts with overwrite:false + minimal filter that auto-handles IDE files

provides:
  - templates/.cursor/rules/goodvibes.mdc with alwaysApply:true (Cursor always-on rules)
  - templates/.github/copilot-instructions.md plain markdown (GitHub Copilot repo-wide instructions)
  - templates/.windsurfrules plain markdown under 3000 chars (Windsurf/Devin Desktop rules)
  - templates/.kiro/steering/goodvibes.md with inclusion:always (Kiro always-on steering)

affects:
  - 08-02 (test coverage for IDE file copy/skip behavior)
  - 08-03 (README IDE compatibility table)

tech-stack:
  added: []
  patterns:
    - "IDE rule files are write-once no-clobber; excluded from MANAGED_FIXED so goodvibes upgrade never overwrites user edits"
    - "Cursor requires .mdc extension; Kiro requires frontmatter on line 1 with no preceding whitespace"
    - "Plain markdown (no frontmatter) for Copilot and Windsurf; YAML frontmatter for Cursor and Kiro"

key-files:
  created:
    - templates/.cursor/rules/goodvibes.mdc
    - templates/.github/copilot-instructions.md
    - templates/.windsurfrules
    - templates/.kiro/steering/goodvibes.md
  modified:
    - JOURNAL.md

key-decisions:
  - "IDE rule files not added to MANAGED_FIXED — write-once on init, never overwritten by upgrade to preserve user customizations"
  - "alwaysApply:true for Cursor and inclusion:always for Kiro — engineering rules must always be in context"
  - ".windsurfrules chosen over .devin/rules/ — simpler, still fully supported after Windsurf→Devin Desktop rebrand"
  - "No CLI code changes needed — existing fs-extra copy + shutil.copytree machinery creates subdirs and enforces no-clobber automatically"

patterns-established:
  - "Template content authoring: adapt CLAUDE.md principles to each IDE format, do not copy verbatim"
  - "Omit sentinel comments, version stamps, journal/push rules from IDE files (Claude Code-specific concerns)"

requirements-completed: [IDE-01, IDE-02, IDE-03, IDE-04]

duration: 2min
completed: 2026-06-30
---

# Phase 8 Plan 01: Multi-IDE Expansion — Template Files Summary

**Four IDE rule template files (Cursor MDC, Copilot plain-markdown, Windsurf plain-markdown, Kiro steering) injected via existing copy machinery with zero CLI code changes**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-06-30T07:35:24Z
- **Completed:** 2026-06-30T07:38:01Z
- **Tasks:** 2
- **Files modified:** 5 (4 created + JOURNAL.md)

## Accomplishments

- Cursor MDC file (`templates/.cursor/rules/goodvibes.mdc`) with `alwaysApply: true` — injects engineering rules into every Cursor AI request
- Kiro steering file (`templates/.kiro/steering/goodvibes.md`) with `inclusion: always` on line 1 — no whitespace before frontmatter per Kiro requirement
- GitHub Copilot file (`templates/.github/copilot-instructions.md`) — plain markdown, auto-excluded by `--minimal` via existing `.github/` filter
- Windsurf rules file (`templates/.windsurfrules`) — 1161 chars, well under the 12,000-char silent-truncation limit
- All four files encode ponytail ladder, fail-loud, surgical changes, and security flag list; all omit sentinel comments and version stamps

## Task Commits

1. **Task 1: Author Cursor and Kiro IDE rule files** - `498487c` (feat)
2. **Task 2: Author Copilot and Windsurf rule files** - `e5509e2` (feat)
3. **JOURNAL.md update** - `99f7905` (docs)

## Files Created/Modified

- `templates/.cursor/rules/goodvibes.mdc` — Cursor always-apply rule file; `alwaysApply: true` frontmatter; 168 words
- `templates/.github/copilot-instructions.md` — GitHub Copilot repo-wide instructions; plain markdown; no frontmatter
- `templates/.windsurfrules` — Windsurf/Devin Desktop workspace rules; plain markdown; 1161 chars
- `templates/.kiro/steering/goodvibes.md` — Kiro always-on steering file; `inclusion: always` frontmatter on line 1; 167 words
- `JOURNAL.md` — Phase 8 Plan 01 journal entry added

## Decisions Made

- **IDE files not in MANAGED_FIXED**: Write-once on first install, never touched by `goodvibes upgrade`. Avoids destroying user edits. Revisit in v1.3.0 if demand arises for upgrade-aware IDE rules.
- **alwaysApply / inclusion:always**: Engineering rules must be in context for every AI request, matching CLAUDE.md always-on behavior. Users who prefer auto or fileMatch modes can edit after first install (no-clobber protects their edits on re-run).
- **.windsurfrules over .devin/rules/**: Simpler, fully supported after the June 2, 2026 Windsurf→Devin Desktop rebrand. No single-file `.devinrules` equivalent exists.

## Deviations from Plan

None — plan executed exactly as written. The plan correctly identified this as pure content authoring with no CLI code changes required.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The four IDE rule files are picked up automatically by the existing copy machinery on every `goodvibes init` run.

## Next Phase Readiness

- All four template files exist and verified correct
- Plan 08-02 (test coverage) can now write unit tests asserting IDE file presence, no-clobber skip, and `--minimal` behavior
- Plan 08-03 (README compatibility table) can reference the confirmed file paths and activation mechanisms
- No blockers

---

## Self-Check: PASSED

- `templates/.cursor/rules/goodvibes.mdc` — EXISTS (verified)
- `templates/.github/copilot-instructions.md` — EXISTS (verified)
- `templates/.windsurfrules` — EXISTS (verified)
- `templates/.kiro/steering/goodvibes.md` — EXISTS (verified)
- Commit `498487c` — EXISTS (`feat(08-01): add Cursor and Kiro IDE rule template files`)
- Commit `e5509e2` — EXISTS (`feat(08-01): add Copilot and Windsurf IDE rule template files`)
- No sentinel markers in any file — VERIFIED
- MANAGED_FIXED free of IDE paths in both CLIs — VERIFIED (grep returns 0)
- `.windsurfrules` under 3000 chars — VERIFIED (1161 chars)

---

*Phase: 08-multi-ide-expansion*
*Completed: 2026-06-30*
