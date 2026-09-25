import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { gitHookLine, installGitHook } from './git-hook.js'
import { resolveHooksDir } from './copy-templates.js'

// Real temp repos: the installer is git plumbing, so mocking git would test nothing.
// Inherited GIT_* (CI url rewrites, or GIT_DIR when run from inside a hook) would point git elsewhere.
beforeAll(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith('GIT_') || k.startsWith('GOODVIBES_')) delete process.env[k]
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' })
})

const OLD_HOOK = '#!/bin/sh\n# goodvibes-pre-commit: an older version\nexit 0\n'

describe('installGitHook', () => {
  let dir: string
  let outside: string
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf-8' })
  const target = () => join(dir, '.git', 'hooks', 'pre-commit')
  const packaged = () => readFileSync(join(resolveHooksDir(), 'pre-commit'))

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gv-githook-'))
    outside = mkdtempSync(join(tmpdir(), 'gv-githook-outside-'))
    git('init', '-q', '-b', 'main')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('returns not-a-repo for a folder that is not a git repository', async () => {
    const result = await installGitHook(outside, false)
    expect(result.status).toBe('not-a-repo')
    expect(existsSync(join(outside, '.git'))).toBe(false)
  })

  it('returns not-a-repo when git is not installed', async () => {
    const path = process.env.PATH
    process.env.PATH = outside
    try {
      expect((await installGitHook(dir, false)).status).toBe('not-a-repo')
    } finally {
      process.env.PATH = path
    }
    expect(existsSync(target())).toBe(false)
  })

  it('installs the packaged hook with mode 0755 when there is no pre-commit hook', async () => {
    const result = await installGitHook(dir, false)
    expect(result).toEqual({ status: 'installed', path: target() })
    expect(readFileSync(target()).equals(packaged())).toBe(true)
    expect(statSync(target()).mode & 0o777).toBe(0o755)
  })

  it('creates the hooks folder when git init left none', async () => {
    rmSync(join(dir, '.git', 'hooks'), { recursive: true, force: true })
    expect((await installGitHook(dir, false)).status).toBe('installed')
    expect(readFileSync(target()).equals(packaged())).toBe(true)
  })

  it('returns current when the installed hook is identical to the packaged one', async () => {
    await installGitHook(dir, false)
    expect(await installGitHook(dir, false)).toEqual({ status: 'current', path: target() })
  })

  it('rewrites an older goodvibes hook and returns updated', async () => {
    writeFileSync(target(), OLD_HOOK, { mode: 0o644 })
    expect((await installGitHook(dir, false)).status).toBe('updated')
    expect(readFileSync(target()).equals(packaged())).toBe(true)
    expect(statSync(target()).mode & 0o777).toBe(0o755)
  })

  it('leaves a pre-commit hook without the goodvibes marker alone and returns existing-hook', async () => {
    writeFileSync(target(), '#!/bin/sh\nmake lint\n', { mode: 0o755 })
    expect((await installGitHook(dir, false)).status).toBe('existing-hook')
    expect(readFileSync(target(), 'utf-8')).toBe('#!/bin/sh\nmake lint\n')
  })

  it('leaves a symlinked pre-commit alone even when it points at a goodvibes hook', async () => {
    const linked = join(outside, 'pre-commit')
    writeFileSync(linked, OLD_HOOK)
    symlinkSync(linked, target())
    expect((await installGitHook(dir, false)).status).toBe('existing-hook')
    expect(lstatSync(target()).isSymbolicLink()).toBe(true)
    expect(readFileSync(linked, 'utf-8')).toBe(OLD_HOOK)
  })

  it('returns custom-path with the configured value and writes nothing when core.hooksPath is set', async () => {
    git('config', 'core.hooksPath', '.githooks')
    const result = await installGitHook(dir, false)
    expect(result.status).toBe('custom-path')
    expect(result.detail).toBe('.githooks')
    expect(existsSync(target())).toBe(false)
    expect(existsSync(join(dir, '.githooks'))).toBe(false)
  })

  it('reports installed on a dry run without writing the hook', async () => {
    expect((await installGitHook(dir, true)).status).toBe('installed')
    expect(existsSync(target())).toBe(false)
  })

  it('reports updated on a dry run without rewriting the older hook', async () => {
    writeFileSync(target(), OLD_HOOK)
    expect((await installGitHook(dir, true)).status).toBe('updated')
    expect(readFileSync(target(), 'utf-8')).toBe(OLD_HOOK)
  })

  it('installs into the repository hooks folder when run from a subfolder', async () => {
    mkdirSync(join(dir, 'src'))
    expect(await installGitHook(join(dir, 'src'), false)).toEqual({ status: 'installed', path: target() })
  })

  it('installs into the main repository hooks folder when run from a linked worktree', async () => {
    writeFileSync(join(dir, 'a.txt'), 'a\n')
    git('add', 'a.txt')
    git('-c', 'user.name=T', '-c', 'user.email=t@e', 'commit', '-q', '-m', 'base')
    const wt = join(outside, 'wt')
    git('worktree', 'add', '-q', wt)
    expect(await installGitHook(wt, false)).toEqual({ status: 'installed', path: target() })
    expect(existsSync(target())).toBe(true)
  })
})

describe('resolveHooksDir', () => {
  it('points at a folder holding the goodvibes pre-commit hook', () => {
    expect(readFileSync(join(resolveHooksDir(), 'pre-commit'), 'utf-8')).toContain('# goodvibes-pre-commit')
  })
})

describe('gitHookLine', () => {
  const at = '/p/.git/hooks/pre-commit'
  const INSTALLED = 'Git commit check installed: commits that leave out JOURNAL.md are blocked in every tool (.git/hooks/pre-commit)'
  const UPDATED = 'Git commit check updated (.git/hooks/pre-commit)'
  const NOT_A_REPO = 'Git commit check skipped: this folder is not a git repository yet. Run git init, then goodvibes update.'
  const EXISTING = 'Git commit check skipped: .git/hooks/pre-commit already exists and is not from goodvibes, so it was left alone.'

  it('prints the spec line for every status and nothing for current', () => {
    expect(gitHookLine({ status: 'installed', path: at }, false)).toBe(INSTALLED)
    expect(gitHookLine({ status: 'updated', path: at }, false)).toBe(UPDATED)
    expect(gitHookLine({ status: 'current', path: at }, false)).toBeNull()
    expect(gitHookLine({ status: 'not-a-repo', path: at }, false)).toBe(NOT_A_REPO)
    expect(gitHookLine({ status: 'custom-path', path: at, detail: '.husky' }, false)).toBe(
      'Git commit check skipped: git uses its own hooks folder here (core.hooksPath = .husky), so goodvibes left your hooks alone.')
    expect(gitHookLine({ status: 'existing-hook', path: at }, false)).toBe(EXISTING)
  })

  it('prefixes only the installed and updated lines with "Would: " on a dry run', () => {
    expect(gitHookLine({ status: 'installed', path: at }, true)).toBe(`Would: ${INSTALLED}`)
    expect(gitHookLine({ status: 'updated', path: at }, true)).toBe(`Would: ${UPDATED}`)
    expect(gitHookLine({ status: 'current', path: at }, true)).toBeNull()
    expect(gitHookLine({ status: 'not-a-repo', path: at }, true)).toBe(NOT_A_REPO)
    expect(gitHookLine({ status: 'existing-hook', path: at }, true)).toBe(EXISTING)
  })
})
