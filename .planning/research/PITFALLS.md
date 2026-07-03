# Pitfalls Research: goodvibes

**Domain:** Single-command developer tool bootstrapper for LLM-assisted vibe coding
**Researched:** 2026-06-23 (v1.0); updated 2026-06-26 (v1.1.0 Polish & Discoverability); updated 2026-07-03 (v1.2.0 Growth & Retention)
**Overall confidence:** HIGH (npm v12 critical finding verified via GitHub Changelog; CLAUDE.md pitfalls verified via multiple authoritative sources; cross-platform issues verified via official npm bug trackers; telemetry pitfalls verified via GitHub CLI controversy analysis and GDPR guidance; headroom platform bugs verified via upstream issue tracker)

---

## v1.2.0 Growth & Retention — Milestone-Specific Pitfalls

This section covers pitfalls for the three features in the v1.2.0 milestone:
anonymous install telemetry, headroom integration validation, and the `goodvibes update`
command (template merge). Each pitfall names the phase where it belongs.

---

### T1: Telemetry — IP Address Is PII Under GDPR Even When You Never Store It

**What goes wrong:**
The project spec says "no PII collected." A developer implements a simple fire-and-forget
POST to a counter endpoint with body `{ version: "1.2.0", os: "linux" }` and calls it
"anonymous." But every HTTP request to that endpoint carries the user's IP address in the
request headers. The endpoint provider's access log captures it. Under GDPR Article 4(1),
IP addresses are personal data because they identify a natural person. Even a header-only
request with no body sends PII. "We don't store it" is insufficient — the request itself
is a processing act that requires a lawful basis.

**Why it happens:**
Developers conflate "no PII in the request body" with "no PII collected." The transport
layer always includes the IP. Most analytics services (even privacy-first ones) handle
this by hashing and rotating the IP before persistence, not by never receiving it.

**Consequences:**
- "No PII collected" claim in the README is legally inaccurate if any third-party
  analytics endpoint receives the HTTP request without contractual IP-non-logging guarantees
- If goodvibes users are in the EU, the telemetry endpoint becomes a GDPR data processor
  requiring a Data Processing Agreement (DPA)
