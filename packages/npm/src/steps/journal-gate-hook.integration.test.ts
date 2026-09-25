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

  it('allows a commit in a repo with no JOURNAL.md, which is not a goodvibes project (global install)', async () => {
    rmSync(join(repoDir, 'JOURNAL.md'))
    const { exitCode } = await runHook('git commit -am "fix"', repoDir)
    expect(exitCode).toBe(0)
  })

  async function commitJournal(): Promise<void> {
    await execa('git', ['add', 'JOURNAL.md'], { cwd: repoDir })
    await execa('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', 'init'], { cwd: repoDir })
    writeFileSync(join(repoDir, 'JOURNAL.md'), '# journal\n- entry\n')
  }

  it('allows git add JOURNAL.md && git commit in one command when JOURNAL.md has changes', async () => {
    const { exitCode } = await runHook('git add JOURNAL.md && git commit -m "log"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git add of exact paths including JOURNAL.md && git commit', async () => {
    const { exitCode } = await runHook('git add src.txt JOURNAL.md && git commit -m "log"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows git add -A && git commit when JOURNAL.md has changes', async () => {
    const { exitCode } = await runHook('git add -A && git commit -m "log"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks git add of other paths && git commit when JOURNAL.md is not in the add list', async () => {
    const { exitCode } = await runHook('git add src.txt && git commit -m "log"', repoDir)
    expect(exitCode).toBe(2)
  })

  it('blocks when git add JOURNAL.md runs only after the commit', async () => {
    const { exitCode } = await runHook('git commit -m "log" && git add JOURNAL.md', repoDir)
    expect(exitCode).toBe(2)
  })

  it('blocks git add JOURNAL.md && git commit when JOURNAL.md has no changes', async () => {
    await commitJournal()
    await execa('git', ['checkout', '--', 'JOURNAL.md'], { cwd: repoDir })
    const { exitCode } = await runHook('git add JOURNAL.md && git commit -m "log"', repoDir)
    expect(exitCode).toBe(2)
  })

  it('allows git commit -am when tracked JOURNAL.md is modified in the working tree', async () => {
    await commitJournal()
    const { exitCode } = await runHook('git commit -am "log"', repoDir)
    expect(exitCode).toBe(0)
  })

  it('blocks git commit -m without -a when tracked JOURNAL.md is modified but unstaged', async () => {
    await commitJournal()
    const { exitCode } = await runHook('git commit -m "log"', repoDir)
    expect(exitCode).toBe(2)
  })

  it('allows a heredoc whose body mentions git commit, because nothing is committed', async () => {
    const { exitCode } = await runHook("cat > notes.md <<'EOF'\nremember to git commit later\nEOF", repoDir)
    expect(exitCode).toBe(0)
  })

  it('allows a multi-line command with git on one line and the word commit on a later line', async () => {
    const { exitCode } = await runHook('git status\necho commit', repoDir)
    expect(exitCode).toBe(0)
  })

  it('still blocks a commit fed to a shell through a heredoc', async () => {
    const { exitCode } = await runHook("bash <<'EOF'\ngit commit -m x\nEOF", repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit on the line after a here-string', async () => {
    const { exitCode } = await runHook('cat <<< hi\ngit commit -m x', repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit on the line after a heredoc ends', async () => {
    const { exitCode } = await runHook("cat > n.md <<'EOF'\nhi\nEOF\ngit commit -m x", repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks git commit -F - whose message comes from a heredoc', async () => {
    const { exitCode } = await runHook("git commit -F - <<'EOF'\nmsg\nEOF", repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit whose multi-line message mentions commit -a when JOURNAL.md is only modified', async () => {
    await commitJournal()
    const { exitCode } = await runHook('git commit -m "x\nuse commit -a next time"', repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit after a heredoc whose delimiter contains punctuation', async () => {
    const { exitCode } = await runHook('cat <<END-MARK\ntext\nEND-MARK\ngit commit -m x', repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit inside a heredoc that is never terminated', async () => {
    const { exitCode } = await runHook('cat <<EOF\ngit commit -m x', repoDir)
    expect(exitCode).toBe(2)
  })

  it('allows a heredoc piped to grep bash whose body mentions git commit', async () => {
    const { exitCode } = await runHook('cat <<EOF | grep bash\nremember to git commit\nEOF', repoDir)
    expect(exitCode).toBe(0)
  })

  it('still blocks a commit in a heredoc piped to bash', async () => {
    const { exitCode } = await runHook('cat <<EOF | bash\ngit commit -m x\nEOF', repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit in a heredoc fed to sudo -u someone bash', async () => {
    const { exitCode } = await runHook('sudo -u me bash <<EOF\ngit commit -m x\nEOF', repoDir)
    expect(exitCode).toBe(2)
  })

  it('still blocks a commit in a heredoc fed to bash with no space before <<', async () => {
    const { exitCode } = await runHook('bash<<EOF\ngit commit -m x\nEOF', repoDir)
    expect(exitCode).toBe(2)
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

  for (const command of [
    'npm test&&git commit -m x',
    'true|git commit -m x',
    'echo $(git commit -m x)',
    '(git commit -m x)',
    'a;git commit -m x',
  ]) {
    it(`blocks a commit whose git is glued to a shell operator: ${command}`, async () => {
      const { exitCode } = await runHook(command, repoDir)
      expect(exitCode).toBe(2)
    })
  }

  for (const command of [
    'git log --oneline | grep commit',
    'git help commit',
    'git cat-file commit HEAD',
    'git log -1 && echo last commit',
  ]) {
    it(`allows a git command whose subcommand is not commit: ${command}`, async () => {
      const { exitCode } = await runHook(command, repoDir)
      expect(exitCode).toBe(0)
    })
  }

  it('blocks a commit split across lines with a backslash-newline continuation', async () => {
    const { exitCode } = await runHook('git \\\n  commit -m x', repoDir)
    expect(exitCode).toBe(2)
  })
})
