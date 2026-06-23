---
phase: 1
slug: template-content-repo-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (static files phase — shell smoke tests only) |
| **Config file** | `scripts/verify-phase1.sh` (Wave 0 creates this) |
| **Quick run command** | `bash scripts/verify-phase1.sh <specific-file>` |
| **Full suite command** | `bash scripts/verify-phase1.sh` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant `test -f` or `grep -c` one-liner for the file just created
- **After every plan wave:** Run `bash scripts/verify-phase1.sh` (full batch)
- **Before `/gsd-verify-work`:** All smoke commands pass + manual copy-to-blank-project test
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | CLAUDEMD-01 | — | N/A | smoke | `test -f templates/CLAUDE.md && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-02 | 01 | 1 | CLAUDEMD-02 | — | N/A | smoke | `wc -l < templates/CLAUDE.md` | ❌ Wave 0 | ⬜ pending |
| 01-03 | 01 | 1 | CLAUDEMD-03 | — | N/A | smoke | `grep -c 'goodvibes: v1.0.0' templates/CLAUDE.md` | ❌ Wave 0 | ⬜ pending |
| 01-04 | 01 | 1 | CLAUDEMD-04 | — | N/A | smoke | `grep -c 'goodvibes:start' templates/CLAUDE.md` | ❌ Wave 0 | ⬜ pending |
| 01-05 | 01 | 1 | CLAUDEMD-05 | — | N/A | smoke | `grep -c 'Think before\|Simplicity\|Surgical\|Fail loud\|Security\|Journal' templates/CLAUDE.md` | ❌ Wave 0 | ⬜ pending |
| 01-06 | 02 | 1 | CAV-01 | — | N/A | smoke | `test -d templates/.claude/skills/caveman && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-07 | 02 | 1 | CAV-02 | — | N/A | smoke | `grep -c 'Julius Brussee' NOTICE` | ❌ Wave 0 | ⬜ pending |
| 01-08 | 02 | 1 | HYG-01 | — | N/A | smoke | `test -d templates/.claude/skills/goodvibes-hygiene && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-09 | 02 | 1 | HYG-03 | — | N/A | smoke | `grep -c 'plugin marketplace add' templates/.claude/skills/goodvibes-hygiene/SKILL.md` | ❌ Wave 0 | ⬜ pending |
| 01-10 | 03 | 2 | DOCS-01 | — | N/A | smoke | `test -f templates/CONTRIBUTING.md && ! grep -q 'TODO\|YOUR_PROJECT' templates/CONTRIBUTING.md && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-11 | 03 | 2 | DOCS-05 | — | N/A | smoke | `test -f templates/.github/ISSUE_TEMPLATE/bug_report.yml && test -f templates/.github/ISSUE_TEMPLATE/feature_request.yml && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-12 | 04 | 2 | REPO-01 | — | N/A | smoke | `test -f LICENSE && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-13 | 04 | 2 | REPO-02 | — | N/A | smoke | `test -f NOTICE && echo PASS` | ❌ Wave 0 | ⬜ pending |
| 01-14 | 04 | 2 | REPO-03 | — | N/A | smoke | `grep -c 'npx goodvibes init' README.md` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-phase1.sh` — shell script running all smoke commands above as a batch; covers all 22 Phase 1 requirements

*No test framework install needed — pure shell one-liners suffice.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLAUDE.md rules auto-activate in Claude Code | CLAUDEMD-04 | Requires opening real Claude Code session | Copy `templates/` to `/tmp/test-project/`, open in Claude Code, verify ponytail rules take effect without any manual `/ponytail` command |
| caveman skill works without configuration | CAV-03 | Requires active Claude Code session | In test project, type `/caveman` and confirm compression output |
| goodvibes-hygiene skill displays ponytail install instructions | HYG-02, HYG-03 | Requires Claude Code skill rendering | In test project, invoke skill and verify ponytail marketplace command appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
