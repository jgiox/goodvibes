import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { join, sep } from 'path'
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

  it('readManifest throws a clear error naming the file when .goodvibes.json is malformed JSON', async () => {
    writeFileSync(join(tmpDir, '.goodvibes.json'), 'not json')
    const err = await readManifest(tmpDir).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    const msg = (err as Error).message
    expect(msg.startsWith(`${join(tmpDir, '.goodvibes.json')} is not valid JSON (`)).toBe(true)
    expect(msg.endsWith('); fix it or delete it and run goodvibes init')).toBe(true)
  })

  it('readManifest throws when .goodvibes.json holds merge conflict markers', async () => {
    writeFileSync(join(tmpDir, '.goodvibes.json'), '<<<<<<< HEAD\n{"version":"1.0.0","files":{}}\n=======\n{}\n>>>>>>> main\n')
    await expect(readManifest(tmpDir)).rejects.toThrow(/is not valid JSON/)
  })

  it('readManifest throws when .goodvibes.json is JSON but not an object', async () => {
    writeFileSync(join(tmpDir, '.goodvibes.json'), '[]')
    await expect(readManifest(tmpDir)).rejects.toThrow(/is not valid JSON \(not a JSON object\)/)
  })

  it('readManifest turns backslash keys from a Windows manifest into forward slashes', async () => {
    writeFileSync(join(tmpDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { '.github\\workflows\\ci.yml': 'a', 'docs\\x.md': 'b' },
      managed: { '.claude\\settings.json': ['ask:x'] },
    }))
    const m = await readManifest(tmpDir)
    expect(m!.files).toEqual({ '.github/workflows/ci.yml': 'a', 'docs/x.md': 'b' })
    expect(m!.managed).toEqual({ '.claude/settings.json': ['ask:x'] })
  })

  it('writeManifest stores forward-slash keys for written, preserved and managed paths', async () => {
    mkdirSync(join(tmpDir, 'docs'))
    writeFileSync(join(tmpDir, 'docs', 'a.md'), 'a')
    await writeManifest(tmpDir, [`docs${sep}a.md`], '1.0.0', { 'docs\\b.md': 'user-owned' }, { '.claude\\settings.json': [] })
    const data = JSON.parse(readFileSync(join(tmpDir, '.goodvibes.json'), 'utf-8'))
    expect(Object.keys(data.files).sort()).toEqual(['docs/a.md', 'docs/b.md'])
    expect(Object.keys(data.managed)).toEqual(['.claude/settings.json'])
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

  it('merges preserved entries into files without re-hashing them', async () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# hello\n')
    await writeManifest(tmpDir, ['CLAUDE.md'], '1.0.0', { 'skipped.md': 'preserved-hash-value' })
    const data = JSON.parse(readFileSync(join(tmpDir, '.goodvibes.json'), 'utf-8'))
    expect(data.files['skipped.md']).toBe('preserved-hash-value')
    expect(data.files['CLAUDE.md']).toHaveLength(64)
  })
})
