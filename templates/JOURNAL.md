# Engineering Journal

Log what you built, what you learned, and what you want to revisit.

## Entry template

```
## YYYY-MM-DD — [one sentence describing what you worked on]

**What I did:** [2-3 sentences describing the work completed]

**What I learned:** [anything surprising, confusing, or worth remembering]

**Decisions made:** [choices you made and why — helps you explain them later]

**Next time:** [what you would do differently, or what to do next session]
```

## Example entry

## 2026-06-23 — Added user login page

**What I did:** Created a login form with email and password fields. Wired it to the
existing /api/auth/login endpoint. Added basic error messages for wrong credentials.

**What I learned:** The fetch API in the browser does not send cookies by default —
you need `credentials: 'include'` to make session cookies work cross-origin.

**Decisions made:** Used a simple fetch call instead of a library because the project
only has one API call so far. Will revisit if the codebase grows.

**Next time:** Add a loading spinner while the login request is in flight.
