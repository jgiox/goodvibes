# Getting started

Git is a tool for tracking changes to code over time. GitHub is the website where code is shared and teams collaborate on projects. This guide walks you through the essential steps to make your first contribution — even if you have never used git before.

## Clone the project

Cloning means downloading a copy of the project to your computer. Run this command in your terminal:

```
git clone <repository-url>
```

To find the repository URL, go to the project page on GitHub and click the green "Code" button. Copy the HTTPS URL (it looks like `https://github.com/username/project-name.git`) and paste it in place of `<repository-url>`.

After cloning, move into the project folder:

```
cd <project-folder-name>
```

Replace `<project-folder-name>` with the actual name of the folder that was created. You now have a complete local copy of the project, including its full history.

## Create a branch

A branch is a separate workspace for your change. Working on a branch means your edits do not affect the main codebase until they have been reviewed and approved. This is how open source collaboration works — everyone works on their own branch and proposes changes through a pull request.

Create a new branch with a short, descriptive name:

```
git checkout -b my-feature
```

Choose a name that describes what you are changing — for example, `fix-typo`, `add-dark-mode`, or `update-readme`. Good branch names make it easy for reviewers to understand your work at a glance.

To see all your branches, run:

```
git branch
```

The branch with an asterisk next to its name is the one you are currently on.

## Make changes and commit

A commit is a saved snapshot of your changes with a message that describes what changed. Think of it as a checkpoint you can always return to.

1. Edit the files you want to change and save them.

2. Stage your changes — tell git which files to include in the commit:

   ```
   git add -A
   ```

   This stages all changed files. To stage just one file, use `git add path/to/file` instead.

3. Commit your staged changes with a descriptive message:

   ```
   git commit -m "Describe what you changed"
   ```

Write commit messages in the present tense and keep them to one sentence. "Fix typo in README" is better than "fixed stuff". A good message tells the next person (or your future self) exactly what this commit does.

You can make multiple commits on one branch — each one is its own checkpoint in the history. Commit often so your work is saved in small, understandable steps.

## Push your branch

Pushing sends your local branch up to GitHub so other people can see it. Run:

```
git push origin my-feature
```

Replace `my-feature` with your actual branch name. After pushing, your branch appears in the repository on GitHub.

## Open a pull request

A pull request (PR) is a request to merge your branch into the main codebase. It gives the project maintainers a chance to review your work, leave comments, and ask for changes before anything is merged.

1. Go to the repository on GitHub.

2. GitHub usually shows a yellow banner at the top: "You recently pushed a branch — open a pull request." Click the "Compare & pull request" button.

3. If the banner is not there: click the "Pull requests" tab, then "New pull request". Select your branch from the dropdown, then click "Compare & pull request".

4. Write a clear title and description. Explain what your PR does and why you made the change. The more context you give, the faster reviewers can help you.

5. Click "Create pull request".

A maintainer will look at your PR and either approve it, request changes, or ask questions. If changes are requested, make them on the same branch, commit, and push again — the PR updates automatically.

---

That is the full loop: clone → branch → commit → push → pull request. Every contribution, large or small, follows this same pattern.

---

## Troubleshooting IDE rules

**Cursor — rules appear inactive in agent mode**

Cursor 3.0.x has a known bug where `alwaysApply: true` rules are silently downgraded in agent mode. If your goodvibes rules seem to have no effect in Cursor:

1. Open Settings (Cmd/Ctrl + ,) and search for "Rules".
2. Verify that `goodvibes` is listed under "Always Active" rules.
3. If it appears as "Requestable" instead, toggle it to "Always Active" manually.

This is an upstream Cursor issue — the `goodvibes.mdc` file format is correct.

**Using multiple AI coding tools?**

`goodvibes init` writes an `AGENTS.md` file at your project root. This is a cross-tool standard natively read by Zed, Aider, JetBrains Junie (IntelliJ, PyCharm, WebStorm), Jules, Amp, Codex CLI, and many others — without any extra setup. If you switch to a new AI coding tool, check whether it reads `AGENTS.md` before creating a separate rules file.
