import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return { ...actual, readdir: vi.fn(actual.readdir) }
})

describe('copyTemplates reads only the template destinations of the project', () => {
  let proj: string

  beforeEach(() => {
    proj = mkdtempSync(join(tmpdir(), 'gv-copy-unit-'))
  })

  afterEach(() => {
    rmSync(proj, { recursive: true, force: true })
  })

  it('finishes and reports its files when a project folder cannot be read, instead of failing with a permission error', async () => {
    const { readdir } = await import('fs/promises')
    const real = vi.mocked(readdir).getMockImplementation()!
    mkdirSync(join(proj, 'private'))
    writeFileSync(join(proj, 'AGENTS.md'), '# mine\n')
    vi.mocked(readdir).mockImplementation(((p: string, o: unknown) => {
      if (String(p).startsWith(join(proj, 'private'))) return Promise.reject(Object.assign(new Error(`EACCES: permission denied, scandir '${p}'`), { code: 'EACCES' }))
      return real(p as never, o as never)
    }) as typeof readdir)
    const { copyTemplates, resolveTemplatesDir } = await import('./copy-templates.js')

    const { written, skipped } = await copyTemplates(resolveTemplatesDir(), proj, false, false)

    expect(written).toContain('JOURNAL.md')
    expect(skipped).toContain('AGENTS.md')
  })

  it('never lists node_modules or other folders of the project', async () => {
    const { readdir } = await import('fs/promises')
    mkdirSync(join(proj, 'node_modules', 'left-pad'), { recursive: true })
    const { copyTemplates, resolveTemplatesDir } = await import('./copy-templates.js')
    vi.mocked(readdir).mockClear()

    await copyTemplates(resolveTemplatesDir(), proj, false, false)

    expect(vi.mocked(readdir).mock.calls.map(c => String(c[0])).filter(p => p.startsWith(proj))).toEqual([])
  })
})
