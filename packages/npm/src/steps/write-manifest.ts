import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { printable, writeBlocked, writeFileAtomic } from '../utils/fs-safe.js'
import { isJsonObject } from '../utils/json-merge.js'
import { join } from 'node:path'

export interface Manifest {
  version: string
  files: Record<string, string>
  managed?: Record<string, string[]>
  scope?: 'global' | 'project'
  gitHook?: 'installed' | 'user-removed'
}

export const MANIFEST_PATH = '.goodvibes.json'

// Sentinels, not hex digests: 'user-owned' is never overwritten; 'user-removed' was deleted by the user and is not re-added.
export const USER_OWNED = 'user-owned'
export const USER_REMOVED = 'user-removed'

// Manifest keys are always forward-slash so a manifest written on Windows matches on every OS.
export const posixKey = (rel: string): string => rel.replace(/\\/g, '/')
const posixKeys = <T>(record: Record<string, T> = {}): Record<string, T> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [posixKey(k), v]))

export async function writeManifest(
  destDir: string,
  writtenFiles: string[],
  version: string,
  preserved?: Record<string, string>,
  managed?: Record<string, string[]>,
  scope?: 'global' | 'project',
  gitHook?: Manifest['gitHook'],
): Promise<string | null> {
  const blocked = await writeBlocked(destDir, MANIFEST_PATH)
  if (blocked) return blocked
  // Preserved hashes come only from the prior manifest, never re-read from dest,
  // so a skipped (user-modified) file can't be silently reclassified as unmodified.
  const files: Record<string, string> = posixKeys(preserved)
  for (const rel of writtenFiles) {
    const content = await readFile(join(destDir, rel), 'utf-8')
    files[posixKey(rel)] = createHash('sha256').update(content, 'utf8').digest('hex')
  }
  const manifest: Manifest = { version, files, ...(managed ? { managed: posixKeys(managed) } : {}), ...(scope ? { scope } : {}), ...(gitHook ? { gitHook } : {}) }
  await writeFileAtomic(join(destDir, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n')
  return null
}

// Keys reach delete and write calls, and a cloned repo can ship its own manifest: "a/../../.git/HEAD" must never pass a prefix check.
const unsafeKey = (k: string): boolean =>
  /[\u0000-\u001f\u007f-\u009f]/.test(k) || /^[A-Za-z]:/.test(k) || k.split('/').some(s => s === '' || s === '.' || s === '..')

const mapOf = (v: unknown, ok: (x: unknown) => boolean): boolean => isJsonObject(v) && Object.values(v).every(ok)

function manifestProblem(m: Record<string, unknown>): string | null {
  if (m.files !== undefined && !mapOf(m.files, v => typeof v === 'string')) return '"files" is not a JSON object of file paths to hashes'
  if (m.managed !== undefined && !mapOf(m.managed, v => Array.isArray(v) && v.every(s => typeof s === 'string'))) {
    return '"managed" is not a JSON object of file paths to lists of text'
  }
  if (m.scope !== undefined && m.scope !== 'global' && m.scope !== 'project') return '"scope" is not "global" or "project"'
  if (m.gitHook !== undefined && m.gitHook !== 'installed' && m.gitHook !== USER_REMOVED) return '"gitHook" is not "installed" or "user-removed"'
  const bad = [...Object.keys(m.files ?? {}), ...Object.keys(m.managed ?? {})].map(posixKey).find(unsafeKey)
  return bad === undefined ? null : `"${bad}" is not a safe relative path`
}

// Throws an actionable error for a manifest that exists but cannot be used; guessing would lose tracking.
export function parseManifest(raw: string, path: string): Manifest {
  const fail = (why: string) => new Error(printable(`${path} ${why}; fix it or delete it and run goodvibes init`))
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw fail(`is not valid JSON (${(e as Error).message})`)
  }
  if (!isJsonObject(data)) throw fail('is not valid JSON (not a JSON object)')
  const problem = manifestProblem(data)
  if (problem) throw fail(`is not a valid goodvibes manifest (${problem})`)
  const m = data as unknown as Manifest
  return { ...m, files: posixKeys(m.files), ...(m.managed ? { managed: posixKeys(m.managed) } : {}) }
}

export async function readManifest(destDir: string): Promise<Manifest | null> {
  const path = join(destDir, MANIFEST_PATH)
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
  return parseManifest(raw, path)
}
