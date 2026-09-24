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

`goodvibes update` brings your project's goodvibes files (and the global setup in `~/.claude`,
if you use it) up to date with the goodvibes version you have installed. Files you edited are
kept.

`goodvibes upgrade` first installs the newest goodvibes from npm or PyPI, then runs
`goodvibes update` with it. Use it when you want the latest release in one step.
`goodvibes upgrade --dry-run` tells you whether a newer version exists and previews the update
without installing or writing anything.

In 1.9.0 and earlier, `upgrade` used its own copy step that ignored the install scope. If you
ran `goodvibes upgrade` in a project set up with the global default, its `CLAUDE.md` may now
contain the full rules block as well, so Claude Code reads the rules twice. Open `CLAUDE.md` and
delete everything from `<!-- goodvibes:start -->` to `<!-- goodvibes:end -->`; your own project
section above it stays.

If `goodvibes --version` prints **1.6.1**, you are still on the old `jgiox-goodvibes`
package; follow the steps above to switch to `goodvibes-cli` first.

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

## Where did goodvibes put its files?

By default, in two places. Things that should apply to every project go into your Claude Code settings folder (`~/.claude`): the rules (`rules/goodvibes.md`), the skills, the hooks and ask/deny rules in `settings.json`, and context7. Things that belong to one project go into the folder where you ran `goodvibes init`: `JOURNAL.md`, `CHANGELOG.md`, CI workflows, rule files for other AI tools, and a `CLAUDE.md` with a project section to fill in.

If you ran `goodvibes init --scope project`, everything is inside the project and nothing was written to `~/.claude` (headroom's MCP registration aside, which has always been user-level). The project's `.goodvibes.json` records which scope it uses, and `goodvibes update` follows it.

## Will `goodvibes update` overwrite my `.claude/settings.json` or `.mcp.json`?

No. If you never edited them, update replaces them with the new version. If you edited them, or they were yours before `goodvibes init`, update only adds or refreshes the goodvibes parts: the journal check hook, the session check, the ask-before-publish and deny rules, and the context7 server. Your own permissions, hooks and MCP servers stay exactly as they are. It never adds "allow" rules to a file you edited.

Run `goodvibes update --dry-run` first to see every key it would add or change. If one of your JSON files is not valid JSON, update leaves it unchanged and tells you.

If you delete a goodvibes part on purpose (for example the journal check hook), update remembers that in `.goodvibes.json` and does not add it back.

## Does goodvibes collect any data?

`goodvibes init` sends one anonymous install count: an empty request carrying a random ID made
fresh for that run. Nothing about you, your machine or your code is included, though like any
web request the server sees your IP address. It is skipped when `CI=true` (set by GitHub Actions
and most CI services). To turn it off, set `GOODVIBES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1` in
your environment before running `goodvibes init`.

## Still stuck?

Open an issue and describe what you see: <https://github.com/jgiox/goodvibes/issues>

Include the output of `uv tool list` and `goodvibes --version` — that is usually enough to
diagnose the problem quickly.
