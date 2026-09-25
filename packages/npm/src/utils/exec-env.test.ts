import { describe, it, expect, vi, afterEach } from 'vitest'
import { delimiter, join } from 'node:path'

describe('EXEC_ENV', () => {
  const saved = process.env.PATH
  afterEach(() => {
    process.env.PATH = saved
    vi.resetModules()
  })

  it.skipIf(process.platform === 'win32')('gives programs a PATH without ".", empty or relative entries or folders inside the project, so a cloned repo cannot pick git, claude or headroom', async () => {
    process.env.PATH = ['.', '', 'bin', join(process.cwd(), 'node_modules', '.bin'), process.cwd(), '/usr/bin', '/bin'].join(delimiter)
    vi.resetModules()
    const { EXEC_ENV } = await import('./exec-env.js')
    expect(EXEC_ENV).toEqual({ NoDefaultCurrentDirectoryInExePath: '1', PATH: ['/usr/bin', '/bin'].join(delimiter) })
  })
})
