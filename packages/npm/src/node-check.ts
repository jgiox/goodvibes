// Must stay dependency-free: it runs before anything that could fail to load on an old Node.
export function nodeVersionError(version: string): string | null {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number)
  if (major > 22 || (major === 22 && minor >= 12)) return null
  return `goodvibes requires Node.js 22.12 or higher.\nYou are running Node.js ${version}.\nInstall the latest LTS from https://nodejs.org\n`
}
