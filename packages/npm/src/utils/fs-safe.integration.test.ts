import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, statSync, chmodSync, symlinkSync, lstatSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileAtomic } from './fs-safe.js'

describe('writeFileAtomic on a real filesystem', () => {
  const dirs: string[] = []
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'gv-atomic-'))
    dirs.push(d)
    return d
  }
  afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })))

  it.skipIf(process.platform === 'win32')('keeps a restrictive 0600 mode instead of widening it to the umask default', async () => {
    const file = join(tmp(), 'settings.json')
    writeFileSync(file, '{"secret":true}\n')
    chmodSync(file, 0o600)

    await writeFileAtomic(file, '{"secret":false}\n')

    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(readFileSync(file, 'utf-8')).toBe('{"secret":false}\n')
  })

  it.skipIf(process.platform === 'win32')('keeps a symlinked config file a symlink and updates its target', async () => {
    const target = join(tmp(), 'dotfiles-settings.json')
    const link = join(tmp(), 'settings.json')
    writeFileSync(target, '{}\n')
    symlinkSync(target, link)

    await writeFileAtomic(link, '{"a":1}\n')

    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe('{"a":1}\n')
  })
})
