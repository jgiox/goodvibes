# Git and GitHub basics

Git keeps a history of every change to your project, so you can see what changed and go back if something breaks. GitHub is a website that stores that history online, runs the goodvibes checks on every change, and lets people review changes before they are accepted. This guide covers what you need for everyday work, starting from zero.

## Open a terminal

A terminal is a window where you type commands instead of clicking. You type a command, press Enter, and it prints a result. Every command in this guide goes into a terminal, exactly as written.

**macOS:** press Cmd and Space together, type `Terminal`, and press Enter.

**Windows:** goodvibes runs on Windows through WSL2, which puts a Linux system inside Windows. Set it up once:

1. Click Start, type `PowerShell`, right-click **Windows PowerShell** and choose **Run as administrator**.
2. Type this and press Enter:

   ```sh
   wsl --install
   ```

3. Restart your computer when it asks.
4. Open **Ubuntu** from the Start menu. The first time, it asks you to choose a user name and password. Nothing appears on screen while you type the password; that is normal.

From now on, open **Ubuntu** from the Start menu whenever this guide says "terminal".

**Linux:** press Ctrl, Alt and T together (this works on Ubuntu and many others), or search your apps for "Terminal".

A few commands you will use all the time:

| Command | What it does |
|---|---|
| `pwd` | Shows which folder you are in |
| `ls` | Lists the files in this folder |
| `cd my-project` | Moves into the folder `my-project` |
| `cd ..` | Moves up one folder |
| `mkdir my-project` | Creates a new folder called `my-project` |

## Install git and tell it who you are

Check whether git is installed:

```sh
git --version
```

If it prints a version number, git is installed. If not: on macOS, the same command offers to install it, so accept. On Ubuntu (and Windows with WSL2), run `sudo apt install git`. For anything else, see [git-scm.com/downloads](https://git-scm.com/downloads).

Git stamps every saved change with your name and email. Set them once, using your own name and the email of your GitHub account:

```sh
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

`goodvibes doctor` reports a problem (✗) until both are set.

## Sign in to GitHub

1. Create a free account at [github.com/signup](https://github.com/signup).
2. Install the GitHub CLI (a small program that connects your terminal to GitHub) from [cli.github.com](https://cli.github.com).
3. Run:

   ```sh
   gh auth login
   ```

   Choose GitHub.com, then HTTPS, answer yes when it asks to authenticate git, and log in with your browser. After this, git can send your work to GitHub without asking for a password each time.

## Get a project onto your computer

### Copy an existing project (clone)

Cloning downloads a copy of a project from GitHub, including its full history. On the project's GitHub page, click the green **Code** button and copy the HTTPS address. Then run, pasting the address in place of the example:

```sh
git clone https://github.com/username/project-name.git
cd project-name
```

### Start a new project

Create a folder, put it under git, and set up goodvibes:

```sh
mkdir my-project
cd my-project
git init -b main
npx goodvibes-cli init
```

`git init -b main` starts a history in this folder, with `main` as the main branch (the goodvibes checks run on `main`). Before your first commit, tell git never to save your secrets file:

```sh
echo ".env" >> .gitignore
```

Save everything goodvibes created as your first commit. `git status` lists the new files and folders. Check that nothing secret is in the list, then add each name it shows (naming a folder adds everything in it), for example:

```sh
git status
git add .gitignore .github .claude docs AGENTS.md CHANGELOG.md CLAUDE.md CONTRIBUTING.md JOURNAL.md SECURITY.md
git commit -m "chore: set up goodvibes"
```

Your list will have more names than this example, such as `.cursor` and `.goodvibes.json`. Add them all.

Then create the project on GitHub and upload it:

```sh
gh repo create --source=. --private --push
```

Use `--public` instead of `--private` if you want anyone to see it. On a private project, the goodvibes checks skip the CodeQL scan and the dependency review, because GitHub offers those on private projects only with GitHub Advanced Security, a paid add-on. The other checks run either way.

## Make a change on a branch

A branch is a separate line of work. Your change lives on its branch until you decide to add it to `main`, so `main` always stays working. Create one before each change:

```sh
git switch -c feat/dark-mode
```

Start the name with `feat/` (a new feature), `fix/` (a bug fix), `docs/` (documentation) or `chore/` (maintenance), then a few words about the change. The goodvibes rules ask the AI to name branches the same way.

To see your branches, run `git branch`. The one marked with `*` is the one you are on.

## Save your work (commit)

A commit is a saved checkpoint of your project with a short message saying what changed. You can always go back to it.

1. See what changed:

   ```sh
   git status
   git diff
   ```

2. Pick the files to save. Name each file you changed, plus `JOURNAL.md`, where the AI noted what it did and why:

   ```sh
   git add src/theme.css src/settings.js JOURNAL.md
   ```

   Never use `git add -A` or `git add .`. They add everything, including stray files such as a `.env` file with passwords.

3. Save them with a message:

   ```sh
   git commit -m "feat: add dark mode"
   ```

Write the message as a short description of what the commit does, such as "fix: show error when login fails", not "fixed stuff". To see your history, run `git log --oneline`.

In Claude Code, the AI can run `git add` and `git commit` for you without asking. If a commit leaves out `JOURNAL.md`, the goodvibes journal check stops it, whether an AI tool or you made it. Add a short entry to `JOURNAL.md`, stage it, and commit again. To skip the check once, add `--no-verify` to the commit command.

## Send your branch to GitHub (push)

Pushing uploads your commits to GitHub. The first time for a new branch, run:

```sh
git push -u origin feat/dark-mode
```

After that, `git push` is enough for this branch. Claude Code always asks you before it pushes.

## Open a pull request

A pull request asks to add your branch to `main`. It shows the changes, runs the goodvibes checks, and gives you (or a reviewer) a place to look before anything is merged.

1. Go to your project on GitHub.
2. GitHub usually shows a banner saying your branch had recent pushes. Click **Compare & pull request**. If there is no banner, click the **Pull requests** tab, then **New pull request**, and choose your branch.
3. Write a title and a short description: what changed and why.
4. Click **Create pull request**.

The checks start on their own. A green ✓ means they passed. A red ✗ means one failed: click **Details** next to it to see why, fix it on the same branch, commit and push again. The pull request updates by itself.

When the checks pass, click **Merge pull request**. Then bring the merged work back to your computer:

```sh
git switch main
git pull
```

That is the whole loop: branch, commit, push, pull request, merge, pull. Every change, large or small, follows it.
