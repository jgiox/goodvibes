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

describe('EXEC_ENV run from the home folder or above it', () => {
  const saved = { PATH: process.env.PATH, HOME: process.env.HOME }
  afterEach(() => {
    process.env.PATH = saved.PATH
    process.env.HOME = saved.HOME
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it.skipIf(process.platform === 'win32')('keeps ~/.local/bin when goodvibes runs from the home folder, so doctor still finds goodvibes and headroom there', async () => {
    const home = '/home/someone'
    process.env.HOME = home
    process.env.PATH = [`${home}/.local/bin`, '.', '/usr/bin'].join(delimiter)
    vi.spyOn(process, 'cwd').mockReturnValue(home)
    vi.resetModules()
    const { EXEC_ENV } = await import('./exec-env.js')
    expect(EXEC_ENV.PATH).toBe([`${home}/.local/bin`, '/usr/bin'].join(delimiter))
  })

  it.skipIf(process.platform === 'win32')('keeps system folders when goodvibes runs from the filesystem root', async () => {
    process.env.HOME = '/home/someone'
    process.env.PATH = ['/usr/local/bin', '/usr/bin'].join(delimiter)
    vi.spyOn(process, 'cwd').mockReturnValue('/')
    vi.resetModules()
    const { EXEC_ENV } = await import('./exec-env.js')
    expect(EXEC_ENV.PATH).toBe(['/usr/local/bin', '/usr/bin'].join(delimiter))
  })
})
