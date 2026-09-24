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
  const files: Record<string, string> = { ...preserved }
  for (const rel of writtenFiles) {
    const content = await readFile(join(destDir, rel), 'utf-8')
    files[rel] = createHash('sha256').update(content, 'utf8').digest('hex')
  }
  const manifest: Manifest = { version, files, ...(managed ? { managed } : {}), ...(scope ? { scope } : {}) }
  await writeFile(join(destDir, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
}

export async function readManifest(destDir: string): Promise<Manifest | null> {
  try {
    const raw = await readFile(join(destDir, MANIFEST_PATH), 'utf-8')
    return JSON.parse(raw) as Manifest
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    if (e instanceof SyntaxError) return null // JSON.parse failure
    throw e
  }
}
