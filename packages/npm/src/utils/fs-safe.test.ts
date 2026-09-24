import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  realpath: vi.fn(),
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
