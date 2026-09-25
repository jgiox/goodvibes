import { randomUUID } from 'node:crypto'
import { chmod, lstat, readdir, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

// Repo files arrive with any clone; raw escape codes in them could rewrite what the terminal shows.
export const printable = (s: string): string => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?')

// path.relative, not a string prefix: "/proj-evil" must not count as inside "/proj".
const inside = (root: string, p: string): boolean => {
  const r = relative(root, p)
  return r !== '' && r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r)
}

function lexicalDest(root: string, rel: string): string {
  const dest = resolve(root, rel)
  if (!inside(resolve(root), dest)) throw new Error(`Unsafe manifest key rejected: ${rel}`)
  return dest
}

async function lstatOrNull(p: string) {
  try {
    return await lstat(p)
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return null
    throw e
  }
}

async function realInside(root: string, dest: string): Promise<boolean> {
  let p = dest
  while (!(await lstatOrNull(p)) && dirname(p) !== p) p = dirname(p)
  const [realRoot, real] = await Promise.all([realpath(root), realpath(p)])
  return real === realRoot || inside(realRoot, real)
}

// Throws for a key that escapes the project, lexically or through the real path of its deepest existing ancestor.
export async function assertSafe(root: string, rel: string): Promise<void> {
  if (!(await realInside(root, lexicalDest(root, rel)))) throw new Error(`Unsafe manifest key rejected: ${rel} resolves outside ${root}`)
}

// A skip message when writing root/rel would follow a symlink (dangling included) or land outside root; null when safe.
export async function writeBlocked(root: string, rel: string): Promise<string | null> {
  const blocked = `${rel.replace(/\\/g, '/')}: symlink, not written`
  const base = resolve(root)
  const dest = lexicalDest(root, rel)
  for (let p = dest; p !== base; p = dirname(p)) {
    if ((await lstatOrNull(p))?.isSymbolicLink()) return blocked
  }
  return (await realInside(root, dest)) ? null : blocked
}

// A crash mid-write must never leave a half-written settings file behind.
// Deletes root/rel, then every folder above it that is left empty, stopping at stop (e.g. '.claude/skills').
export async function removeRetired(root: string, rel: string, stop: string): Promise<void> {
  await rm(join(root, rel), { force: true })
  let dir = dirname(rel).split(sep).join('/')
  while (dir.startsWith(stop + '/')) {
    if ((await readdir(join(root, dir))).length > 0) break
    await rmdir(join(root, dir))
    dir = dirname(dir)
  }
}

export async function writeFileAtomic(path: string, content: string): Promise<void> {
  // A symlinked config file (dotfiles repo) stays a symlink: its target is replaced, not the link.
  const target = await realpath(path).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return path
    throw e
  })
  const tmp = join(dirname(target), `.${basename(target)}.${randomUUID().slice(0, 8)}.tmp`)
  // The temp file starts with the umask default; keep the target's mode so a 0600 file never becomes world-readable.
  const mode = await stat(target).then(s => s.mode & 0o777, () => undefined)
  try {
    await writeFile(tmp, content, { encoding: 'utf-8', mode: mode ?? 0o666 })
    if (mode !== undefined) await chmod(tmp, mode)
    await rename(tmp, target)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}
