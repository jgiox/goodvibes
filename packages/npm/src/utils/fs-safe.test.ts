import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  realpath: vi.fn(),
  lstat: vi.fn(),
  stat: vi.fn(async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }) }),
  chmod: vi.fn().mockResolvedValue(undefined),
}))

const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' })

describe('writeFileAtomic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes a temp file in the same folder and renames it over the destination', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.realpath).mockRejectedValue(enoent())
    const { writeFileAtomic } = await import('./fs-safe.js')

    await writeFileAtomic('/proj/.claude/settings.json', '{}\n')

    const [tmp, content] = vi.mocked(fsp.writeFile).mock.calls[0]
    expect(String(tmp).startsWith('/proj/.claude/')).toBe(true)
    expect(tmp).not.toBe('/proj/.claude/settings.json')
    expect(content).toBe('{}\n')
    expect(fsp.rename).toHaveBeenCalledWith(tmp, '/proj/.claude/settings.json')
  })

  it('replaces the target of a symlinked file so the link itself survives', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.realpath).mockResolvedValue('/dotfiles/claude/settings.json' as any)
    const { writeFileAtomic } = await import('./fs-safe.js')

    await writeFileAtomic('/home/me/.claude/settings.json', '{}\n')

    const [tmp] = vi.mocked(fsp.writeFile).mock.calls[0]
    expect(String(tmp).startsWith('/dotfiles/claude/')).toBe(true)
    expect(fsp.rename).toHaveBeenCalledWith(tmp, '/dotfiles/claude/settings.json')
  })

  it('removes the temp file and rethrows when the rename fails', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.realpath).mockRejectedValue(enoent())
    vi.mocked(fsp.rename).mockRejectedValueOnce(Object.assign(new Error('EPERM'), { code: 'EPERM' }))
    const { writeFileAtomic } = await import('./fs-safe.js')

    await expect(writeFileAtomic('/proj/.mcp.json', '{}')).rejects.toThrow('EPERM')
    const [tmp] = vi.mocked(fsp.writeFile).mock.calls[0]
    expect(fsp.rm).toHaveBeenCalledWith(tmp, { force: true })
  })
})

const stat = (link: boolean) => ({ isSymbolicLink: () => link })

describe('writeBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports a destination whose parent folder is a symlink', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.lstat).mockImplementation((async (p: string) => (p === '/proj/.claude' ? stat(true) : stat(false))) as any)
    vi.mocked(fsp.realpath).mockImplementation((async (p: string) => p) as any)
    const { writeBlocked } = await import('./fs-safe.js')
    expect(await writeBlocked('/proj', '.claude/settings.json')).toBe('.claude/settings.json: symlink, not written')
  })

  it('reports a destination that is itself a (possibly dangling) symlink', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.lstat).mockImplementation((async (p: string) => (p === '/proj/CLAUDE.md' ? stat(true) : stat(false))) as any)
    vi.mocked(fsp.realpath).mockImplementation((async (p: string) => p) as any)
    const { writeBlocked } = await import('./fs-safe.js')
    expect(await writeBlocked('/proj', 'CLAUDE.md')).toBe('CLAUDE.md: symlink, not written')
  })

  it('returns null for a plain path that does not exist yet', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.lstat).mockImplementation((async (p: string) => {
      if (p === '/proj') return stat(false)
      throw enoent()
    }) as any)
    vi.mocked(fsp.realpath).mockImplementation((async (p: string) => p) as any)
    const { writeBlocked } = await import('./fs-safe.js')
    expect(await writeBlocked('/proj', 'docs/new/guide.md')).toBeNull()
  })

  it('throws for a key that climbs out of the project', async () => {
    const { writeBlocked } = await import('./fs-safe.js')
    await expect(writeBlocked('/proj', '../etc/passwd')).rejects.toThrow('Unsafe manifest key rejected: ../etc/passwd')
  })
})

describe('assertSafe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects absolute keys and keys that climb out of the project', async () => {
    const { assertSafe } = await import('./fs-safe.js')
    await expect(assertSafe('/proj', '/etc/passwd')).rejects.toThrow(/Unsafe manifest key rejected/)
    await expect(assertSafe('/proj', 'a/../../x')).rejects.toThrow(/Unsafe manifest key rejected/)
  })

  it('does not treat a sibling folder that shares the project name prefix as inside', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.lstat).mockResolvedValue(stat(false) as any)
    vi.mocked(fsp.realpath).mockImplementation((async (p: string) => (p === '/proj' ? '/proj' : '/proj-evil/x')) as any)
    const { assertSafe } = await import('./fs-safe.js')
    await expect(assertSafe('/proj', 'x')).rejects.toThrow(/resolves outside/)
  })

  it('accepts a key whose real path stays inside the project', async () => {
    const fsp = await import('node:fs/promises')
    vi.mocked(fsp.lstat).mockResolvedValue(stat(false) as any)
    vi.mocked(fsp.realpath).mockImplementation((async (p: string) => p) as any)
    const { assertSafe } = await import('./fs-safe.js')
    await expect(assertSafe('/proj', 'docs/x.md')).resolves.toBeUndefined()
  })
})

describe('printable', () => {
  it('replaces terminal control characters with ? and keeps the rest of the text', async () => {
    const { printable } = await import('./fs-safe.js')
    expect(printable('a\u001b[2Jb\nc\u009bé')).toBe('a?[2Jb?c?é')
  })
})
