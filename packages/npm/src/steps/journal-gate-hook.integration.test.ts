import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
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

async function runHook(
  command: string,
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number; stderr: string }> {
  const hookCmd = getHookCommand()
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command } })
  const result = await execa('sh', ['-c', hookCmd], { input: payload, cwd, env, reject: false })
  return { exitCode: result.exitCode ?? -1, stderr: result.stderr }
}

// Most journal-gate cases live in tests/hooks/journal-gate.cases.json; these need setup that data cannot express.
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

  it('does not run the core.fsmonitor command of a bare repo that the command text only mentions', async () => {
    const marker = join(repoDir, 'fsmonitor-ran')
    const evil = join(repoDir, 'vendor', 'evil')
    await execa('git', ['init', '--bare', evil])
    await execa('git', ['config', '-f', join(evil, 'config'), 'core.bare', 'false'])
    await execa('git', ['config', '-f', join(evil, 'config'), 'core.worktree', '../..'])
    await execa('git', ['config', '-f', join(evil, 'config'), 'core.fsmonitor', `touch '${marker}' #`])
    await runHook('# git -C vendor/evil commit', repoDir)
    await runHook('echo git -C vendor/evil commit -m wip', repoDir)
    expect(existsSync(marker)).toBe(false)
  })

  async function initRepoWithJournal(dir: string, staged: boolean): Promise<void> {
    mkdirSync(dir, { recursive: true })
    await execa('git', ['init'], { cwd: dir })
    writeFileSync(join(dir, 'JOURNAL.md'), '# journal\n')
    if (staged) await execa('git', ['add', 'JOURNAL.md'], { cwd: dir })
  }

  for (const command of ['git -C ~/p commit -m x', 'git -C $HOME/p commit -m x']) {
    it(`expands a leading ~ or $HOME to the home folder: ${command}`, async () => {
      const home = join(repoDir, 'home')
      await initRepoWithJournal(join(home, 'p'), true)
      const { exitCode } = await runHook(command, repoDir, { HOME: home })
      expect(exitCode).toBe(0)
    })
  }
})
