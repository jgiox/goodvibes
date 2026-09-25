import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({ execa: vi.fn() }))

const enoent = () => Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })

describe('registerContext7', () => {
  beforeEach(() => vi.resetAllMocks())

  it('adds context7 at user scope over HTTP when claude mcp list does not show it', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: 'headroom: ok' } as any).mockResolvedValueOnce({ stdout: '' } as any)
    const { registerContext7 } = await import('./global-setup.js')
    expect(await registerContext7(false)).toEqual({ status: 'registered' })
    expect(vi.mocked(execa).mock.calls[1]).toEqual([
      'claude',
      ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'context7', 'https://mcp.context7.com/mcp'],
      { timeout: 10_000 },
    ])
  })

  it('does nothing when context7 is already registered', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: 'context7: https://mcp.context7.com/mcp (HTTP) - ✓ Connected' } as any)
    const { registerContext7 } = await import('./global-setup.js')
    expect(await registerContext7(false)).toEqual({ status: 'already-registered' })
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1)
  })

  it('reports skipped with the manual command when the claude CLI is missing', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockRejectedValueOnce(enoent())
    const { registerContext7 } = await import('./global-setup.js')
    const r = await registerContext7(false)
    expect(r.status).toBe('skipped')
    expect(r.reason).toContain('claude mcp add --transport http --scope user context7')
  })
})

describe('ensureGlobalCli', () => {
  beforeEach(() => vi.resetAllMocks())

  it('installs the matching version globally when npm has none', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{}' } as any).mockResolvedValueOnce({ stdout: '' } as any)
    const { ensureGlobalCli } = await import('./global-setup.js')
    expect(await ensureGlobalCli('1.8.0', false)).toEqual({ status: 'installed' })
    expect(vi.mocked(execa).mock.calls[1][1]).toEqual(['install', '-g', 'goodvibes-cli@1.8.0'])
  })

  it('runs npm without searching the project folder for it', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{}' } as any).mockResolvedValueOnce({ stdout: '' } as any)
    const { ensureGlobalCli } = await import('./global-setup.js')
    await ensureGlobalCli('1.8.0', false)
    expect(vi.mocked(execa).mock.calls).toHaveLength(2)
    for (const c of vi.mocked(execa).mock.calls as unknown[][]) expect(c[2]).toEqual(expect.objectContaining({ env: expect.objectContaining({ NoDefaultCurrentDirectoryInExePath: '1' }) }))
  })

  it('does not reinstall when the same version is already global', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{"dependencies":{"goodvibes-cli":{"version":"1.8.0"}}}' } as any)
    const { ensureGlobalCli } = await import('./global-setup.js')
    expect(await ensureGlobalCli('1.8.0', false)).toEqual({ status: 'already-installed' })
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1)
  })

  it('does not downgrade a newer global goodvibes when an older version runs init', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{"dependencies":{"goodvibes-cli":{"version":"1.9.1"}}}' } as any)
    const { ensureGlobalCli } = await import('./global-setup.js')
    expect(await ensureGlobalCli('1.9.0', false)).toEqual({ status: 'already-installed' })
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1)
  })

  it('reports a permission failure with the npm fix link and the manual command', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{}' } as any).mockRejectedValueOnce(new Error('npm ERR! code EACCES'))
    const { ensureGlobalCli } = await import('./global-setup.js')
    const r = await ensureGlobalCli('1.8.0', false)
    expect(r.status).toBe('failed')
    expect(r.reason).toContain('resolving-eacces-permissions-errors')
    expect(r.reason).toContain('npm install -g goodvibes-cli@1.8.0')
  })

  it('only describes the install in dry-run mode', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '{}' } as any)
    const { ensureGlobalCli } = await import('./global-setup.js')
    expect((await ensureGlobalCli('1.8.0', true)).status).toBe('skipped')
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1)
  })
})
