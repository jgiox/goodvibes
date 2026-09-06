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
})
