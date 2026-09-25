# Contributing

Thanks for wanting to improve this project. Every contribution helps, no matter how small.

## How to contribute

1. **Fork this repository on GitHub.** Click the "Fork" button in the top-right corner of the repository page. This creates your own copy of the project under your GitHub account.

2. **Clone your fork.** Download your copy to your computer:

   ```
   git clone https://github.com/YOUR_GITHUB_USERNAME/PROJECT_NAME.git
   ```

   Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username and `PROJECT_NAME` with the actual repository name. You can find the exact URL by clicking the green "Code" button on your fork's GitHub page.

3. **Create a branch for your change.** A branch is a separate workspace that keeps your work isolated from the main codebase:

   ```
   git checkout -b fix/my-fix
   ```

   Start the name with `feat/`, `fix/`, `docs/` or `chore/`, then a few words that describe the change: for example, `fix/login-bug` or `feat/dark-mode`.

4. **Make your changes.** Edit the files you want to change and save them.

5. **Stage and commit your changes.** This saves a snapshot of your work with a message:

   ```
   git add path/to/changed-file JOURNAL.md
   git commit -m "Describe what you changed"
   ```

   Name each file you changed instead of using `git add -A` or `git add .`, which stage everything, including stray files such as a `.env` with passwords. If the project has a `JOURNAL.md`, add a short entry saying what you changed and why, and stage it too.

   Write the commit message in the present tense: "Fix typo in README" not "fixed stuff".

6. **Push your branch to GitHub.** This sends your local branch to your fork:

   ```
   git push origin fix/my-fix
   ```

   Replace `fix/my-fix` with your actual branch name.

7. **Open a pull request.** Go to your fork on GitHub. You will usually see a yellow banner near the top that names your branch, with a "Compare & pull request" button. Click it. If the banner is not there, click the "Pull requests" tab, then "New pull request", and select your branch.

## What makes a good pull request

- **One change per pull request.** Smaller PRs are easier to review and easier to revert if something goes wrong.
- **Write a clear title** that says what the PR does, not just what files you changed. Example: "Fix login page crash on empty password" is better than "Update auth.js".
- **If the change is large, open an issue first** to discuss your approach before writing the code. This saves time for everyone.
- **All automated checks must pass** before your PR will be reviewed. If checks fail, look at the error output and fix the issue.

## Working on goodvibes itself

goodvibes ships two command-line tools that must behave the same and print the same text: the npm package in `packages/npm` (TypeScript) and the pip package in `packages/pip` (Python). The files they install live in `templates/`. A change to one package almost always needs the same change in the other, in the same pull request.

Run the checks before you open a pull request:

```
cd packages/npm
npm ci
npm run prebuild
npm run typecheck
npm run build
npm test
```

```
cd packages/pip
uv run --extra dev pytest tests/
```

Run the Python tests from `packages/pip`, not the repo root, or pytest cannot find its plugins. `npm run prebuild` copies `templates/` into the npm package; run it after you add a template file.

House rules, written out in full in `CLAUDE.md`:

- **Bug fixes start with a failing test.** Commit the test that reproduces the bug first, then the fix, as two commits. Name the test after the symptom.
- **Test names are sentences**, for example `it('returns null when Python version is below 3.10')`.
- **Unit tests never touch the real system**: no real `~/.claude`, global installs, network or `claude` CLI. Mock them, or use a temporary folder in integration tests.
- **Hooks stay portable**: POSIX `sh` and POSIX `awk` only (no `jq`, no bash-only syntax), because they run on every user's machine. The hook tests run the real hook from `templates/.claude/settings.json`; add cases to `tests/hooks/*.cases.json`.
- **Add a `JOURNAL.md` entry** to every commit, and update the docs and `CHANGELOG.md` when behaviour changes.

## Questions

Open a GitHub issue if you have a question or want to discuss an idea before starting work.
