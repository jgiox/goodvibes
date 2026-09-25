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

  it('treats a semver pre-release as lower than the same release', () => {
    expect(versionGte('2.0.0-beta.1', '2.0.0')).toBe(false)
    expect(versionGte('1.9.1', '1.9.1-rc.1')).toBe(true)
  })

  it('treats PEP 440 pre-releases as lower than the release and orders a1 < b1 < rc1', () => {
    expect(versionGte('1.9.1rc1', '1.9.1')).toBe(false)
    expect(versionGte('1.9.1b1', '1.9.1a1')).toBe(true)
    expect(versionGte('1.9.1b1', '1.9.1rc1')).toBe(false)
    expect(versionGte('1.9.1-rc.2', '1.9.1-rc.1')).toBe(true)
  })

  it('treats a .postN release as higher than the same release', () => {
    expect(versionGte('1.9.1.post1', '1.9.1')).toBe(true)
    expect(versionGte('1.9.1', '1.9.1.post1')).toBe(false)
  })

  it('returns false instead of throwing when either version cannot be parsed', () => {
    expect(versionGte('banana', '1.0.0')).toBe(false)
    expect(versionGte('1.0.0', '')).toBe(false)
    expect(versionGte('1.0.0-weird!', '1.0.0')).toBe(false)
  })
})

describe('extractVersion', () => {
  it('extracts version from goodvibes stamp', () => {
    expect(extractVersion('# goodvibes: v1.0.0')).toBe('1.0.0')
  })

  it('returns null when no version present', () => {
    expect(extractVersion('no version here')).toBeNull()
  })

  it('does not capture a trailing dot after the version', () => {
    expect(extractVersion('# goodvibes: v1.7.0.')).toBe('1.7.0')
  })

  it('keeps a pre-release tag', () => {
    expect(extractVersion('# goodvibes: v2.0.0-beta.1')).toBe('2.0.0-beta.1')
    expect(extractVersion('# goodvibes: v1.9.1rc1\n')).toBe('1.9.1rc1')
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

  const OLD = `${SENTINEL_START}\n# goodvibes: v0.9.0\n\nOld rules.\n${SENTINEL_END}`

  async function expectRefused(existing: string, reason: RegExp) {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, existing)
    await expect(mergeClaude(destPath, TEMPLATE_CONTENT)).rejects.toThrow(reason)
    await expect(mergeClaude(destPath, TEMPLATE_CONTENT)).rejects.toThrow(/fix CLAUDE\.md by hand/)
    expect(readFileSync(destPath, 'utf-8')).toBe(existing)
  }

  it('refuses to write and says so when there is a start line but no end line', async () => {
    await expectRefused('# User content\n\n' + SENTINEL_START + '\norphaned start\nmore user text\n', /no <!-- goodvibes:end --> line/)
  })

  it('refuses to write and says so when there is an end line but no start line', async () => {
    await expectRefused('# User content\n' + SENTINEL_END + '\nafter\n', /no <!-- goodvibes:start --> line/)
  })

  it('refuses to write and says so when the end line comes before the start line', async () => {
    await expectRefused(`top\n${SENTINEL_END}\nmiddle\n${SENTINEL_START}\nbottom\n`, /end line comes before/)
  })

  it('refuses to write and says so when there are two start lines', async () => {
    await expectRefused(`${SENTINEL_START}\na\n${SENTINEL_START}\nb\n${SENTINEL_END}\n`, /2 <!-- goodvibes:start --> lines/)
  })

  it('refuses to write and says so when there are two end lines', async () => {
    await expectRefused(`${SENTINEL_START}\na\n${SENTINEL_END}\nb\n${SENTINEL_END}\n`, /2 <!-- goodvibes:end --> lines/)
  })

  it('ignores a marker quoted inside a line and appends the block instead of cutting user text', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const existing = `# Notes\n\nThe block starts at \`${SENTINEL_START}\` and ends at \`${SENTINEL_END}\`.\nKeep this line.\n`
    writeFileSync(destPath, existing)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content.startsWith(existing.trimEnd())).toBe(true)
    expect(content).toContain('Keep this line.')
    expect(content).toContain('# goodvibes: v1.0.0')
  })

  it('accepts marker lines with trailing whitespace', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, `before\n${SENTINEL_START}  \n# goodvibes: v0.9.0\n${SENTINEL_END}\t\nafter\n`)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# goodvibes: v1.0.0')
    expect(content.startsWith('before\n')).toBe(true)
    expect(content.endsWith('after\n')).toBe(true)
  })

  it('keeps CRLF line endings when replacing the block', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, `before\r\n\r\n${OLD.split('\n').join('\r\n')}\r\nafter\r\n`)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# goodvibes: v1.0.0')
    expect(content.replace(/\r\n/g, '')).not.toContain('\n')
    expect(content.startsWith('before\r\n')).toBe(true)
    expect(content.endsWith('after\r\n')).toBe(true)
  })

  it('keeps CRLF line endings when appending the block', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, '# Mine\r\n\r\ntext\r\n')
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain(SENTINEL_START)
    expect(content.replace(/\r\n/g, '')).not.toContain('\n')
  })
})
