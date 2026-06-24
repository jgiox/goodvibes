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
   git checkout -b my-fix
   ```

   Give the branch a short name that describes what you are changing — for example, `fix-login-bug` or `add-dark-mode`.

4. **Make your changes.** Edit the files you want to change and save them.

5. **Stage and commit your changes.** This saves a snapshot of your work with a message:

   ```
   git add -A
   git commit -m "Describe what you changed"
   ```

   Write the commit message in the present tense: "Fix typo in README" not "fixed stuff".

6. **Push your branch to GitHub.** This sends your local branch to your fork:

   ```
   git push origin my-fix
   ```

   Replace `my-fix` with your actual branch name.

7. **Open a pull request.** Go to your fork on GitHub. You will usually see a banner at the top saying "You recently pushed a branch — open a pull request." Click the button. If the banner is not there, click the "Pull requests" tab, then "New pull request", and select your branch.

## What makes a good pull request

- **One change per pull request.** Smaller PRs are easier to review and easier to revert if something goes wrong.
- **Write a clear title** that says what the PR does, not just what files you changed. Example: "Fix login page crash on empty password" is better than "Update auth.js".
- **If the change is large, open an issue first** to discuss your approach before writing the code. This saves time for everyone.
- **All automated checks must pass** before your PR will be reviewed. If checks fail, look at the error output and fix the issue.

## Questions

Open a GitHub issue if you have a question or want to discuss an idea before starting work.
