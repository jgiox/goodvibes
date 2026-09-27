import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'fs'
import { rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mergeClaude, extractVersion, versionGte, stripBlock, MarkerError, SHIPPED_BLOCKS, blockDigest } from './sentinel-merge.js'
import { EDITED_170_BLOCK, NEWER_TEMPLATE, SHIPPED_170_BLOCK } from '../commands/old-project.fixture.js'

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
    const existing = `# User content before\n\n${SHIPPED_170_BLOCK}\n\nUser content after.`
    writeFileSync(destPath, existing)
    expect(await mergeClaude(destPath, NEWER_TEMPLATE)).toBe('written')
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# User content before')
    expect(content).toContain('User content after.')
    expect(content).toContain('# goodvibes: v9.9.9')
    expect(content).not.toContain('v1.7.0')
  })

  it('keeps an edited older block and writes the new block beside it', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const text = `# Mine\n\n${EDITED_170_BLOCK}\n`
    writeFileSync(destPath, text)
    expect(await mergeClaude(destPath, NEWER_TEMPLATE)).toBe('kept')
    expect(readFileSync(destPath, 'utf-8')).toBe(text)
    expect(readFileSync(join(tmpDir, 'CLAUDE.md.goodvibes-new'), 'utf-8')).toBe(`${SENTINEL_START}\n# goodvibes: v9.9.9\n\nnew rules\n${SENTINEL_END}\n`)
  })

  it('reports a kept block in a dry run without writing anything', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, EDITED_170_BLOCK + '\n')
    expect(await mergeClaude(destPath, NEWER_TEMPLATE, true)).toBe('kept')
    expect(() => readFileSync(join(tmpDir, 'CLAUDE.md.goodvibes-new'))).toThrow()
  })

  it('lists every block goodvibes ships, the same way as the pip CLI', () => {
    const template = readFileSync(fileURLToPath(new URL('../../../../templates/CLAUDE.md', import.meta.url)), 'utf-8')
    expect(SHIPPED_BLOCKS.has(blockDigest(template)), `add ${blockDigest(template)} to SHIPPED_BLOCKS in sentinel-merge.ts and sentinel_merge.py`).toBe(true)
    expect(blockDigest(SHIPPED_170_BLOCK.replace(/\n/g, '\r\n'))).toBe(blockDigest(SHIPPED_170_BLOCK))
    const pip = readFileSync(fileURLToPath(new URL('../../../pip/src/goodvibes_cli/utils/sentinel_merge.py', import.meta.url)), 'utf-8')
    const pipSet = pip.slice(pip.indexOf('SHIPPED_BLOCKS'), pip.indexOf('})', pip.indexOf('SHIPPED_BLOCKS')))
    expect([...pipSet.matchAll(/[0-9a-f]{64}/g)].map(m => m[0]).sort()).toEqual([...SHIPPED_BLOCKS].sort())
    expect(createHash('sha256').update(SHIPPED_170_BLOCK).digest('hex')).toBe(blockDigest(SHIPPED_170_BLOCK))
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
    writeFileSync(destPath, `before\n${SHIPPED_170_BLOCK.replace(SENTINEL_START, SENTINEL_START + '  ').replace(SENTINEL_END, SENTINEL_END + '\t')}\nafter\n`)
    await mergeClaude(destPath, NEWER_TEMPLATE)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# goodvibes: v9.9.9')
    expect(content.startsWith('before\n')).toBe(true)
    expect(content.endsWith('after\n')).toBe(true)
  })

  it('keeps CRLF line endings when replacing the block', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    writeFileSync(destPath, `before\r\n\r\n${SHIPPED_170_BLOCK.split('\n').join('\r\n')}\r\nafter\r\n`)
    await mergeClaude(destPath, NEWER_TEMPLATE)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# goodvibes: v9.9.9')
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

describe('stripBlock', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gv-strip-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('removes the goodvibes block and keeps the text around it', async () => {
    const f = join(dir, 'CLAUDE.md')
    writeFileSync(f, `# CLAUDE.md\n\nmy notes\n\n${SHIPPED_170_BLOCK}\n\nmore mine\n`)
    expect(await stripBlock(f)).toBe('removed')
    expect(readFileSync(f, 'utf-8')).toBe('# CLAUDE.md\n\nmy notes\n\nmore mine\n')
  })

  it('keeps Windows line endings', async () => {
    const f = join(dir, 'CLAUDE.md')
    writeFileSync(f, `# CLAUDE.md\r\n\r\n${SHIPPED_170_BLOCK.split('\n').join('\r\n')}\r\n`)
    expect(await stripBlock(f)).toBe('removed')
    expect(readFileSync(f, 'utf-8')).toBe('# CLAUDE.md\r\n')
  })

  it('returns false and leaves a file without markers unchanged', async () => {
    const f = join(dir, 'CLAUDE.md')
    writeFileSync(f, '# CLAUDE.md\n\nmine only\n')
    expect(await stripBlock(f)).toBe('')
    expect(readFileSync(f, 'utf-8')).toBe('# CLAUDE.md\n\nmine only\n')
  })

  it('keeps a block the user edited', async () => {
    const f = join(dir, 'CLAUDE.md')
    const text = `# CLAUDE.md\n\n${EDITED_170_BLOCK}\n`
    writeFileSync(f, text)
    expect(await stripBlock(f)).toBe('kept')
    expect(readFileSync(f, 'utf-8')).toBe(text)
  })

  it('throws and leaves the file unchanged when the markers are ambiguous', async () => {
    const f = join(dir, 'CLAUDE.md')
    const text = `${SENTINEL_START}\na\n${SENTINEL_START}\nb\n${SENTINEL_END}\n`
    writeFileSync(f, text)
    await expect(stripBlock(f)).rejects.toBeInstanceOf(MarkerError)
    expect(readFileSync(f, 'utf-8')).toBe(text)
  })

  it('reports a block without changing the file in a dry run', async () => {
    const f = join(dir, 'CLAUDE.md')
    const text = `${SHIPPED_170_BLOCK}\n`
    writeFileSync(f, text)
    expect(await stripBlock(f, true)).toBe('removed')
    expect(readFileSync(f, 'utf-8')).toBe(text)
  })
})

