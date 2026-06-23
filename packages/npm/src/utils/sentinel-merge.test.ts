import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mergeClaude, extractVersion, versionGte } from './sentinel-merge.js'

const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

const TEMPLATE_CONTENT = `# CLAUDE.md

${SENTINEL_START}
# goodvibes: v1.0.0

## Engineering Rules

Some rule here.
${SENTINEL_END}
`

describe('versionGte', () => {
  it('returns true for equal versions', () => {
    expect(versionGte('1.0.0', '1.0.0')).toBe(true)
  })

  it('returns true for newer major version', () => {
    expect(versionGte('2.0.0', '1.0.0')).toBe(true)
  })

  it('returns false for older version', () => {
    expect(versionGte('0.9.0', '1.0.0')).toBe(false)
  })

  it('handles minor version correctly (1.10 > 1.9 numerically)', () => {
    expect(versionGte('1.10.0', '1.9.0')).toBe(true)
  })
})

describe('extractVersion', () => {
  it('extracts version from goodvibes stamp', () => {
    expect(extractVersion('# goodvibes: v1.0.0')).toBe('1.0.0')
  })

  it('returns null when no version present', () => {
    expect(extractVersion('no version here')).toBeNull()
  })

  it('extracts version from full sentinel block', () => {
    const block = `${SENTINEL_START}\n# goodvibes: v1.0.0\n\n## Rules\n${SENTINEL_END}`
    expect(extractVersion(block)).toBe('1.0.0')
  })
})

describe('mergeClaude', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('Case A: creates file verbatim when it does not exist', async () => {
    const destPath = join(tmpDir, 'subdir', 'CLAUDE.md')
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toBe(TEMPLATE_CONTENT)
  })

  it('Case B: appends sentinel block when file exists with no sentinel', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const existing = '# My existing CLAUDE.md\n\nUser content here.'
    writeFileSync(destPath, existing)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# My existing CLAUDE.md')
    expect(content).toContain('User content here.')
    expect(content).toContain(SENTINEL_START)
    expect(content).toContain(SENTINEL_END)
    expect(content).toContain('# goodvibes: v1.0.0')
    // user content should come before sentinel
    const sentinelIdx = content.indexOf(SENTINEL_START)
    const userContentIdx = content.indexOf('User content here.')
    expect(userContentIdx).toBeLessThan(sentinelIdx)
  })

  it('Case B idempotency: calling twice on no-sentinel file appends block only once', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const existing = '# My existing CLAUDE.md\n'
    writeFileSync(destPath, existing)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    const startCount = (content.match(/<!-- goodvibes:start -->/g) ?? []).length
    expect(startCount).toBe(1)
  })

  it('Case C: replaces sentinel block when existing version is older', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const oldBlock = `${SENTINEL_START}\n# goodvibes: v0.9.0\n\nOld rules.\n${SENTINEL_END}`
    const existing = `# User content before\n\n${oldBlock}\n\nUser content after.`
    writeFileSync(destPath, existing)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# User content before')
    expect(content).toContain('User content after.')
    expect(content).toContain('# goodvibes: v1.0.0')
    expect(content).not.toContain('v0.9.0')
    // Old rules should be replaced
    expect(content).not.toContain('Old rules.')
  })

  it('Case D: skips write when existing sentinel version equals template version', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const existingContent = `# My CLAUDE.md\n\n${SENTINEL_START}\n# goodvibes: v1.0.0\n\nCurrent rules.\n${SENTINEL_END}\n`
    writeFileSync(destPath, existingContent)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    // File should be unchanged
    expect(content).toBe(existingContent)
    expect(content).toContain('Current rules.')
  })

  it('Case D2: skips write when existing sentinel version is newer than template', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const existingContent = `# My CLAUDE.md\n\n${SENTINEL_START}\n# goodvibes: v2.0.0\n\nNewer rules.\n${SENTINEL_END}\n`
    writeFileSync(destPath, existingContent)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    // File should be unchanged — user has a newer version
    expect(content).toBe(existingContent)
    expect(content).toContain('v2.0.0')
  })
})
