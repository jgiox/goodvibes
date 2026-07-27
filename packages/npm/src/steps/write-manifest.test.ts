import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'node:crypto'
import { writeManifest, readManifest } from './write-manifest.js'

describe('writeManifest / readManifest', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-manifest-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes .goodvibes.json with sha256 for each written file', async () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# hello\n')
    await writeManifest(tmpDir, ['CLAUDE.md'], '1.0.0')
    const data = JSON.parse(readFileSync(join(tmpDir, '.goodvibes.json'), 'utf-8'))
    expect(data.files['CLAUDE.md']).toHaveLength(64)
    expect(typeof data.files['CLAUDE.md']).toBe('string')
  })

  it('readManifest returns null when .goodvibes.json does not exist', async () => {
    const result = await readManifest(tmpDir)
    expect(result).toBeNull()
  })

  it('readManifest returns null when .goodvibes.json is malformed JSON', async () => {
    writeFileSync(join(tmpDir, '.goodvibes.json'), 'not json')
    const result = await readManifest(tmpDir)
    expect(result).toBeNull()
  })

  it('writeManifest hashes the actual dest content, not the path string', async () => {
    writeFileSync(join(tmpDir, 'file1.md'), 'content-one')
    writeFileSync(join(tmpDir, 'file2.md'), 'content-two')
    await writeManifest(tmpDir, ['file1.md', 'file2.md'], '1.0.0')
    const data = JSON.parse(readFileSync(join(tmpDir, '.goodvibes.json'), 'utf-8'))
    // Different content → different hashes
    expect(data.files['file1.md']).not.toBe(data.files['file2.md'])
    // Hash matches expected sha256 of actual content
    const expected = createHash('sha256').update('content-one', 'utf8').digest('hex')
    expect(data.files['file1.md']).toBe(expected)
  })

  it('writeManifest sets version in the manifest', async () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# v\n')
    await writeManifest(tmpDir, ['CLAUDE.md'], '1.2.3')
    const data = JSON.parse(readFileSync(join(tmpDir, '.goodvibes.json'), 'utf-8'))
    expect(data.version).toBe('1.2.3')
  })
})
