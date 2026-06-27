---
phase: 7
slug: readme-demo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + shell assertions (no new test framework needed — phase delivers static files and a workflow) |
| **Config file** | none |
| **Quick run command** | `ls docs/demo.gif scripts/demo.tape && wc -c docs/demo.gif` |
| **Full suite command** | `ls docs/demo.gif scripts/demo.tape README.md .github/workflows/vhs.yml && wc -c docs/demo.gif` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `ls -lh docs/demo.gif 2>/dev/null || echo "(GIF not yet created)"`
- **After every plan wave:** Run full suite command above
- **Before `/gsd-verify-work`:** All files present, GIF < 2MB, README badge URLs return HTTP 200
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | README-01, README-02 | — | N/A | manual | `grep 'One command' README.md && grep 'shields.io' README.md` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | README-03, README-04 | — | N/A | manual | `grep 'demo.gif' README.md && grep 'minimal' README.md` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | DEMO-01 | — | N/A | manual | `ls scripts/demo.tape && ls docs/demo.gif` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | DEMO-01 | — | GIF ≤ 2MB | shell | `test $(wc -c < docs/demo.gif) -lt 2097152 && echo OK` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | DEMO-02 | — | N/A | manual | `ls .github/workflows/vhs.yml && grep 'demo.tape' .github/workflows/vhs.yml` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — this phase creates static files (README.md, scripts/demo.tape, docs/demo.gif, .github/workflows/vhs.yml). No test framework installation required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge URLs return non-error Shields.io response | README-02 | Requires live HTTP request to shields.io with published package names | Open each badge URL in a browser; verify non-gray shield renders |
| GIF renders inline on GitHub README without "View raw" | README-03 | Requires pushing to GitHub and viewing rendered README | Push branch, open GitHub repo, confirm GIF renders inline |
| `vhs scripts/demo.tape` reproduces docs/demo.gif | DEMO-01 | Requires VHS installed locally | Install VHS, run `vhs scripts/demo.tape`, verify docs/demo.gif updated |
| vhs.yml auto-regenerates GIF on tape change | DEMO-02 | Requires pushing a tape change to main | Edit scripts/demo.tape, push to main, verify GH Actions run produces updated GIF commit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
