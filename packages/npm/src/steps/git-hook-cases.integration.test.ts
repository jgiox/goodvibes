import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { installGitHook } from './git-hook.js'

// Same cases as packages/pip/tests/test_git_hook_cases.py, run against the hook the real installer writes.
type Case = { name: string; script: string; expect: number; stderr_contains?: string }
const CASES: Case[] = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../tests/hooks/git-pre-commit.cases.json', import.meta.url)), 'utf-8'))

// The installer's own git calls read process.env, so strip it too.
beforeAll(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith('GIT_') || k.startsWith('GOODVIBES_')) delete process.env[k]
  Object.assign(process.env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' })
})

describe('git pre-commit hook cases', () => {
  let dir: string
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  for (const c of CASES) {
    it(c.name, async () => {
      dir = mkdtempSync(join(tmpdir(), 'gv-precommit-'))
      const env: Record<string, string> = Object.fromEntries(
        Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined && !e[0].startsWith('GIT_') && !e[0].startsWith('GOODVIBES_')),
      )
      Object.assign(env, {
        HOME: dir, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e',
      })
      const run = (cmd: string, args: string[]) => {
        const r = spawnSync(cmd, args, { cwd: dir, env, encoding: 'utf-8' })
        if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr}`)
      }
      run('git', ['init', '-q', '-b', 'main'])
      writeFileSync(join(dir, 'a.txt'), 'a\n')
      writeFileSync(join(dir, 'JOURNAL.md'), '# J\n')
      run('git', ['add', 'a.txt', 'JOURNAL.md'])
      run('git', ['commit', '-q', '-m', 'base'])

      expect((await installGitHook(dir, false)).status).toBe('installed')

      const p = spawnSync('sh', ['-c', c.script], { cwd: dir, env, encoding: 'utf-8' })
      expect(p.status, p.stderr).toBe(c.expect)
      expect(p.stderr).toContain(c.stderr_contains ?? '')
    })
  }
})
