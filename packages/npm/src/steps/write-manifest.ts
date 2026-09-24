import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface Manifest {
  version: string
  files: Record<string, string>
  managed?: Record<string, string[]>
  scope?: 'global' | 'project'
}

export const MANIFEST_PATH = '.goodvibes.json'

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
): Promise<void> {
  // Preserved hashes come only from the prior manifest, never re-read from dest,
  // so a skipped (user-modified) file can't be silently reclassified as unmodified.
  const files: Record<string, string> = posixKeys(preserved)
  for (const rel of writtenFiles) {
    const content = await readFile(join(destDir, rel), 'utf-8')
    files[posixKey(rel)] = createHash('sha256').update(content, 'utf8').digest('hex')
  }
  const manifest: Manifest = { version, files, ...(managed ? { managed: posixKeys(managed) } : {}), ...(scope ? { scope } : {}) }
  await writeFile(join(destDir, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
}

// Throws an actionable error for a manifest that exists but cannot be used; guessing would lose tracking.
export function parseManifest(raw: string, path: string): Manifest {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error(`${path} is not valid JSON (${(e as Error).message}); fix it or delete it and run goodvibes init`)
  }
  const m = data as Manifest
  if (!m || typeof m !== 'object' || Array.isArray(m) || (m.files !== undefined && (typeof m.files !== 'object' || Array.isArray(m.files)))) {
    throw new Error(`${path} is not valid JSON (not a JSON object); fix it or delete it and run goodvibes init`)
  }
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