describe('stripBlock and mergeClaude refuse files they cannot rewrite safely', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gv-safe-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })
  const notUtf8 = Buffer.concat([Buffer.from(`${SENTINEL_START}\n# goodvibes: v0.1.0\nold\n${SENTINEL_END}\ncaf`), Buffer.from([0xe9]), Buffer.from('\n')])

  it('stripBlock throws and leaves a file that is not UTF-8 unchanged', async () => {
    const f = join(dir, 'CLAUDE.md')
    writeFileSync(f, notUtf8)
    await expect(stripBlock(f)).rejects.toBeInstanceOf(MarkerError)
    expect(readFileSync(f).equals(notUtf8)).toBe(true)
  })

  it('mergeClaude throws and leaves a file that is not UTF-8 unchanged', async () => {
    const f = join(dir, 'CLAUDE.md')
    writeFileSync(f, notUtf8)
    await expect(mergeClaude(f, TEMPLATE_CONTENT)).rejects.toBeInstanceOf(MarkerError)
    expect(readFileSync(f).equals(notUtf8)).toBe(true)
  })

  it('stripBlock never writes through a symlinked CLAUDE.md', async () => {
    const target = join(dir, 'outside.md')
    const text = `${SENTINEL_START}\nold\n${SENTINEL_END}\nkeep\n`
    writeFileSync(target, text)
    mkdirSync(join(dir, 'proj'))
    symlinkSync(target, join(dir, 'proj', 'CLAUDE.md'))
    await expect(stripBlock(join(dir, 'proj', 'CLAUDE.md'))).rejects.toBeInstanceOf(MarkerError)
    expect(readFileSync(target, 'utf-8')).toBe(text)
  })

  it('mergeClaude never writes through a symlinked CLAUDE.md', async () => {
    const target = join(dir, 'outside.md')
    writeFileSync(target, 'mine\n')
    mkdirSync(join(dir, 'proj'))
    symlinkSync(target, join(dir, 'proj', 'CLAUDE.md'))
    await expect(mergeClaude(join(dir, 'proj', 'CLAUDE.md'), TEMPLATE_CONTENT)).rejects.toBeInstanceOf(MarkerError)
    expect(readFileSync(target, 'utf-8')).toBe('mine\n')
  })
})
