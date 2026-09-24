import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

// Bundled dist/index.js sits one level below package.json; source files under src/*/ sit two.
export function packageVersion(): string {
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const pkg = _require(rel) as { name?: string; version?: string }
      if (pkg.name === 'goodvibes-cli' && pkg.version) return pkg.version
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw e
    }
  }
  throw new Error('goodvibes: cannot find its own package.json to read the version; reinstall goodvibes-cli')
}
