# Frequently Asked Questions

New to goodvibes, or running into a confusing error? This page answers the most common questions.
No terminal expertise required — each answer walks you through the exact steps to take.

---

## Why does `goodvibes update` say version 1.6.1 even though I installed goodvibes-cli?

goodvibes was originally published under the name `jgiox-goodvibes`. If you installed
goodvibes before the package was renamed, the `goodvibes` command on your machine still
points to the old package.

You can tell you are affected if you see any of these:

- The update header reads **"goodvibes upgrade"** (an old alias, not the current command name)
- `goodvibes --version` prints **1.6.1**
- Running `uv tool upgrade goodvibes-cli` returns **"goodvibes-cli is not installed"**

The last symptom happens because the `goodvibes` binary on your machine is a shortcut
(symlink) that points into the old `jgiox-goodvibes` package, not the new `goodvibes-cli`
package. Upgrading `goodvibes-cli` does nothing because the old shortcut is still in place.

See Q2 for the fix — it takes about 30 seconds.

---

## How do I fix it? (Package name migration from jgiox-goodvibes to goodvibes-cli)

Run these two commands in your terminal, one after the other:

```
uv tool uninstall jgiox-goodvibes
uv tool install goodvibes-cli
```

**If you installed with pip instead of uv**, use these commands instead:

```
pip uninstall jgiox-goodvibes
pip install goodvibes-cli
```

After running the commands, verify the fix worked:

```
goodvibes --version
```

You should see **1.7.0** or a higher number. If you still see 1.6.1, close and reopen your
terminal, then run `goodvibes --version` again.

---

## What is the difference between `goodvibes update` and `goodvibes upgrade`?

`goodvibes update` is the current command. It checks the template files in your project and
writes any newer versions from the installed package.

`goodvibes upgrade` was an older alias that existed only in `jgiox-goodvibes`. If you see
**"goodvibes upgrade"** in the command output header, you are still running the old package.
Follow the steps in Q2 to switch to `goodvibes-cli`.

After migrating, only `goodvibes update` exists. There is no `goodvibes upgrade` in the
current package.

---

## Why does `goodvibes update` say "Already up to date" when I just installed?

This is normal. goodvibes compares files by their content (using SHA-256 hashes), not by
version numbers. "Already up to date" means every template file in your project is byte-for-byte
identical to the version that ships with the package — nothing needs to be written.

If you ran `goodvibes init` with the latest version and then immediately run `goodvibes update`,
you will almost always see "Already up to date" because init just copied those files.

This message does **not** mean your CLI is outdated. It means your project files are current.

---

## How do I check which goodvibes package I have installed?

Run this command:

```
uv tool list
```

Look at the output:

- If you see **`jgiox-goodvibes`** — you are on the old package. Follow Q2 to migrate.
- If you see **`goodvibes-cli`** — you are on the current package.

You can also run `goodvibes --version` to see the CLI version number regardless of which
package it came from. Version 1.7.0 or higher means you are on `goodvibes-cli`.

---

## Still stuck?

Open an issue and describe what you see: <https://github.com/jgiox/goodvibes/issues>

Include the output of `uv tool list` and `goodvibes --version` — that is usually enough to
diagnose the problem quickly.
