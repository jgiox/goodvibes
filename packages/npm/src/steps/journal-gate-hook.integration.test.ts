import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execa } from 'execa'
import { resolveTemplatesDir } from './copy-templates.js'

// Extracts the hook's inline command string from the real templates/.claude/settings.json.
// At this point in the plan (RED step) `hooks` does not exist yet, so this throws/returns
// undefined and every test below fails — that's the intended RED signal for Task 1.
function getHookCommand(): string {
  const settingsPath = join(resolveTemplatesDir(), '.claude', 'settings.json')
  const data = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  return data.hooks.PreToolUse[0].hooks[0].command
}

async function runHook(command: string, cwd: string): Promise<{ exitCode: number; stderr: string }> {
  const hookCmd = getHookCommand()
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command } })
  const result = await execa('sh', ['-c', hookCmd], { input: payload, cwd, reject: false })
  return { exitCode: result.exitCode ?? -1, stderr: result.stderr }
}

describe('journal-gate hook', () => {
  let repoDir: string

  beforeEach(async () => {
    repoDir = mkdtempSync(join(tmpdir(), 'gv-journal-gate-'))
    await execa('git', ['init'], { cwd: repoDir })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir })
    await execa('git', ['config', 'user.name', 'Test'], { cwd: repoDir })
    // JOURNAL.md exists in the working tree but is NOT staged, per each scenario's default
    const journalPath = join(repoDir, 'JOURNAL.md')
    await execa('sh', ['-c', `printf '# journal\\n' > "${journalPath}"`])
  })

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true })
  })

  it('blocks git commit -am when JOURNAL.md is created but not staged', async () => {
    const { exitCode, stderr } = await runHook('git commit -am "fix"', repoDir)
    expect(exitCode).toBe(2)
    expect(stderr.trim()).toBe('BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md')
  })

  it('allows git commit -am when JOURNAL.md is staged first', async () => {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    const { exitCode } = await runHook('git commit -am "fix"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git commit --amend --no-edit even when JOURNAL.md is unstaged', async () => {
    const { exitCode } = await runHook('git commit --amend --no-edit', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git status (not a commit at all)', async () => {
    const { exitCode } = await runHook('git status', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git commit -am when a merge is in progress (MERGE_HEAD present)', async () => {
    mkdirSync(join(repoDir, '.git'), { recursive: true })
    await execa('sh', ['-c', `printf 'abc123\\n' > "${join(repoDir, '.git', 'MERGE_HEAD')}"`])
    const { exitCode } = await runHook('git commit -am "m"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git commit -am when a rebase is in progress (rebase-merge dir present)', async () => {
    mkdirSync(join(repoDir, '.git', 'rebase-merge'), { recursive: true })
    const { exitCode } = await runHook('git commit -am "m"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git commit -am when a rebase is in progress (rebase-apply dir present)', async () => {
    mkdirSync(join(repoDir, '.git', 'rebase-apply'), { recursive: true })
    const { exitCode } = await runHook('git commit -am "m"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks the -C variant (git -C <path> commit) when JOURNAL.md is unstaged', async () => {
    const { exitCode } = await runHook(`git -C ${repoDir} commit -am "x"`, repoDir)
    expect(exitCode).toBe(2)
  })

  it('does not false-positive on commit-tree, a subcommand that merely starts with "commit"', async () => {
    const { exitCode } = await runHook('git commit-tree abc123 -m x', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks a non-amend commit whose message contains the literal text "--amend"', async () => {
    const { exitCode, stderr } = await runHook('git commit -am "note about --amend flag"', repoDir)
    expect(exitCode).toBe(2)
    expect(stderr.trim()).toBe('BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md')
  })

  it('allows a non-commit git command whose arguments contain the substring "git commit"', async () => {
    const { exitCode } = await runHook('git log --grep="please git commit later"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks a non-amend commit with a single-quoted message containing the literal text "--amend"', async () => {
    const { exitCode, stderr } = await runHook("git commit -am 'note about --amend flag'", repoDir)
    expect(exitCode).toBe(2)
    expect(stderr.trim()).toBe('BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md')
  })

  it("blocks a git -C commit targeting a different, unstaged repo even when the hook's own cwd has JOURNAL.md staged", async () => {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    const { exitCode, stderr } = await runHook(`git -C ${otherRepoDir} commit -am "fix"`, repoDir)
    expect(exitCode).toBe(2)
    expect(stderr.trim()).toBe('BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md')
  })

  it("allows a git -C commit targeting a different, staged repo even when the hook's own cwd has JOURNAL.md unstaged", async () => {
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    await execa('git', ['add', 'JOURNAL.md'], { cwd: otherRepoDir })
    const { exitCode } = await runHook(`git -C ${otherRepoDir} commit -am "fix"`, repoDir)
    expect(exitCode).toBe(0)
  })

  it("allows a git -C commit targeting a different repo that is mid-merge, even when the hook's own cwd is not mid-merge and has JOURNAL.md unstaged", async () => {
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    const otherRepoGitDir = join(otherRepoDir, '.git')
    await execa('sh', ['-c', `printf 'abc123\\n' > "${join(otherRepoGitDir, 'MERGE_HEAD')}"`])
    const { exitCode } = await runHook(`git -C ${otherRepoDir} commit -am "fix"`, repoDir)
    expect(exitCode).toBe(0)
  })

  it('does NOT allow a commit via a -C target that is not a git repository (fail-open regression, CR-01)', async () => {
    const notARepo = mkdtempSync(join(tmpdir(), 'gv-not-a-repo-'))
    try {
      const { exitCode, stderr } = await runHook(`git -C ${notARepo} commit -am "fix"`, repoDir)
      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('BLOCKED')
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })

  it('does NOT let an unrelated -C invocation in a chained command override routing for the real commit (CR-02)', async () => {
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    await execa('git', ['add', 'JOURNAL.md'], { cwd: otherRepoDir })
    const { exitCode } = await runHook(`git commit -am "fix" && git -C ${otherRepoDir} status`, repoDir)
    expect(exitCode).toBe(2)
  })

  it('does NOT silently fall back to cwd when a quoted -C path containing a space is used (CR-03)', async () => {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    const spacedParent = join(repoDir, 'path with a space')
    const repoB = join(spacedParent, 'repoB')
    mkdirSync(repoB, { recursive: true })
    await execa('git', ['init'], { cwd: repoB })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(repoB, 'JOURNAL.md')}"`])
    const { exitCode, stderr } = await runHook(`git -C "${repoB}" commit -am "fix"`, repoDir)
    expect(exitCode).toBe(2)
    expect(stderr.trim()).toBe('BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md')
  })

  it('blocks a commit whose message merely contains text shaped like "-C <path>" when the real (non -C) target is unstaged (CR-04)', async () => {
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    await execa('git', ['add', 'JOURNAL.md'], { cwd: otherRepoDir })
    const { exitCode } = await runHook(`git commit -am "see -C ${otherRepoDir} for details"`, repoDir)
    expect(exitCode).toBe(2)
  })

  it('allows a commit whose message merely contains text shaped like "-C /tmp" when the real (non -C) target is staged (CR-05)', async () => {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    const { exitCode } = await runHook('git commit -am "notes -C /tmp for later"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks a commit from an unstaged cwd whose message merely contains the adjacent phrase "git -C <path>" and has no real -C flag (CR-06)', async () => {
    const otherRepoDir = join(repoDir, 'other-repo')
    mkdirSync(otherRepoDir, { recursive: true })
    await execa('git', ['init'], { cwd: otherRepoDir })
    await execa('sh', ['-c', `printf '# journal\\n' > "${join(otherRepoDir, 'JOURNAL.md')}"`])
    await execa('git', ['add', 'JOURNAL.md'], { cwd: otherRepoDir })
    const { exitCode } = await runHook(`git commit -am "see git -C ${otherRepoDir} for the fix"`, repoDir)
    expect(exitCode).toBe(2)
  })

  it('allows a commit from a staged cwd whose message merely contains the adjacent phrase "git -C <token>" and has no real -C flag (CR-07)', async () => {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    const { exitCode } = await runHook('git commit -am "fix: git -C anchor bypass in journal-gate hook"', repoDir)
    expect(exitCode).toBe(0)
  })
})