- Developer community backlash (see GitHub CLI's April 2026 controversy) can permanently
  damage trust in the tool

**Prevention:**
- Use Plausible Analytics or Fathom as the endpoint — both contractually guarantee no IP
  storage and no raw IP logging, and are GDPR-compliant without requiring cookie consent
- Alternatively: send a blind POST to a Cloudflare Worker that increments a counter in
  KV and discards the IP before persisting anything. Document this architecture in the README.
- Do NOT use Google Analytics, Segment, Mixpanel, or PostHog for a "no PII" claim without
  explicit IP-anonymization configuration AND a verified DPA
- Add a TELEMETRY.md (one screen) documenting exactly what is sent, where, and the IP policy

**Detection:**
If you can answer "who processes the HTTP request before any data is stored?" and that
entity does not have a documented IP non-logging or hashing policy, the claim is unsound.

**Phase:** Telemetry phase, before any endpoint is wired.

---

### T2: Telemetry — Default-On Without First-Run Disclosure Destroys Trust

**What goes wrong:**
The telemetry fires during `goodvibes init` without any visible disclosure. The April 2026
GitHub CLI incident (gh v2.91.0 enabled telemetry default-on with no first-run prompt,
no standalone announcement) triggered a significant community backlash. Developers noticed
via changelog inspection; the sentiment was "GitHub knew we'd reject opt-in so they buried
the opt-out." A beginner-first tool like goodvibes operates on trust — a single privacy
controversy will kill adoption permanently.

**Why it happens:**
Default-on maximizes dataset size. The GitHub CLI implementation specifically chose not to
show a first-run prompt because it reduces collection. This logic backfires badly in
developer tooling communities.

**Consequences:**
- Trust erosion that cannot be recovered by a later "we changed it" release
- GitHub Actions runners and CI pipelines will fire telemetry on every CI run across all
  forks, generating corporate/org data the users did not consent to share
- Security teams in regulated environments cannot audit the tool and will blocklist it

**Prevention:**
- Show a one-line disclosure in the `goodvibes init` intro output (before any tasks run):
  "Anonymous usage counter will fire — set DO_NOT_TRACK=1 to opt out."
- Honour `DO_NOT_TRACK=1` (the donottrack.sh standard), `CI=true` (skip in pipelines),
  and a `GOODVIBES_NO_TELEMETRY=1` escape hatch for tooling integrations
- Make the disclosure text part of the `@clack/prompts` `intro()` or `note()` block — not a
  hidden comment in docs — so it appears in the terminal on first run
- Store NO persistent identifier (no UUID file). A counter with no session ID cannot be
  used to correlate runs, so it is genuinely anonymous.

**Phase:** Telemetry phase, before the first line of telemetry code is written.

---

### T3: Telemetry — Network Failure or Firewall Blocks Init Completion

**What goes wrong:**
If the telemetry request is synchronous (awaited with no timeout), any of these conditions
block `goodvibes init` until the request times out (default Node.js TCP timeout is ~2 min):
corporate firewall dropping the request, DNS failure, analytics endpoint down, offline laptop.
A beginner sees the spinner freeze for 2 minutes with no explanation. They Ctrl-C and lose
all the template files that were already written.

**Why it happens:**
It is natural to `await fetch(telemetryUrl, ...)` because that is how async Node.js works.
Without explicit timeout and `catch`, a dangling promise blocks process exit.

**Consequences:**
- Init appears to hang for 90-120 seconds in common enterprise and offline environments
- If the user Ctrl-C's during the hang and templates are only partially written, their
  project is in a broken half-initialized state
- CI runs in environments with restrictive egress rules fail or time out

**Prevention:**
- Implement telemetry as pure fire-and-forget with a hard 1-second timeout:
  ```typescript
  // ponytail: never await telemetry — drop on timeout/error, never block init
  void sendTelemetry().catch(() => {})
  ```
- Use `AbortController` with `signal: AbortSignal.timeout(1000)` on the fetch call
- Check `CI`, `DO_NOT_TRACK`, and `GOODVIBES_NO_TELEMETRY` env vars BEFORE creating the request
- Never retry telemetry. Accept "drop on failure" as the correct behavior.
- The telemetry call must be fire-and-forget BEFORE the first task runs, not after — so a
  delayed network response doesn't hold the process open after tasks complete

**Phase:** Telemetry phase. Test by running init with network blocked via `no_proxy=*` or
`unset http_proxy && iptables` to confirm 0-second added latency.

---

### T4: Telemetry — Node.js Process Exit Races the Inflight HTTP Request

**What goes wrong:**
Even a `void sendTelemetry()` call (fire-and-forget) may be killed before the TCP connection
completes because Node.js exits as soon as the event loop is empty — even if an in-flight
`fetch()` has not completed. The telemetry fires zero percent of the time if the rest of
`goodvibes init` runs faster than the TCP handshake, which is common on fast machines.

**Why it happens:**
`fetch()` in Node.js 18+ does not hold the event loop open. The process exits when all
synchronous work and awaited promises complete. In-flight `fetch()` created via `void` is
abandoned at exit unless the runtime specifically keeps the event loop alive.

**Consequences:**
- Telemetry counter shows zero events even when the tool is widely used
- Developer assumes the telemetry code is working but the endpoint never receives requests
- The "we shipped telemetry" feature delivers zero data

**Prevention:**
- Call telemetry in the early part of `init`, then `await` it with a race against a 1-second
  timeout, discarding the result either way:
  ```typescript
  const telemetryDone = sendTelemetry().catch(() => {})
  await tasks([...]) // do real work
  await Promise.race([telemetryDone, new Promise(r => setTimeout(r, 1000))])
  ```
- This pattern: (1) starts the request before long tasks so TCP handshake overlaps with
  template copying, (2) gives the request up to 1 second after tasks complete, (3) never
  blocks init if telemetry is slow
- Test: add a 500ms artificial delay to the telemetry endpoint; verify init still exits
  within 1.5 seconds (not 2+ minutes)

**Phase:** Telemetry phase, implementation.

---

### T5: Telemetry — Filesystem Path or Error Text Leaks Username

**What goes wrong:**
If telemetry includes any error detail (headroom install failure reason, file copy error),
those strings often contain the user's home directory path: `/home/jane_doe/.local/bin/`
or `C:\Users\JohnSmith\AppData`. This leaks the username — definitively PII.

**Why it happens:**
It is tempting to include error context in telemetry to diagnose install failures. The
error message from a subprocess (execa, subprocess.run) typically includes the full path.
Even an OS field like `platform: "linux"` combined with a path that includes a username
creates re-identifiable data.

**Prevention:**
- Send NO error details in telemetry. The counter should be one number: "init ran." No
  error text, no file paths, no uv/pip output.
- If you add an "install success" vs "headroom skipped" boolean in the future, use a
  categorical code (e.g., `headroom: "skipped"`) never a raw error string.
- Before shipping, write a test that serializes the telemetry payload and asserts it
  contains none of: the current user's name, any path segment containing `/home/`,
  `/Users/`, `\Users\`, or `AppData`.

**Phase:** Telemetry phase, implementation review.

---

### U1: Update Command — `overwrite: true` in Upgrade Silently Destroys User Customizations to Managed Files

**What goes wrong:**
`goodvibes upgrade` (aliased as `goodvibes update`) uses `copy(templateDir, destDir, { overwrite: true })`
for skill files and CI workflows. Unlike `goodvibes init` which uses `overwrite: false`, the
upgrade intentionally overwrites. A user who has customized `.claude/skills/caveman/SKILL.md`
(perhaps to adjust the output format) or added their own project rules to a skill file has
those changes silently destroyed on every upgrade run. There is no diff shown, no prompt, and
no backup created before the overwrite.

**Why it happens:**
The upgrade was designed to keep managed files in sync with the template, which requires
overwriting. The current code has no mechanism to detect user modifications before overwriting.

**Consequences:**
- User's customizations to skill files are lost with no recovery path
- The "Files updated" panel shows the file path but gives no indication that user content was
  destroyed
- For a beginner audience, `goodvibes upgrade` is likely to be run without understanding
  what "managed files" means

**Prevention:**
- Before overwriting, compute a diff between dest and template. If the file has been
  modified from the previous template version (not just "different from latest template"),
  warn: "caveman/SKILL.md has local changes — backup written to caveman/SKILL.md.bak"
- Minimum viable: write `.bak` files for any managed file that differs from the LAST
  shipped template (not the current one). This requires storing a hash of the shipped
  template per file — the sentinel CLAUDE.md pattern could be extended.
- Add a `--force` flag that explicitly acknowledges "I know this overwrites my changes."
  Default behavior should refuse to overwrite user-modified managed files.
- Add a test: init a project, modify a skill file, run upgrade — assert the modified file
  is backed up or the upgrade warns and aborts.

**Phase:** Update command phase.

---

### U2: Update Command — Partial Upgrade Leaves Skills at New Version and CLAUDE.md at Old Version

**What goes wrong:**
`upgradeTemplates()` in `upgrade.ts` runs in this order:
1. `copy(templateDir, destDir, { overwrite: true, filter: ... })` — copies skill files
2. Renames CI variant
3. `mergeClaude(claudeDest, templateContent)` — updates CLAUDE.md sentinel

If step 1 throws (e.g., `EACCES` on a skill file because the directory is read-only), the
`tasks()` wrapper catches the error and exits 1. CLAUDE.md still has the old version sentinel.
But some skill files may have been partially overwritten by `copy()` before the error.

On the next run: `detectInstalledVersion()` reads CLAUDE.md and finds the old version.
`bundledVersion` is the new package version. `versionGte(old, new)` is false, so the upgrade
proceeds. This is correct behavior and the upgrade will re-attempt.

BUT: if the partial copy wrote a skill file from the new template BEFORE the error, that file
is now a mix of new-template content (the written file) and old project state. The CLAUDE.md
still says the old version. The "what will change" diff will show the skill file as "unchanged"
(new content == new template), masking that the project is in an inconsistent state.

**Why it happens:**
`copy()` from `fs-extra` is not atomic — it writes files sequentially. An error midway
through does not roll back previously written files. There is no transactional checkpoint.

**Prevention:**
- Before running upgrade, verify write permissions on all target paths first and fail
  early with a clear error before touching any files.
- After a successful upgrade, verify that CLAUDE.md version was updated. If the sentinel
  update fails (step 3 fails), log an explicit error: "Skills updated but CLAUDE.md sentinel
  was not updated — run `goodvibes upgrade` again to complete."
- Add a test: simulate an EACCES mid-copy (mock `copy()` to throw after writing the first
  file) — assert the command exits 1 with a message naming the failed file, and a second
  run completes successfully.

**Phase:** Update command phase, implementation.

---

### U3: Update Command — Sentinel Block Edge Case: `SENTINEL_START` Present, `SENTINEL_END` Missing

**What goes wrong:**
`sentinel-merge.ts` (and the Python equivalent) checks `startIdx === -1` to detect "no
sentinel present." If `SENTINEL_START` is present but `SENTINEL_END` is missing (user
accidentally deleted the end marker, or a truncation occurred), `startIdx !== -1` so the
"no sentinel" branch is skipped. Then:

```typescript
const endIdx = existing.indexOf(SENTINEL_END)  // returns -1
const existingBlock = existing.slice(startIdx, endIdx + SENTINEL_END.length)
// = existing.slice(startIdx, -1 + 22)
// = existing.slice(startIdx, 21)
// This produces a 21-character string from an arbitrary position
```

`existingBlock` is now a garbage 21-character string. `extractVersion(existingBlock)` returns
null (no version match). The condition `existingVersion && templateVersion && versionGte(...)` is
false (null is falsy), so it falls through to Case C (replace block). The replace is:
```typescript
const before = existing.slice(0, startIdx)
const after = existing.slice(endIdx + SENTINEL_END.length)
// = existing.slice(21)
```
The merge writes `before + templateBlock + existing.slice(21)` — the first 21 characters of
the file are silently discarded and the rest is appended after the new block. This is data
loss in CLAUDE.md.

**Why it happens:**
The sentinel merge logic assumes if `SENTINEL_START` is present, `SENTINEL_END` is also
present. This is true for files goodvibes writes, but not for files users have manually edited.

**Consequences:**
- User's custom CLAUDE.md content (the first 21 chars from position 0) is truncated to nothing
- The corrupted file passes silently with exit 0
- On the next run, the new sentinel IS present, so the version check runs correctly — the
  corruption is never detected

**Prevention:**
- Add a guard after computing both indices:
  ```typescript
  if (startIdx !== -1 && endIdx === -1) {
    // Corrupted sentinel — treat as Case B (append new block) and warn
    log('Warning: goodvibes sentinel block is malformed in CLAUDE.md — appending new block')
    await writeFile(destPath, existing.trimEnd() + '\n\n' + templateBlock + '\n')
    return
  }
  ```
- Add a unit test: CLAUDE.md with `<!-- goodvibes:start -->` but no `<!-- goodvibes:end -->` →
  the result must contain the original content and the new sentinel block, not a truncated file.
- Add the same guard and test to the Python `sentinel_merge.py`.

**Phase:** Update command phase, sentinel hardening.

---

### U4: Update Command — Version Check Uses CLAUDE.md as Sole Proxy for Template Freshness

**What goes wrong:**
`detectInstalledVersion()` reads the sentinel in CLAUDE.md and returns the version string.
`getInstalledVersion()` reads the `goodvibes-cli` npm package version. If these match, the
upgrade exits early with "Already up to date." This assumption breaks in two scenarios:

Scenario A — User edited the version in the sentinel to a higher number (intentionally or
by copying a colleague's CLAUDE.md). The upgrade thinks the project is newer than the
package and skips. The skill files and CI workflows may be stale.

Scenario B — The user ran `npx goodvibes init` to get a fresh CLAUDE.md but never ran
`goodvibes upgrade`. The CLAUDE.md version matches the package version. The upgrade exits
early. But the skill files are from an older installed version (the `init` command reads
from the PACKAGE bundle — which changes with npm versions — but if the user had an older
cached npx binary, the init may have written older skill files).

**Why it happens:**
Using a single marker (CLAUDE.md version) as a proxy for the state of ALL managed files
is a simplification that breaks when any of the assumptions are violated.

**Prevention:**
- For the upgrade path specifically, add a `--force` flag that bypasses the version check
  and applies templates unconditionally. Document: "If managed files look stale, run
  `goodvibes upgrade --force`."
- Document the version-proxy assumption prominently in CONTRIBUTING.md: "The version in
  CLAUDE.md is the source of truth for upgrade gating. Do not manually edit it."
- Add a test: CLAUDE.md sentinel says v99.0.0, package is v1.2.0 — upgrade must exit
  early (cannot downgrade). Separately: CLAUDE.md version == package version — upgrade
  must exit early (up to date).

**Phase:** Update command phase.

---

### U5: Update Command — Python `upgrade_templates` Returns All Managed Files, Not Just Changed Ones

**What goes wrong:**
`upgrade_templates()` in `upgrade_cmd.py` returns:
```python
sorted(
    str(f.relative_to(dest_dir))
    for f in dest_dir.rglob("*")
    if f.is_file()
    and (str(f.relative_to(dest_dir)).startswith(".claude/skills/")
         or str(f.relative_to(dest_dir)).startswith(".github/workflows/")
         or str(f.relative_to(dest_dir)) == "CLAUDE.md")
)
```
This walks the destination directory AFTER the copy and returns ALL files in managed prefixes —
including files that were already there and unchanged. The "Files updated" panel then lists
every managed file in the project, creating the impression that all of them were modified
even when only CLAUDE.md changed.

The same issue exists in the TypeScript `upgradeTemplates()` which uses `listTemplateFiles(destDir)`
filtered to managed prefixes.

**Why it happens:**
Tracking "what was actually written" during `shutil.copytree` with an ignore function is
difficult because Python's `copytree` does not return the list of files it copied. The
simpler approach of walking after the copy is used, which over-reports.

**Prevention:**
- Snapshot the managed file hashes before the copy, re-hash after. Report only files whose
  hash changed.
- Or: compare the `changes` list (already computed by `compute_changes()`) to determine
  which files were "changed" vs "new" vs "unchanged" — and use that pre-computed result
  as the return value instead of re-walking the directory.
- The pre-computed `changes` list is already available in `upgrade_cmd()` before calling
  `upgrade_templates()`. Pass it through.
- Add a test: run upgrade on a project where only CLAUDE.md differs — the "Files updated"
  output must list only CLAUDE.md, not all skill files.

**Phase:** Update command phase.

---

### H1: Headroom Validation — Binary Exists and Exits 0 But Headroom Is Broken

**What goes wrong:**
The current idempotency probe in `install-headroom.ts` is:
```typescript
await execa('headroom', ['--version'])
log('headroom already installed — skipping')
return
```
This checks that the binary exists and returns exit 0. A broken headroom installation
passes this check. Known scenarios where headroom exits 0 on `--version` but fails on use:
- The ONNX compression model was not downloaded yet (first use hangs)
- The wheel was installed for a different Python version than the current interpreter
- The Rust extension (.so/.pyd) failed to load but headroom falls back to a stub that
  reports its version without providing compression

The MCP registration step registers the binary path. Claude Code then silently gets a
headroom server that accepts connections but returns identity (no compression). The core
feature of goodvibes — token compression — is disabled with no user-visible warning.

**Prevention:**
- Validate headroom with a smoke test, not just a version check:
  ```typescript
  await execa('headroom', ['compress', '--help'])
  // OR: a short compression round-trip if headroom supports it
  ```
- Better: after install, check that `headroom mcp status` exits 0 AND returns JSON that
  includes a valid binary path that `existsSync()` confirms is present.
- Log a distinct warning: "headroom installed but compression validation failed — MCP
  will be registered but context compression may not be active."
- The "validation" feature requested by the v1.2.0 milestone should be this smoke test,
  not a version string check.

**Phase:** Headroom validation phase.

---

### H2: Headroom Validation — `headroom._core.detect_content_type()` Hangs on Windows (Confirmed Upstream Bug)

**What goes wrong:**
headroom-ai issue #845 (confirmed, open as of 2026-07-03): `headroom._core.detect_content_type()`
hangs indefinitely on Windows with Python 3.13 due to a deadlock or race condition in the Rust
extension. The process enters the native Rust detector and never returns. This means:
- `goodvibes init` runs headroom validation, which calls any headroom compression path, which hangs
- The `@clack/prompts` spinner stalls indefinitely
- A beginner on Windows sees the init command freeze and hard-kills the terminal

The symptom is indistinguishable from a slow network download. There is currently no
runtime workaround without code-level changes to headroom.

**Why it happens:**
There is a known platform-specific deadlock in headroom's Rust extension on Windows with
Python 3.13. The pure Python fallback detector works, but is not the default path.

**Consequences:**
- `goodvibes init` on Windows with Python 3.13 hangs during headroom validation
- Even `headroom --version` may trigger the content-type detector depending on version
- The hang cannot be avoided by faster hardware — it is a deadlock

**Prevention:**
- Set a hard subprocess timeout on ALL headroom subprocess invocations (both validation
  and install probes):
  ```typescript
  await execa('headroom', ['--version'], { timeout: 10_000 })  // 10 second hard limit
  ```
- If the probe times out, treat it as a failed validation and log:
  "headroom validation timed out (possible platform issue). headroom will be registered but
  not validated. See github.com/headroomlabs-ai/headroom/issues/845 for Windows status."
- Document in `docs/onboarding.md`: "Windows users with Python 3.13 may see slower init
  times due to a known headroom issue. This does not affect your project setup."
- Track the upstream issue — when resolved, the timeout can be loosened.

**Phase:** Headroom validation phase. Test explicitly on `windows-latest` GitHub Actions runner.

---

### H3: Headroom Validation — WSL2 Platform Detection Ambiguity

**What goes wrong:**
`configure-mcp.ts` uses `process.platform === 'win32' ? 'where' : 'which'`. On WSL2,
`process.platform` returns `'linux'` — not `'win32'` or `'wsl'`. The code correctly uses
`which` on WSL2. However:

1. `which headroom` on WSL2 may return no result even after successful `uv tool install`
   because uv installs tools into `~/.local/bin` (Linux home), which may not be on `$PATH`
   in the WSL2 shell until the shell is restarted or `.bashrc` sources the uv shims.

2. The MCP config written by `headroom mcp install` on WSL2 goes into `~/.claude/mcp.json`
   inside the Linux filesystem. If the user's Claude Code is running as a NATIVE Windows
   app (not inside WSL), the Windows Claude Code looks for MCP config in the Windows home
   directory (`C:\Users\<user>\.claude\`). The Linux-side registration is invisible.

3. `process.platform === 'linux'` does not distinguish WSL2 from real Linux. The detection
   logic for which/where is correct, but the downstream assumption that `which headroom`
   returns a usable PATH is wrong for WSL2 fresh installs.

**Prevention:**
- After `which headroom` succeeds, verify the returned path is accessible:
  ```typescript
  const { stdout } = await execa('which', ['headroom'])
  const absolutePath = stdout.trim()
  await execa(absolutePath, ['--version'], { timeout: 5000 })
  ```
- If the `--version` check fails on the absolute path, log: "headroom is on PATH but
  may not be accessible from MCP context. Run `headroom mcp install` manually after
  restarting your terminal."
- For WSL2 detection, read `/proc/version` and check for `microsoft` to distinguish WSL2
  from native Linux. If WSL2: add a warning "If you use native Windows Claude Code (not
  WSL), run `headroom mcp install` in PowerShell, not WSL, for MCP registration."
- Do NOT use the `is-wsl` npm package — avoid new dependencies. The one-liner check is:
  ```typescript
  const isWsl = process.platform === 'linux' &&
    (await readFile('/proc/version', 'utf-8').catch(() => '')).toLowerCase().includes('microsoft')
  ```

**Phase:** Headroom validation phase. Test on WSL2 with uv freshly installed.

---

### H4: Headroom Validation — MCP Config Registered With Stale Absolute Path After Tool Reinstall

**What goes wrong:**
`configure-mcp.ts` resolves the absolute path to headroom with `which headroom` and registers
it via `claude mcp add -s user headroom <absolutePath>`. This is correct at registration time.
But if the user later runs `uv tool upgrade headroom-ai` or uninstalls and reinstalls, uv may
create a new tool environment directory with a different path (e.g., a new hash in
`~/.local/share/uv/tools/headroom-ai-xyz/`). The OLD absolute path registered in the MCP
config is now a broken symlink or a nonexistent path.

The `headroom mcp status` idempotency check exits 0 (it checks config existence, not path
validity), so `configureMcp()` skips re-registration on the next init run. The MCP server
is registered but points to a path that does not exist.

**Why it happens:**
The idempotency check (`headroom mcp status`) validates registration state, not binary
reachability. These are different things.

**Prevention:**
- The validation step added in v1.2.0 should check BOTH `headroom mcp status` exit code
  AND `existsSync(absolutePath)` using the path that status reports.
- If the registered path no longer exists, re-run `claude mcp add -s user headroom <newPath>`
  to update the registration.
- Log: "headroom MCP path updated — binary was reinstalled at a new location."
- Add a test: mock `headroom mcp status` to return exit 0 with a path that does not exist →
  assert that configureMcp re-registers with the correct current path.

**Phase:** Headroom validation phase.

---

### H5: Headroom Validation — False Positive "Already Installed" When headroom Is on PATH But Not the goodvibes-Installed Version

**What goes wrong:**
`install-headroom.ts` probes `execa('headroom', ['--version'])`. If the user has headroom
installed via a different mechanism (direct pip, system package, a different uv environment),
this probe exits 0 and returns "headroom already installed — skipping." The installed version
may be outdated (missing compression improvements), or may be the wrong variant (headroom
without `[all]` extras, meaning compression is disabled). The `[all]` extras are required
for full functionality including ONNX model access.

**Prevention:**
- The probe should check the version string and warn if it is below a known minimum:
  ```typescript
  const { stdout } = await execa('headroom', ['--version'])
  // parse stdout for version number
  if (versionBelow(stdout, '0.20.0')) {
    log('headroom is installed but may be an older version — consider `uv tool upgrade headroom-ai[all]`')
  }
  ```
- Also check for the presence of `[all]` functionality by probing a compression-specific
  subcommand: `headroom compress --help` should exit 0 if the extra is installed.
- Document the minimum supported headroom version in STACK.md and the validation code.

**Phase:** Headroom validation phase.

---

## Phase-Mapped Prevention Plan — v1.2.0

| Phase | Topic | Pitfall ID | Core Risk | Prevention |
|-------|-------|-----------|-----------|------------|
| Telemetry | PII in transport | T1 | IP address is PII even with no stored body | Use Plausible/Fathom or Cloudflare Worker that discards IP; document in TELEMETRY.md |
| Telemetry | Opt-out disclosure | T2 | Default-on without disclosure destroys trust | Show one-line disclosure in init intro; honour DO_NOT_TRACK, CI, GOODVIBES_NO_TELEMETRY |
| Telemetry | Network failure | T3 | Synchronous telemetry blocks init on firewalls | Fire-and-forget with 1-second AbortController timeout; never retry; check CI env |
| Telemetry | Process exit race | T4 | In-flight fetch abandoned before TCP completes | Race telemetry against tasks + 1s post-tasks grace; test with artificial delay |
| Telemetry | PII in payload | T5 | Error strings contain home directory paths | Send only categorical codes, never error text or paths; assert in test |
| Update command | Customization loss | U1 | upgrade overwrites user-modified managed files | Write .bak before overwrite; add --force flag; test modified skill file survives |
| Update command | Partial upgrade state | U2 | Partial copy + failed CLAUDE.md update = inconsistent version | Validate write permissions before starting; verify sentinel updated after; add mid-copy failure test |
| Update command | Sentinel corruption | U3 | SENTINEL_START without SENTINEL_END creates data loss | Guard on endIdx === -1; treat as Case B; test in both TS and Python |
| Update command | Version proxy | U4 | CLAUDE.md version used as sole template-freshness proxy | Add --force bypass; document version assumption; add inversion test |
| Update command | Over-reporting | U5 | "Files updated" lists all managed files, not just changed | Use pre-computed changes list as return value; test single-file update |
| Headroom validation | False passing probe | H1 | headroom --version exits 0 but compression broken | Probe with compress --help or mcp status path check; warn on validation failure |
| Headroom validation | Windows hang | H2 | Rust extension deadlock on Windows Python 3.13 | 10-second timeout on all headroom probes; log upstream issue link; test on windows-latest |
| Headroom validation | WSL2 ambiguity | H3 | WSL2 reports linux, PATH stale, Windows app misses MCP config | Verify absolute path works; detect WSL2 via /proc/version; warn about native Windows Claude Code |
| Headroom validation | Stale MCP path | H4 | Reinstall breaks registered absolute path | Re-register if registered path no longer exists; test stale path scenario |
| Headroom validation | Wrong variant | H5 | headroom[all] not installed, compression disabled | Probe compress --help; warn on old version; document minimum supported version |

---

## v1.1.0 Polish & Discoverability — Milestone-Specific Pitfalls

This section covers pitfalls introduced by the five feature areas in the v1.1.0 milestone:
`--minimal` flag, init hardening for existing projects, beginner-friendly error messages,
terminal demo GIF for README, and README overhaul. Each pitfall names the phase where it
belongs based on build sequence.

---

### M1: --minimal + --dry-run Combination Is Untested and Silently Broken

**What goes wrong:**
`goodvibes init --minimal --dry-run` reaches the `if (dryRun)` early-return branch in
`init.ts` before `minimal` is ever used. The dry-run output lists all template files,
including the CI workflows that `--minimal` would skip, because `listTemplateFiles` does
not receive the `minimal` flag. Users see "Would write: .github/workflows/ci.yml" in the
dry-run preview even though `--minimal` would never write that file.

**Why it happens:**
The dry-run path (lines 23-36 of `init.ts`) calls `listTemplateFiles(templateDir)` without
passing `minimal`. The actual filtering that `--minimal` applies lives inside `copyTemplates`
with a `filter` callback that gates on `src.includes('.github/workflows')`. The two code
paths diverge — dry-run has no knowledge of the minimal filter.

**Consequences:**
- The `--dry-run` preview is wrong when combined with `--minimal`
- No test currently covers `--dry-run --minimal` together (only each flag alone)
- A user validating a minimal install before committing sees phantom files that will not be written

**Warning signs:**
`listTemplateFiles` is called in the dry-run path with no `minimal` argument. The test matrix
in `init.test.ts` has three cases: `--dry-run` alone, `--minimal` alone, and normal run.
The combination case is absent.

**Prevention:**
- Pass `minimal` to `listTemplateFiles` or add a filter step after it that mirrors the
  `copyTemplates` filter logic.
- Add a unit test: `--dry-run --minimal` should NOT show `.github/workflows/` files in output.
- Add a unit test: `--dry-run --minimal` should show CLAUDE.md and skills files.
- Follow a rule: every new boolean flag must have a test for each existing flag crossed with it.

**Phase:** Address in the same phase as `--minimal` output polish (the "minimal flag" phase).

---

### M2: --minimal Skips CI Workflows But the "Next Steps" Note Does Not Reflect This

**What goes wrong:**
When `--minimal` is used, the post-run "Next steps" note (lines 74-79 of `init.ts`) is
identical to the non-minimal run. It still tells the user to open Claude Code and add the
ponytail plugin but says nothing about what was skipped. A beginner who ran `--minimal`
to avoid headroom/CI complexity has no confirmation that CI was skipped, no explanation of
why, and no path to add it later.

**Why it happens:**
The `nextSteps` string is constructed before the `minimal` flag is consulted. This is a
presentation bug caused by copy-pasting the outro block without branching on `minimal`.

**Consequences:**
- Beginner confusion: "Did CI install? Should I expect CI on GitHub?"
- No guidance on how to add CI later if the user decides they want it
- The test that checks "next-steps note contains exactly 3 numbered items" passes for both
  minimal and non-minimal runs — it does not validate content varies by flag

**Prevention:**
- Branch the "Next steps" note on `minimal`: in minimal mode, add a line "CI workflows
  were skipped. Run `goodvibes init` without --minimal to add them."
- Add a test asserting that the minimal run's next-steps note contains the skip mention.
- Add a test asserting the non-minimal run's next-steps note does NOT contain it.

**Phase:** Minimal flag polish phase.

---

### M3: init Hardening — `overwrite: false` Silently Skips Files In Existing Projects Without Telling the User

**What goes wrong:**
`copyTemplates` passes `overwrite: false` to `fs-extra`'s `copy()`. On an existing project,
every file that already exists is silently skipped. The function's return value walks
`destDir` after copy, so the returned file list includes all files in the destination,
not just the ones newly written. A user re-running init in an existing project sees the
"Files created" note list every file and assumes everything was refreshed.

**Why it happens:**
`copy({ overwrite: false })` never throws and never reports skipped files. `walkDir(destDir)`
post-copy includes pre-existing files. The caller has no way to distinguish "written now"
from "already existed, skipped."

**Consequences:**
- A user who ran init once, then deleted `.claude/skills/caveman/` by mistake, re-runs init
  expecting to restore it. The skills are not re-created because other files still exist
  and the walk returns the full dest, so the output looks successful.
- An existing project's `.github/workflows/ci.yml` (perhaps a heavily customized one)
  is silently preserved without any notification that a newer template version exists

**Warning signs:**
The return value of `copyTemplates` is the `walkDir(destDir)` result on line 102-103,
not a list of files that were actually written. The test "skips existing files without
overwriting" verifies the skip but does not verify what is reported to the user.

**Prevention:**
- Track written vs skipped separately: collect filenames that `copy()` touches by using
  a custom filter that counts writes, or compare dest state before/after.
- In the user-facing "Files created" note, distinguish: "3 written, 2 skipped (already exist)."
- Add a `--force` flag (or prompt in interactive mode) to overwrite managed files during
  hardening work.
- Write an integration test: init on a project where some files exist → return value must
  only list the newly written files.

**Phase:** init hardening phase.

---

### M4: init Hardening — Hidden File Detection Fails for .github Directories That Already Exist

**What goes wrong:**
`copy({ overwrite: false, errorOnExist: false })` does not detect directory conflicts, only
file conflicts. If `.github/` already exists (very common in any existing GitHub project)
but `.github/workflows/ci.yml` does not, the copy succeeds but the rename step
(`ci-${projectType}.yml` → `ci.yml`) may collide with a user's existing `ci.yml` written
by a different tool. The rename overwrites silently because `rename()` does not check for
an existing destination.

**Why it happens:**
`node:fs/promises rename()` (line 91 of `copy-templates.ts`) is not safe against
pre-existing destinations — it replaces without warning on Linux/macOS. The guard
`existsSync(variantPath)` checks whether the variant file was written but not whether
`ci.yml` already exists in the destination.

**Consequences:**
- A user with an existing `ci.yml` (perhaps from Vercel, Netlify, or a prior tool) has it
  silently overwritten with the goodvibes CI template
- This is catastrophic for existing CI pipelines and is exactly the kind of "clobbering"
  that `overwrite: false` was meant to prevent

**Warning signs:**
The rename guard at line 90-93 of `copy-templates.ts` only checks for the variant source
file, not for the dest `ci.yml` target.

**Prevention:**
- Before `rename()`, check `existsSync(ciPath)`. If it exists, skip the rename and log a
  warning: ".github/workflows/ci.yml already exists — skipping. Your existing CI config
  was not modified."
- Add an integration test: run `copyTemplates` into a tmpdir that already has a custom
  `ci.yml` → verify custom file is preserved.
- Surface the skipped CI note in the user-facing output alongside the file list.

**Phase:** init hardening phase, same ticket as M3.

---

### M5: init Hardening — No Detection of "Existing Project With Its Own CLAUDE.md Style"

**What goes wrong:**
`mergeClaude` (Case B) appends the goodvibes sentinel block to any existing CLAUDE.md that
lacks a sentinel. This works correctly for the technical merge, but behaviorally it means
a user's carefully tuned CLAUDE.md (perhaps 200 lines of project-specific rules) silently
gets a second block appended. The CLAUDE.md grows unbounded on each goodvibes init re-run
if the sentinel detection logic changes.

More specifically: Case B appends the block then returns. If the user's file has no trailing
newline, the sentinel block is appended with `\n\n` but no final `\n`. Editors and git will
show the file as having a missing trailing newline.

**Why it happens:**
`mergeClaude` line 43-45: `existing.trimEnd() + '\n\n' + templateBlock + '\n'`. The `trimEnd()`
call removes trailing whitespace before appending, which is correct, but the output ends with
`templateBlock + '\n'`. If `templateBlock` itself does not end with `\n`, the result is fine.
But if the user's file ends with content other than newline, the double-newline separator may
be insufficient for some diff tools.

**Consequences:**
- Users with existing CLAUDE.md files get an appended block they may not expect or want
- The "Files created" output shows CLAUDE.md as part of the result even when only the
  sentinel was merged, giving the impression the entire file was rewritten

**Prevention:**
- Before appending in Case B, print a warning: "Your existing CLAUDE.md was updated to add
  goodvibes rules. Your existing content was preserved above the new section."
- The init hardening phase should add a prompt in interactive mode for Case B: "CLAUDE.md
  found without goodvibes section. Append goodvibes rules? [Y/n]"
- Add an integration test specifically for a CLAUDE.md that does not end with a newline

**Phase:** init hardening phase.

---

### M6: Beginner Error Messages — Platform-Specific Paths in Log Output

**What goes wrong:**
`installHeadroom` logs:
- `"Install Python 3.10+ and run 'goodvibes init' again."` — this is fine
- `"uv tool install 'headroom-ai[all]'"` — works on macOS/Linux; on Windows CMD this
  fails because single quotes in CMD require escaping or are treated literally

`configureMcp` logs:
- `"run 'headroom mcp install' manually"` — again single-quoted for shell but problematic on Windows CMD

**Why it happens:**
Shell quoting conventions are not cross-platform. Single quotes are POSIX shell syntax and are
not interpreted by Windows CMD.EXE at all — they become literal characters in the argument.

**Consequences:**
- A Windows CMD user copies the error message, pastes it verbatim, and gets either a
  "The system cannot find the file" or an unexpected argument error
- WSL2 users may be fine, but native Windows users (a documented target for goodvibes) are not

**Warning signs:**
Any log message that contains a shell command with single-quoted arguments is at risk.
The STACK.md already flags Python detection on Windows as MEDIUM confidence.

**Prevention:**
- Use backtick quoting in user-facing messages rather than single quotes, which reads
  well in terminal output without implying shell syntax: "run `uv tool install headroom-ai[all]`"
- Or use double quotes and document that Windows CMD users should use PowerShell
- Add a platform check: on Windows, emit the PowerShell-compatible version of the command
- In error message tests, assert the message does not contain raw single quotes around
  shell arguments

**Phase:** Error message polish phase.

---

### M7: Beginner Error Messages — Verbosity / Tone Mismatch Between Steps

**What goes wrong:**
The headroom install step can emit up to three distinct log lines before the user gets
context compression benefits. For example, on a slow connection with uv available:
1. "Note: headroom will download its compression model on first use — this may take 1–3 minutes..."
2. (headroom install succeeds silently)
3. "headroom ready" (from the task return value)

But if uv fails and pipx also fails and pip is tried and fails for a build reason:
1. The 1-3 minute warning fires
2. "headroom install failed: [long error]"
3. "You can install headroom manually later: uv tool install 'headroom-ai[all]'"

The tone of message 3 ("You can install headroom manually later") reads like a casual
suggestion, not an actionable error. A beginner will not follow this instruction because
it does not explain what headroom does or why they should care.

**Why it happens:**
Log messages were written to explain the technical state to a developer, not to guide a
complete beginner who does not know what headroom is.

**Consequences:**
- The core feature (context compression) silently does not activate for users who hit
  build failures
- Beginners see "all set!" outro but headroom is not running — the most valuable feature
  of goodvibes is missing

**Prevention per clig.dev principles:**
- Frame error messages as guidance: "headroom couldn't be installed automatically.
  Without it, Claude will use more tokens per session. To install it later, run:
  `uv tool install headroom-ai[all]`"
- Never print more than one "next step" command at a time. The user can only act on one
  instruction.
- The outro ("You're all set!") should be conditional: if any step partially failed, use
  a neutral outro like "Setup complete — see notes above."

**Phase:** Error message polish phase.

---

### M8: Beginner Error Messages — Missing Exit Code Differentiation for Partial Success

**What goes wrong:**
If headroom install fails (build error) but templates were successfully copied, the CLI
exits 0. If headroom install fails AND MCP registration fails, the CLI still exits 0.
A script wrapping `goodvibes init` (e.g., a CI setup step) cannot tell partial success
from full success.

**Why it happens:**
The task runner (`@clack/prompts` `tasks()`) catches all exceptions inside the task
functions. Individual tasks log warnings via the `message` callback but do not propagate
failures as rejected promises (the install-headroom step catches and logs, then returns
without re-throwing). The command-level `action` handler has no mechanism to accumulate
partial failures.

**Consequences:**
- Automation scripts using `goodvibes init` in CI cannot detect partial installs
- Beginners who pipe init output to a log file lose the warning messages if stderr is
  not captured alongside stdout

**Prevention:**
- Accumulate a list of warnings at the action level. After `tasks()` completes, if any
  warnings exist, print a summary and exit with code 2 (warnings/partial success) rather
  than 0 or 1.
- Alternatively, commit to "soft failures are always exit 0" and document this explicitly,
  so automation wrapping goodvibes does not try to parse exit codes for partial state.
- Add a test: when `installHeadroom` logs a warning, the command-level exit code is
  non-zero (or clearly documented as 0 with warnings).

**Phase:** Error message hardening phase.

---

### M9: Terminal Demo GIF — Becomes Stale When CLI Output Changes

**What goes wrong:**
A demo GIF recorded against v1.1.0 output shows "@clack/prompts" spinner text and task
titles that match the current wording. When v1.2.0 renames a task title (e.g., "Copying
template files" → "Installing template"), the GIF is wrong but no automated gate catches
the drift. The README shows a GIF that does not match what the user will actually see
when they run the tool.

**Why it happens:**
GIFs are binary blobs committed to git. There is no CI check that compares GIF content
to CLI output. VHS `.tape` files can be committed alongside the GIF, but only if someone
remembers to re-run vhs and commit the updated binary.

**Consequences:**
- README makes the tool look unreliable or poorly maintained
- First-time users who follow the GIF get confused when their terminal output differs
- No automated signal when the GIF is stale

**Warning signs:**
GIF committed to git without an accompanying `.tape` source file. No CI step that re-renders
the GIF or at minimum verifies the tape file's commands match current CLI output.

**Prevention:**
- Commit the VHS `.tape` file alongside the GIF so the recording recipe is version-controlled.
- Add a CI step on the `main` branch that re-runs the tape and compares output against
  a golden text fixture using VHS's ASCII output mode — not to auto-commit the GIF
  (binary churn) but to detect when CLI output has changed enough to warrant a manual re-record.
- Add a note in CONTRIBUTING.md: "When you change CLI output text, re-record the demo GIF."
- Keep the GIF short (under 30 seconds). Shorter GIFs require fewer re-records.

**Phase:** README/demo phase.

---

### M10: Terminal Demo GIF — File Size and GitHub Rendering Constraints

**What goes wrong:**
A naive VHS recording at `Set Width 1200 / Set Height 600 / Set Framerate 60` produces
a GIF over 10MB. GitHub's README renderer caps embedded GIF display at approximately
10MB. Above that, GitHub shows a "View raw" link instead of the inline animation.
Even below the limit, a 5MB GIF slows README page load for users on mobile or slow
connections.

**Why it happens:**
VHS defaults are optimized for local quality. GitHub Markdown does not resize or compress
embedded GIFs. The frame count multiplied by resolution is the primary size driver.

**Consequences:**
- The "wow moment" that a demo GIF is supposed to create does not happen if the GIF
  requires a separate page load
- Large GIFs in git history bloat clone sizes permanently (git does not deduplicate
  binary blobs between versions)

**Recommended settings for goodvibes (HIGH confidence):**
- `Set Width 800` / `Set Height 400` — readable in GitHub's constrained markdown column
- `Set Framerate 15` — sufficient for CLI output; 30+ fps adds no value for text
- Target <2MB. Use VHS's PNG sequence + `gifski` for better compression than VHS's
  built-in GIF encoder.
- Use animated SVG (via `agg` from asciinema) as an alternative — vector format,
  typically 10-20x smaller than equivalent GIF, renders crisp at any display size.

**Phase:** README/demo phase.

---

### M11: Terminal Demo GIF — VHS Timing Desync When headroom Download Is Variable

**What goes wrong:**
The goodvibes `init` demo must show headroom being installed. But `uv tool install
headroom-ai[all]` takes 5-120 seconds depending on network speed and whether the model
weights are cached. VHS requires explicit `Sleep` commands between steps. If the demo
uses a mocked/fast invocation (e.g., pre-installed headroom) but the tape shows a
"Downloading…" spinner, the GIF shows the spinner completing unrealistically fast.
If the tape uses a real install, CI timing is unpredictable and the recording may
cut off before install completes.

**Why it happens:**
VHS does not auto-advance when a command finishes — it requires the tape author to
predict runtime. Variable-duration network operations are fundamentally at odds with
deterministic GIF recording.

**Prevention:**
- Record the demo with headroom pre-installed or mocked. Do not attempt to show the
  real download in the GIF — the resulting timing will be wrong.
- Use VHS `Type` + pre-seeded output files to simulate what a real run looks like
  without executing it. This is the standard approach for CLI demos.
- Alternatively, record the demo with `--minimal` (which skips headroom) so the demo
  runs in under 5 seconds and produces deterministic output.
- Add a VHS comment explaining the setup assumption so future maintainers understand
  why the recording environment is pre-configured.

**Phase:** README/demo phase.

---

### M12: README Overhaul — Instructions Drift from CLI Behavior

**What goes wrong:**
The current README (reviewed 2026-06-26) documents:
- `pip install jgiox-goodvibes` — the PyPI package name, which may change on publish
- The `Flags` section lists `--dry-run` and `--minimal` but does not explain what
  `--minimal` actually skips (no mention of CI workflows or headroom)
- "Running it a second time is safe" — correct for CLAUDE.md via sentinel merge but
  does not explain the behavior for skill files (overwrite: false) or the CI variant
  rename (which would be skipped but not reported)

If the init hardening changes in M3 and M4 modify user-facing behavior, the README
must be updated in the same commit or the docs immediately drift.

**Prevention:**
- Add a rule to CONTRIBUTING.md: any PR that changes CLI output text, flag behavior,
  or file-writing behavior must update the relevant README section.
- Add a PR template checklist item: "Did you update the README's Flags section if
  you added or changed a flag?"
- The "Flags" section should list what each flag skips, not just what it is.
  Example: `--minimal: Installs CLAUDE.md and skills only. Skips headroom install
  and .github/workflows/.`

**Phase:** README overhaul phase.

---

### M13: README Overhaul — Badge Rot and Broken Dynamic Badges

**What goes wrong:**
A typical goodvibes README might include:
- npm version badge from `shields.io/npm/v/@jgiox/goodvibes`
- PyPI version badge
- CI passing badge from GitHub Actions
- License badge

Shields.io serves over 1.6 billion images/month and is generally reliable. However:
- If the npm package is renamed from `@jgiox/goodvibes` to `goodvibes`, the version
  badge URL silently returns a "package not found" gray badge
- The CI badge URL encodes the exact workflow filename. If `.github/workflows/ci.yml`
  is renamed, the badge shows "no status" indefinitely without a visible error
- Dynamic badges based on external services (coverage services, download counts) can
  rate-limit and show cached stale values

**Prevention:**
- Use static badges for anything that does not change frequently (license, language).
- Use only `GITHUB_TOKEN`-compatible badges that pull from the repo itself, not external
  services that may require authentication or have rate limits.
- Encode the full package name in badge URLs as a constant so renaming is one grep away.
- Test badge URLs in a browser before committing — a gray "error" badge is worse than
  no badge.
- Limit total badge count to 3-4. More badges = more maintenance surface.

**Phase:** README overhaul phase.

---

### M14: README Overhaul — Beginner Quickstart Assumes Too Much

**What goes wrong:**
The current README lists prerequisites in a table (git, GitHub account, Node.js 20+,
Python 3.10+) but does not tell the user HOW to verify they have them. A complete
beginner does not know to run `node --version` to check their Node version, or that
`python3 --version` might show 3.9 instead of 3.10.

The Windows note ("Use WSL2 for the best experience") is mentioned as a suggestion but
gives no install command for WSL2, and a beginner on Windows cannot distinguish "WSL2
is an option" from "WSL2 is required."

**Prevention:**
- For each prerequisite, add a one-line verification command: "Check: `node --version`
  (must show v20 or higher)"
- For Python, note that `python3 --version` on macOS may show the Xcode stub and link
  to python.org
- Clarify the Windows note: "WSL2 is recommended but not required. To install WSL2, run
  `wsl --install` in PowerShell as Administrator."
- Add a "Troubleshooting" or "If something went wrong" section at the bottom with the
  3-4 most common failure modes and their fixes (Python not found, Node too old, git
  not installed).

**Phase:** README overhaul phase.

---

## Phase-Mapped Prevention Plan — v1.1.0

| Phase | Topic | Pitfall ID | Core Risk | Prevention |
|-------|-------|-----------|-----------|------------|
| --minimal flag | Flag interaction | M1 | --dry-run + --minimal combination broken | Pass minimal to dry-run file list; add combination test |
| --minimal flag | UX copy | M2 | Next steps note doesn't branch on minimal | Branch outro on minimal; test content differs by flag |
| init hardening | File write tracking | M3 | "Files created" lists pre-existing files | Track written vs skipped; differentiate in output |
| init hardening | CI rename safety | M4 | rename() clobbers existing ci.yml | Guard rename on existsSync(ciPath); add integration test |
| init hardening | CLAUDE.md merge UX | M5 | Silent append confuses existing-project users | Warn in interactive mode; integration test on non-newline CLAUDE.md |
| Error messages | Cross-platform quoting | M6 | Single-quoted commands break Windows CMD | Use backticks in messages; platform-aware command suggestion |
| Error messages | Tone / verbosity | M7 | Partial failures described as casual suggestions | Frame as guidance: what failed + why it matters + one fix |
| Error messages | Exit code | M8 | Partial install exits 0 indistinguishably | Accumulate warnings; use exit 2 for partial or document exit 0 |
| Demo GIF | Stale detection | M9 | GIF drifts from CLI output with no gate | Commit .tape file; CI golden-text check; CONTRIBUTING note |
| Demo GIF | File size | M10 | GIF too large for inline GitHub rendering | Width 800, framerate 15, target <2MB; consider animated SVG |
| Demo GIF | Timing | M11 | headroom download timing incompatible with VHS | Use pre-installed or mocked headroom; record --minimal demo |
| README | Docs drift | M12 | Flag behavior changes not reflected in docs | PR checklist; Flags section describes what is skipped |
| README | Badge rot | M13 | Renamed package breaks badge URLs | Static badges; test URLs before commit; limit to 3-4 badges |
| README | Beginner quickstart | M14 | Prerequisites listed but not verifiable | Add verification commands; clarify Windows note |

---

## Critical Pitfalls (v1.0, Ship-Blockers)

These were identified during initial development (v1.0). They are included here for
completeness and because some remain partially relevant to v1.1.0 work.

---

### CRITICAL-1: npm v12 Blocks postinstall Scripts by Default (July 2026)

**What goes wrong:**
npm v12 (shipping July 2026, warnings already active in npm 11.16+) will block all `preinstall`,
`install`, and `postinstall` lifecycle scripts from executing unless the user explicitly
allowlists them. If goodvibes uses a postinstall script to install headroom, it will silently
do nothing on npm v12 without any obvious error.

**Prevention:**
Do NOT rely on `postinstall` for headroom installation. Make headroom installation a separate
explicit step: `npx goodvibes init` calls headroom setup as part of its own runtime logic,
not as a lifecycle hook.

**Which phase:** Phase 1 (core installer design).

**Source:** [GitHub Changelog: Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)

---

### CRITICAL-2: npx ENOENT / spawn Failures on Windows

**What goes wrong:**
`npx goodvibes` fails on Windows with `Error: spawn ENOENT` before any user-visible output.
The user sees a cryptic Node.js error.

**Prevention:**
Use `execa` (already in use) instead of raw `child_process.spawn`. Never use `python3` — use
`python` or the `py` launcher. Test on `windows-latest` GitHub Actions runner.

**Which phase:** Phase 1 (CLI scaffolding foundation).

---

### CRITICAL-3: Python Not Found / Wrong Python Version at Runtime

**What goes wrong:**
`goodvibes init` calls pip/uv for headroom but Python is absent, aliased to Python 2, or
headroom's binary lands in a PATH location the user's shell does not see.

**Prevention:**
Priority-chain Python probe (`python3` → `python` → `py`). Recommend `uv tool install`
which handles PATH automatically. Already implemented in `detect-python.ts` — maintain the
fallback chain.

**Which phase:** Phase 2 (headroom integration).

---

### CRITICAL-4: Silent Failures and Zero-Information Error Output

**What goes wrong:**
An error during init exits 0 with no user-visible indication of failure.

**Prevention:**
Every error path: (1) human-readable message, (2) non-zero exit code. Global unhandled
rejection handler. Post-init self-check. (Partially addressed by the install-headroom soft-fail
pattern; M8 above tracks the remaining gap.)

**Which phase:** Phase 1 and 2.

---

### QUALITY-1: CLAUDE.md That Is Too Long and Gets Ignored

**What goes wrong:**
A CLAUDE.md over ~150 lines causes Claude to follow fewer of the rules as the session
progresses. Auto-generated CLAUDE.md files (produced by LLMs) perform worse than no file.

**Prevention:**
Ship a minimal, opinionated CLAUDE.md. Move task-specific instructions to `.claude/skills/`.
Keep the template under 80 lines. (Implemented — goodvibes ships a versioned CLAUDE.md with
sentinel for upgrade tracking.)

---

### QUALITY-2: npx Cold-Start Latency Kills First Impressions

**What goes wrong:**
`npx goodvibes init` takes 10-30 seconds before output appears. Beginners Ctrl-C thinking
it has hung.

**Prevention:**
Zero-dependency npm bundle. `@clack/prompts` prints a spinner within 500ms. Keep the bundle
lean — current `package.json` has four production dependencies, which is appropriate.

---

### QUALITY-3: GitHub Template Repo — No Auto-Sync

**What goes wrong:**
Users who fork the template have no mechanism to receive goodvibes updates.

**Prevention:**
`goodvibes upgrade` command already shipped in Phase 5. Sentinel versioning in CLAUDE.md
allows staleness detection.

---

### QUALITY-4: Overwriting Existing Files Without Warning

**What goes wrong:**
Init silently overwrites hand-edited files. (Core issue addressed by `overwrite: false`.
Reporting gap tracked as M3 above.)

---

### QUALITY-5: Maturin/PyO3 Cross-Compilation Failures for headroom Rust Wheels

**What goes wrong:**
headroom wheels fail on Alpine (musl), older manylinux, or non-x86_64 targets.

**Prevention:**
Use `cibuildwheel` matrix in CI. Never cross-compile. This is a headroom upstream concern
for goodvibes' purposes — goodvibes defers to `uv tool install headroom-ai[all]` and does
not build wheels itself.

---

### QUALITY-6: GitHub Actions Workflow — Wrong Directory, Missing Permissions

**What goes wrong:**
Scaffolded workflow fails on first push due to directory typo, missing permissions block,
or undefined secrets.

**Prevention:**
Validate YAML before writing. Use only `GITHUB_TOKEN`. Print "push to main to activate"
in the init outro. (Already implemented in the CI scaffold from Phase 4.)

---

### QUALITY-7: Apache 2.0 NOTICE File Omission When Forking MIT-Licensed Code

**What goes wrong:**
Forking Apache 2.0 code without preserving NOTICE file is a Section 4d violation.

**Prevention:**
Maintain `THIRD_PARTY_LICENSES`. Run `license-checker` in CI. Document in CONTRIBUTING.md.

---

### BEGINNER-1 through BEGINNER-5

(UX pitfalls for complete beginners: information overload, prerequisite errors without
actionable guidance, empty docs scaffold, git not initialized, opaque skill file names.)

These remain relevant. M7 and M14 above extend them specifically for the v1.1.0 feature set.

---

## Sources

- [GitHub Changelog: Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [GitHub CLI: Opt-out usage telemetry — GitHub Changelog](https://github.blog/changelog/2026-04-22-github-cli-opt-out-usage-telemetry/)
- [GitHub CLI Silently Enables Telemetry: Opt-Out Is Wrong — byteiota](https://byteiota.com/github-cli-silently-enables-telemetry-opt-out-is-wrong/)
- [The Impact of GitHub CLI Pseudoanonymous Telemetry on Developer Privacy — Softix](https://thesoftix.com/github-cli-telemetry-developer-privacy/)
- [GitHub CLI v2.91.0 Turns On Default Telemetry — Groundy](https://groundy.com/articles/github-cli-v2910-turns-on-default-telemetry-what-gh-collects-and-how-to-opt-out/)
- [DO_NOT_TRACK — donottrack.sh](https://donottrack.sh/)
- [Is an IP address considered personal data? — TechGDPR](https://techgdpr.com/blog/is-an-ip-address-considered-personal-data/)
- [Plausible Analytics: Privacy-first, no IP logging, GDPR compliant](https://plausible.io/data-policy)
- [6 telemetry best practices for CLI tools — Massimiliano Marcon](https://marcon.me/articles/cli-telemetry-best-practices/)
- [Telemetry: switch to explicit opt-in (GDPR + transparency) — blender-mcp issue #232](https://github.com/ahujasid/blender-mcp/issues/232)
- [headroom Windows Python 3.13 hang — headroomlabs-ai/headroom issue #845](https://github.com/headroomlabs-ai/headroom/issues/845)
- [headroom MCP/direct compression hangs on Windows — headroomlabs-ai/headroom issue #600](https://github.com/headroomlabs-ai/headroom/issues/600)
- [headroom wrap kills shared proxy (ConnectionRefused) — headroomlabs-ai/headroom issue #804](https://github.com/headroomlabs-ai/headroom/issues/804)
- [WSL2 fixing MCP Server Timeouts in Cursor — Medium](https://medium.com/@kidane10g/wsl2-fixing-mcp-server-timeouts-in-cursor-fe7f06bb8683)
- [is-wsl — sindresorhus/is-wsl (GitHub)](https://github.com/sindresorhus/is-wsl)
- [Updating projects in copier — copier docs](https://copier.readthedocs.io/en/stable/updating/)
- [CLI Guidelines (clig.dev) — error messages, tone, actionable guidance](https://clig.dev/)
- [Error Handling in CLI Tools — Chloe Zhou, Medium](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9)
- [10 design principles for delightful CLIs — Atlassian](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis)
- [VHS — charmbracelet/vhs (GitHub)](https://github.com/charmbracelet/vhs)
- [VHS Action — GitHub Marketplace](https://github.com/marketplace/actions/vhs-action)
- [VHS inconsistent playback speed issue #367](https://github.com/charmbracelet/vhs/issues/367)
- [agg — asciinema gif generator docs](https://docs.asciinema.org/manual/agg/)
- [Creating High Quality GIFs from Asciinema — DEV Community](https://dev.to/nelsonfigueroa/creating-high-quality-gifs-from-asciinema-recordings-4091)
- [Enhance Your Readme With Asciinema — César Soto Valero](https://www.cesarsotovalero.net/blog/enhance-your-readme-with-asciinema.html)
- [Badge Images Often Fail To Load In Github README — shields/shields issue #1568](https://github.com/badges/shields/issues/1568)
- [Shields.io — badges/shields](https://github.com/shields/shields)
- [Doc Drift Detection in CI — understandingdata.com](https://understandingdata.com/posts/doc-drift-detection-ci/)
- [I Wrote 200 Lines of Rules for Claude Code. It Ignored Them All.](https://dev.to/minatoplanb/i-wrote-200-lines-of-rules-for-claude-code-it-ignored-them-all-4639)
- [Common GitHub Actions Mistakes Beginners Make](https://docs.bswen.com/blog/2026-04-13-github-actions-common-mistakes/)
- [Apache Software Foundation: Applying Apache License](https://www.apache.org/legal/apply-license.html)
- [Scaffold commands should not overwrite existing files — zapier-platform issue #17](https://github.com/zapier/zapier-platform/issues/17)
