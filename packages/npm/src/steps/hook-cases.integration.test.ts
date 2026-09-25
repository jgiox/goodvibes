import { describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { execa } from 'execa'

// Data-driven runner for tests/hooks/<id>.cases.json; test_hook_cases.py runs the same files.
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const CASES_DIR = join(ROOT, 'tests', 'hooks')
const settings = JSON.parse(readFileSync(join(ROOT, 'templates', '.claude', 'settings.json'), 'utf-8'))

type Case = {
  name: string
  tool: string
  input: Record<string, unknown>
  setup?: string | string[]
  env?: Record<string, string>
  expect: number
  stderr_contains?: string
}

function hookCommand(id: string, tool: string): string {
  const marker = `: goodvibes-${id};`
  const cmd = (settings.hooks?.PreToolUse ?? [])
    .filter((g: any) => new RegExp(`^(?:${g.matcher})$`).test(tool))
    .flatMap((g: any) => g.hooks)
    .find((h: any) => h.command?.startsWith(marker))?.command
  if (!cmd) throw new Error(`no PreToolUse hook marked "${marker}" is registered for the ${tool} tool`)
  return cmd
}

const git = (cwd: string, ...args: string[]) => execa('git', ['-c', 'commit.gpgsign=false', ...args], { cwd })

async function repo(dir: string, journal: 'none' | 'untracked' | 'staged' | 'committed-clean' | 'committed-modified') {
  mkdirSync(dir, { recursive: true })
  await git(dir, 'init')
  await git(dir, 'config', 'user.email', 'test@example.com')
  await git(dir, 'config', 'user.name', 'Test')
  if (journal === 'none') return
  writeFileSync(join(dir, 'JOURNAL.md'), '# journal\n')
  if (journal === 'untracked') return
  await git(dir, 'add', 'JOURNAL.md')
  if (journal === 'staged') return
  await git(dir, 'commit', '-m', 'init')
  if (journal === 'committed-modified') writeFileSync(join(dir, 'JOURNAL.md'), '# journal\n- entry\n')
}

function writeAt(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const FIXTURES: Record<string, (dir: string, ...args: string[]) => Promise<unknown> | void> = {
  'no-journal': dir => repo(dir, 'none'),
  'journal-untracked': dir => repo(dir, 'untracked'),
  'journal-staged': dir => repo(dir, 'staged'),
  'journal-committed-clean': dir => repo(dir, 'committed-clean'),
  'journal-committed-modified': dir => repo(dir, 'committed-modified'),
  'merge-in-progress': async dir => { await repo(dir, 'untracked'); writeFileSync(join(dir, '.git', 'MERGE_HEAD'), 'abc123\n') },
  'rebase-merge-in-progress': async dir => { await repo(dir, 'untracked'); mkdirSync(join(dir, '.git', 'rebase-merge')) },
  'rebase-apply-in-progress': async dir => { await repo(dir, 'untracked'); mkdirSync(join(dir, '.git', 'rebase-apply')) },
  repo: (dir, sub, journal) => repo(join(dir, sub), journal as 'untracked' | 'staged'),
  file: (dir, name, lines, width) =>
    writeAt(join(dir, name), Array.from({ length: Number(lines) }, (_, i) => (width ? 'x'.repeat(Number(width)) : `line ${i + 1}`) + '\n').join('')),
  'secret-file': (dir, name) => writeAt(join(dir, name), 'SECRET=do-not-read\n'),
  dir: (dir, name) => { mkdirSync(join(dir, name), { recursive: true }) },
}

const fill = (v: unknown, dir: string): unknown =>
  typeof v === 'string' ? v.replaceAll('{dir}', dir) : Array.isArray(v) ? v.map(x => fill(x, dir)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, dir)])) : v

for (const file of readdirSync(CASES_DIR).filter(f => f.endsWith('.cases.json')).sort()) {
  const id = file.replace(/\.cases\.json$/, '')
  const cases: Case[] = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf-8'))
  describe(`${id} hook cases`, () => {
    for (const c of cases) {
      it(c.name, async () => {
        const dir = mkdtempSync(join(tmpdir(), `gv-${id}-`))
        try {
          for (const step of ([] as string[]).concat(c.setup ?? [])) {
            const [name, ...args] = step.split(':')
            if (!FIXTURES[name]) throw new Error(`unknown fixture "${name}" in ${file}`)
            await FIXTURES[name](dir, ...args)
          }
          const env: Record<string, string> = {}
          for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('GOODVIBES_READ_GUARD')) env[k] = v
          Object.assign(env, fill(c.env ?? {}, dir))
          const payload = JSON.stringify({ tool_name: c.tool, tool_input: fill(c.input, dir) })
          const r = await execa('sh', ['-c', hookCommand(id, c.tool)], { input: payload, cwd: dir, env, extendEnv: false, reject: false })
          expect({ exitCode: r.exitCode, stderr: r.stderr }).toMatchObject({ exitCode: c.expect })
          if (c.stderr_contains !== undefined) expect(r.stderr).toContain(fill(c.stderr_contains, dir))
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      })
    }
  })
}
