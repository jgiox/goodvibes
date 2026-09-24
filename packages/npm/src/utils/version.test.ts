import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { packageVersion } from './version.js'

describe('packageVersion', () => {
  it('returns the version from the goodvibes-cli package.json when run from source', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf-8'))
    expect(packageVersion()).toBe(pkg.version)
  })
})
