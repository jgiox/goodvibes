import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { spawnSync, execFileSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveTemplatesDir } from './steps/copy-templates.js'

const settings = JSON.parse(readFileSync(join(resolveTemplatesDir(), '.claude', 'settings.json'), 'utf-8'))
const handler = settings.hooks.PreToolUse[0].hooks[0]

let repo: string

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
}

function runGate(command: string): { status: number | null; stderr: string } {
  const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description: 'Commit' } })
  const r = spawnSync('sh', ['-c', handler.command], {
    cwd: repo,
    input: stdin,
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    encoding: 'utf-8',
  })
  return { status: r.status, stderr: r.stderr }
}

function commitAll(msg: string): void {
  git('add', '-A')
  git('commit', '-q', '-m', msg)
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'gv-gate-'))
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(repo, 'JOURNAL.md'), '# Journal\n')
  writeFileSync(join(repo, 'app.txt'), 'v1\n')
  commitAll('init')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('journal-gate hook template', () => {
  it('is registered as a Bash PreToolUse hook scoped to git commit', () => {
    expect(settings.hooks.PreToolUse[0].matcher).toBe('Bash')
    expect(handler.type).toBe('command')
    expect(handler.if).toBe('Bash(git commit*)')
    expect(handler.args).toBeUndefined()
  })

  it('keeps the existing permissions block alongside the hook', () => {
    expect(settings.permissions.allow).toContain('Bash(git commit*)')
    expect(settings.permissions.deny).toContain('Bash(git reset --hard*)')
  })

  it('does not depend on jq or node', () => {
    expect(handler.command).not.toMatch(/\bjq\b|\bnode\b/)
  })

  it('blocks git commit with exit 2 when JOURNAL.md is not staged', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    git('add', 'app.txt')
    const r = runGate('git commit -m "change app"')
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('JOURNAL.md is not staged')
    expect(r.stderr).toContain('git add JOURNAL.md')
  })

  it('allows git commit when JOURNAL.md is staged', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    writeFileSync(join(repo, 'JOURNAL.md'), '# Journal\n\n- entry\n')
    git('add', '-A')
    expect(runGate('git commit -m "change app"').status).toBe(0)
  })

  it('blocks when JOURNAL.md is edited on disk but not staged', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    writeFileSync(join(repo, 'JOURNAL.md'), '# Journal\n\n- entry\n')
    git('add', 'app.txt')
    expect(runGate('git commit -m "change app"').status).toBe(2)
  })

  it('allows git commit --amend without a journal change', () => {
    expect(runGate('git commit --amend --no-edit').status).toBe(0)
  })

  it('allows a commit while a merge is in progress', () => {
    writeFileSync(join(repo, '.git', 'MERGE_HEAD'), 'deadbeef\n')
    expect(runGate('git commit --no-edit').status).toBe(0)
  })

  it('allows a commit while an interactive rebase is in progress', () => {
    mkdirSync(join(repo, '.git', 'rebase-merge'))
    expect(runGate('git commit -m "fixup"').status).toBe(0)
  })

  it('allows a commit while a git am style rebase is in progress', () => {
    mkdirSync(join(repo, '.git', 'rebase-apply'))
    expect(runGate('git commit -m "fixup"').status).toBe(0)
  })

  it('allows the first commit in a repo with no HEAD yet', () => {
    rmSync(join(repo, '.git'), { recursive: true, force: true })
    git('init', '-q')
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    git('add', 'app.txt')
    expect(runGate('git commit -m "first"').status).toBe(0)
  })

  it('allows the bootstrap commit that adds JOURNAL.md to an existing repo', () => {
    git('rm', '-q', '--cached', 'JOURNAL.md')
    git('commit', '-q', '-m', 'drop journal')
    git('add', 'JOURNAL.md')
    expect(runGate('git commit -m "add goodvibes"').status).toBe(0)
  })

  it('allows git add JOURNAL.md && git commit in one command', () => {
    writeFileSync(join(repo, 'JOURNAL.md'), '# Journal\n\n- entry\n')
    expect(runGate('git add JOURNAL.md && git commit -m "log"').status).toBe(0)
  })

  it('allows git commit -am when JOURNAL.md is modified in the working tree', () => {
    writeFileSync(join(repo, 'JOURNAL.md'), '# Journal\n\n- entry\n')
    expect(runGate('git commit -am "log"').status).toBe(0)
  })

  it('blocks git commit -am when JOURNAL.md is unchanged', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    expect(runGate('git commit -am "change app"').status).toBe(2)
  })

  it('allows git add . && git commit when JOURNAL.md is new and untracked', () => {
    git('rm', '-q', '--cached', 'JOURNAL.md')
    git('commit', '-q', '-m', 'drop journal')
    expect(runGate('git add . && git commit -m "add goodvibes"').status).toBe(0)
  })

  it('lets non-commit Bash commands through if the if filter is ignored', () => {
    writeFileSync(join(repo, 'app.txt'), 'v2\n')
    git('add', 'app.txt')
    expect(runGate('ls -la').status).toBe(0)
  })

  it('exits 0 outside a git repository', () => {
    rmSync(join(repo, '.git'), { recursive: true, force: true })
    expect(runGate('git commit -m "x"').status).toBe(0)
  })
})

describe('.mcp.json template', () => {
  const mcp = JSON.parse(readFileSync(join(resolveTemplatesDir(), '.mcp.json'), 'utf-8'))

  it('configures context7 at the free public HTTP endpoint with no key', () => {
    expect(mcp.mcpServers.context7).toEqual({ type: 'http', url: 'https://mcp.context7.com/mcp' })
  })

  it('contains no headers or literal API key', () => {
    expect(JSON.stringify(mcp)).not.toMatch(/headers|Authorization|api[_-]?key/i)
  })
})
