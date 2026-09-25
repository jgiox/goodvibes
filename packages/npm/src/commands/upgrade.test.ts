import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clack/prompts', () => ({ intro: vi.fn(), note: vi.fn() }))
vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('./update.js', () => ({ runUpdate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../utils/version.js', () => ({ packageVersion: () => '1.0.0' }))
vi.mock('../steps/write-manifest.js', () => ({ readManifest: vi.fn().mockResolvedValue({ version: '1.0.0', files: {} }) }))

async function runUpgrade(...args: string[]) {
  const { registerUpgradeCommand } = await import('./upgrade.js')
  const { Command } = await import('commander')
  const program = new Command()
  program.exitOverride()
  registerUpgradeCommand(program)
  await program.parseAsync(['node', 'goodvibes', 'upgrade', ...args])
}

describe('upgrade command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  const prevEnv = process.env._GV_UPGRADING

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env._GV_UPGRADING
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    if (prevEnv === undefined) delete process.env._GV_UPGRADING
    else process.env._GV_UPGRADING = prevEnv
  })

  it('installs the newer version from npm and re-runs itself on it', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as never)

    await runUpgrade().catch(() => {})

    expect(vi.mocked(execa)).toHaveBeenCalledWith('npm', ['install', '-g', 'goodvibes-cli@1.0.1'], expect.anything())
    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      process.execPath,
      [process.argv[1], ...process.argv.slice(2)],
      expect.objectContaining({ env: expect.objectContaining({ _GV_UPGRADING: '1.0.1' }) }),
    )
  })

  it('prints the npm permissions fix and exits 1 when npm install -g fails with EACCES', async () => {
    const { execa } = await import('execa')
    const { note } = await import('@clack/prompts')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockImplementation((async (cmd: string, args: string[]) => {
      if (args[0] === 'view') return { stdout: '1.0.1' }
      throw Object.assign(new Error('Command failed with exit code 243: npm install -g goodvibes-cli@1.0.1'), {
        stderr: 'npm error code EACCES\nnpm error syscall mkdir\nnpm error path /usr/lib/node_modules/goodvibes-cli',
      })
    }) as never)

    await expect(runUpgrade()).rejects.toThrow('process.exit')

    expect(exitSpy).toHaveBeenCalledWith(1)
    const out = vi.mocked(note).mock.calls.flat().join(' ')
    expect(out).toContain('https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally')
    expect(vi.mocked(runUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(execa)).not.toHaveBeenCalledWith(process.execPath, expect.anything(), expect.anything())
  })

  it('prints the first npm error line and exits 1 when npm install -g fails for another reason', async () => {
    const { execa } = await import('execa')
    const { note } = await import('@clack/prompts')
    vi.mocked(execa).mockImplementation((async (cmd: string, args: string[]) => {
      if (args[0] === 'view') return { stdout: '1.0.1' }
      throw Object.assign(new Error('Command failed with exit code 1: npm install -g goodvibes-cli@1.0.1'), {
        stderr: 'npm warn deprecated x\nnpm error code ETARGET\nnpm error notarget No matching version',
      })
    }) as never)

    await expect(runUpgrade()).rejects.toThrow('process.exit')

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(vi.mocked(note).mock.calls.flat().join(' ')).toContain('npm error code ETARGET')
  })

  it('does not install anything during --dry-run and previews the update instead', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as never)

    await runUpgrade('--dry-run')

    expect(vi.mocked(execa)).not.toHaveBeenCalledWith('npm', expect.arrayContaining(['install']), expect.anything())
    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(true, false)
  })

  it('hands the project files to update when already on the newest version', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.0' } as never)

    await runUpgrade()

    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(false, false)
  })

  it('still updates the project when the npm registry cannot be reached', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockRejectedValue(new Error('offline'))

    await runUpgrade()

    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(false, false)
  })

  it('says it could not check npm for a newer version instead of staying silent when npm view fails', async () => {
    const { execa } = await import('execa')
    const { note } = await import('@clack/prompts')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockRejectedValue(Object.assign(new Error('Command failed with exit code 1: npm view goodvibes-cli version'), {
      stderr: 'npm error code ENOTFOUND\nnpm error network request failed',
    }))

    await runUpgrade()

    expect(vi.mocked(note)).toHaveBeenCalledWith('Could not check npm for a newer version (npm error code ENOTFOUND); updating with the installed version')
    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(false, false)
  })

  it('runs npm view from the home folder so a project .npmrc cannot choose the version', async () => {
    const { execa } = await import('execa')
    const { homedir } = await import('node:os')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.0' } as never)

    await runUpgrade()

    expect(vi.mocked(execa)).toHaveBeenCalledWith('npm', ['view', 'goodvibes-cli', 'version'], expect.objectContaining({ cwd: homedir() }))
  })

  it('runs npm view, npm install and the re-run without searching the project folder for the program', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as never)

    await runUpgrade().catch(() => {})

    expect(vi.mocked(execa).mock.calls).toHaveLength(3)
    for (const c of vi.mocked(execa).mock.calls as unknown[][]) expect(c[2]).toEqual(expect.objectContaining({ env: expect.objectContaining({ NoDefaultCurrentDirectoryInExePath: '1' }) }))
  })

  it('skips the version check when _GV_UPGRADING is set', async () => {
    const { execa } = await import('execa')
    process.env._GV_UPGRADING = '1'

    await runUpgrade()

    expect(vi.mocked(execa)).not.toHaveBeenCalled()
  })

  it('says the install worked and how to update a project, instead of the no-manifest error, when this folder has no goodvibes setup', async () => {
    const { execa } = await import('execa')
    const { note } = await import('@clack/prompts')
    const { runUpdate } = await import('./update.js')
    const { readManifest } = await import('../steps/write-manifest.js')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.0' } as never)
    vi.mocked(readManifest).mockResolvedValue(null)

    await runUpgrade()

    expect(vi.mocked(runUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(note)).toHaveBeenCalledWith(
      'goodvibes 1.0.0 is installed. This folder has no goodvibes setup, so there is nothing to update here.\n' +
        'To update a project, go into its folder and run: goodvibes update\n' +
        'To set up a new project, go into its folder and run: goodvibes init',
      'Nothing to update here',
    )
  })

  it('registers upgrade without an update alias', async () => {
    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    registerUpgradeCommand(program)
    expect(program.commands.find(c => c.name() === 'upgrade')!.aliases()).not.toContain('update')
  })

  it('fails loudly instead of claiming success when the re-run is still on the old version', async () => {
    const { runUpdate } = await import('./update.js')
    const { note } = await import('@clack/prompts')
    process.env._GV_UPGRADING = '1.0.1'

    await expect(runUpgrade()).rejects.toThrow('process.exit')

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(vi.mocked(runUpdate)).not.toHaveBeenCalled()
    expect(vi.mocked(note).mock.calls.flat().join(' ')).toContain('npm install -g goodvibes-cli@1.0.1')
  })
})
