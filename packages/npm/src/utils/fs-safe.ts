import { randomUUID } from 'node:crypto'
import { realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

// A crash mid-write must never leave a half-written settings file behind.
export async function writeFileAtomic(path: string, content: string): Promise<void> {
  // A symlinked config file (dotfiles repo) stays a symlink: its target is replaced, not the link.
  const target = await realpath(path).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return path
    throw e
  })
  const tmp = join(dirname(target), `.${basename(target)}.${randomUUID().slice(0, 8)}.tmp`)
  try {
    await writeFile(tmp, content, 'utf-8')
    await rename(tmp, target)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}
