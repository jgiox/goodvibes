---
task: git-push-convention
date: 2026-06-24
status: in-progress
files_modified:
  - templates/CLAUDE.md
  - CLAUDE.md
---

# Quick Task: Add git push convention

Add a "Push to remote" engineering rule to both the distributed template and the project's own CLAUDE.md.

**Why:** Commits that only exist locally are lost on machine failure. The Journal convention already covers "update JOURNAL.md after every task" — the push convention is the natural complement: "also push to GitHub".

## Task

After the `### Journal` section in both files, insert:

```markdown
### Push to remote
**Push to GitHub after every completed task or end of session.**
A commit that only exists locally is one machine failure away from being lost. Run `git push origin <branch>` after each commit, or at minimum before stopping for the day. Never leave completed work unpushed for more than one session.
```

Files:
- `templates/CLAUDE.md` — after line 51 (before `## Ponytail`)
- `CLAUDE.md` — after line 242 (before `## Ponytail`)
