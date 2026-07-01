import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { execa } from 'execa'

const _require = createRequire(import.meta.url)

describe('index: Node version check', () => {
  it.todo('exits 1 with message when Node < 20')
  it.todo('continues when Node >= 20')
})

describe('index: --version flag', () => {
  // ponytail: build guard — run `npm run build` first if this skips
  const distExists = existsSync(new URL('../../dist/index.js', import.meta.url).pathname)

  if (!distExists) {
    it.skip('version flag output matches package.json version and is not the hardcoded 1.0.0 string (run npm run build first)', () => {})
  } else {
    it('version flag output matches package.json version and is not the hardcoded 1.0.0 string', async () => {
      const pkg = _require('../../package.json') as { version: string }
      const { stdout } = await execa('node', ['dist/index.js', '--version'], {
        cwd: new URL('../../', import.meta.url).pathname,
      })
      expect(stdout).toContain(pkg.version)
      expect(stdout).not.toContain('1.0.0')
    })
  }
})
