import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('../utils/detect-python.js', () => ({
  detectPython: vi.fn(),
}))

describe('installHeadroom', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('prints Python-absent skip message and returns without throwing when detectPython returns null', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce(null)

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    const result = await installHeadroom(log)
    expect(result).toEqual({ status: 'skipped', reason: expect.stringContaining('Python 3.10+') })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Python 3.10+'))
    // Must NOT call execa for any install
    const { execa } = await import('execa')
    expect(vi.mocked(execa)).not.toHaveBeenCalled()
  })

  it('installs via uv when uv is available', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError) // compress --help ENOENT — not installed yet
      .mockResolvedValueOnce({ exitCode: 0 } as any) // uv succeeds

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    const result = await installHeadroom(log)

    expect(result).toEqual({ status: 'installed' })
    expect(vi.mocked(execa)).toHaveBeenCalledWith('uv', ['tool', 'install', 'headroom-ai[all]'], expect.objectContaining({ timeout: 10_000 }))
  })

  it('falls back to pipx when uv is ENOENT', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError)  // compress --help ENOENT — not installed
      .mockRejectedValueOnce(enoentError)  // uv ENOENT
      .mockResolvedValueOnce({ exitCode: 0 } as any)  // pipx succeeds

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    await installHeadroom(log)

    expect(vi.mocked(execa)).toHaveBeenNthCalledWith(2, 'uv', ['tool', 'install', 'headroom-ai[all]'], expect.objectContaining({ timeout: 10_000 }))
    expect(vi.mocked(execa)).toHaveBeenNthCalledWith(3, 'pipx', ['install', 'headroom-ai[all]'], expect.objectContaining({ timeout: 10_000 }))
  })

  it('falls back to pip --user when uv and pipx are ENOENT', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError)  // compress --help ENOENT — not installed
      .mockRejectedValueOnce(enoentError)  // uv ENOENT
      .mockRejectedValueOnce(enoentError)  // pipx ENOENT
      .mockResolvedValueOnce({ exitCode: 0 } as any)  // pip succeeds

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    await installHeadroom(log)

    expect(vi.mocked(execa)).toHaveBeenNthCalledWith(4, 'python3', ['-m', 'pip', 'install', '--user', 'headroom-ai[all]'], expect.objectContaining({ timeout: 10_000 }))
  })

  it('prints ONNX model warning before running the install subprocess', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const logCalls: string[] = []
    let uvInstallCalled = false
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'

    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError) // compress --help ENOENT
      .mockImplementationOnce(async (..._args: any[]) => {
        // Verify ONNX warning was logged before uv install runs
        expect(logCalls.some(msg => msg.includes('model') && msg.includes('minutes'))).toBe(true)
        uvInstallCalled = true
        return { exitCode: 0 } as any
      })

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn((msg: string) => { logCalls.push(msg) })
    await installHeadroom(log)

    expect(uvInstallCalled).toBe(true)
    expect(logCalls.some(msg => msg.includes('model'))).toBe(true)
    expect(logCalls.some(msg => msg.includes('minutes'))).toBe(true)
  })

  it('logs a warning and returns without throwing when all three installers are ENOENT', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError)  // compress --help ENOENT — headroom not found
      .mockRejectedValueOnce(enoentError)  // uv ENOENT
      .mockRejectedValueOnce(enoentError)  // pipx ENOENT
      .mockRejectedValueOnce(enoentError)  // pip ENOENT

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    const result = await installHeadroom(log)
    expect(result).toEqual({ status: 'failed', reason: expect.any(String) })
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/no.*installer|installer.*not.*found|uv.*pipx.*pip/i))
  })

  it('logs description before any subprocess call', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    const logCalls: string[] = []
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'

    // First call is the idempotency probe — ENOENT means not installed yet
    vi.mocked(execa)
      .mockRejectedValueOnce(enoentError) // probe ENOENT → fall through
      .mockImplementationOnce(async (..._args: any[]) => {
        // Description must have been logged BEFORE this install call
        expect(logCalls.some(msg => msg.includes('headroom compresses'))).toBe(true)
        return { exitCode: 0 } as any
      })

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn((msg: string) => { logCalls.push(msg) })
    await installHeadroom(log)

    expect(logCalls.some(msg => msg.includes('headroom compresses'))).toBe(true)
  })

  it('logs already installed message and skips installer when headroom is on PATH', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce('python3')

    const { execa } = await import('execa')
    // headroom compress --help → exit 0 (already installed)
    vi.mocked(execa).mockResolvedValueOnce({ stdout: '1.0.0' } as any)

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    const result = await installHeadroom(log)
    expect(result).toEqual({ status: 'already-installed' })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    // Only the probe call — no installer should be called
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(execa)).toHaveBeenCalledWith('headroom', ['compress', '--help'], expect.objectContaining({ timeout: 10_000 }))
  })
})
