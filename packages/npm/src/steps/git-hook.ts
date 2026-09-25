import { execa } from 'execa'
import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { resolveHooksDir } from './copy-templates.js'
import { EXEC_ENV } from '../utils/exec-env.js'

export type GitHookStatus = 'installed' | 'updated' | 'current' | 'not-a-repo' | 'custom-path' | 'existing-hook' | 'linked-hooks'
export interface GitHookResult { status: GitHookStatus; path: string; detail?: string }

const HOOK_MARKER = '# goodvibes-pre-commit'

// A repo's own config must never run code or redirect git while goodvibes inspects it.
const git = (cwd: string, args: string[]) =>
  execa('git', ['-c', 'core.fsmonitor=false', '-c', 'safe.bareRepository=explicit', '-C', cwd, ...args], { reject: false, env: EXEC_ENV })

async function lstatOrNull(p: string) {
  try {
    return await lstat(p)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function installGitHook(cwd: string, dryRun: boolean): Promise<GitHookResult> {
  // With reject: false a missing git binary also lands here (exitCode undefined).
  const top = await git(cwd, ['rev-parse', '--show-toplevel'])
  if (top.exitCode !== 0) return { status: 'not-a-repo', path: '' }

  // git ignores .git/hooks while core.hooksPath is set, so a hook written there would never run.
  const hooksPath = await git(cwd, ['config', '--get', 'core.hooksPath'])
  if (hooksPath.exitCode !== 0 && hooksPath.exitCode !== 1) throw new Error(`git config --get core.hooksPath failed in ${cwd}: ${hooksPath.stderr}`)
  const custom = hooksPath.exitCode === 0 ? hooksPath.stdout.trim() : ''
  if (custom) return { status: 'custom-path', path: '', detail: custom }

  const common = await git(cwd, ['rev-parse', '--git-common-dir'])
  if (common.exitCode !== 0) throw new Error(`git rev-parse --git-common-dir failed in ${cwd}: ${common.stderr}`)
  const gitDir = resolve(cwd, common.stdout.trim())
  const hooksDir = join(gitDir, 'hooks')
  // A repo can ship .git/hooks as a link (or a Windows junction); writing through it would drop an executable wherever it points.
  const hooksStat = await lstatOrNull(hooksDir)
  if (hooksStat) {
    const rel = relative(await realpath(gitDir), await realpath(hooksDir))
    if (hooksStat.isSymbolicLink() || !rel || rel.startsWith('..') || isAbsolute(rel)) return { status: 'linked-hooks', path: '' }
  }
  const path = join(hooksDir, 'pre-commit')
  const packaged = await readFile(join(resolveHooksDir(), 'pre-commit'))

  let status: GitHookStatus = 'installed'
  const st = await lstatOrNull(path)
  if (st) {
    if (!st.isFile()) return { status: 'existing-hook', path } // symlink or folder: never followed
    const current = await readFile(path)
    if (!current.toString('utf-8').includes(HOOK_MARKER)) return { status: 'existing-hook', path }
    if (current.equals(packaged)) return { status: 'current', path }
    status = 'updated'
  }
  if (dryRun) return { status, path }

  await mkdir(hooksDir, { recursive: true })
  // rename replaces the path itself, so a link that appeared since the check is replaced, not followed.
  const tmp = join(hooksDir, `.pre-commit.${randomUUID().slice(0, 8)}.tmp`)
  try {
    await writeFile(tmp, packaged, { flag: 'wx', mode: 0o755 })
    await chmod(tmp, 0o755) // the umask can strip bits from writeFile's mode
    await rename(tmp, path)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
  return { status, path }
}

export const hookInPlace = (r: GitHookResult): boolean => r.status === 'installed' || r.status === 'updated' || r.status === 'current'

// The pip package prints these exact strings; change both together.
export function gitHookLine(r: GitHookResult, dryRun: boolean): string | null {
  const line = {
    installed: 'Git commit check installed: commits that leave out JOURNAL.md are blocked in every tool (.git/hooks/pre-commit)',
    updated: 'Git commit check updated (.git/hooks/pre-commit)',
    current: null,
    'not-a-repo': 'Git commit check skipped: this folder is not a git repository yet. Run git init, then goodvibes update.',
    'custom-path': `Git commit check skipped: git uses its own hooks folder here (core.hooksPath = ${r.detail}), so goodvibes left your hooks alone.`,
    'existing-hook': 'Git commit check skipped: .git/hooks/pre-commit already exists and is not from goodvibes, so it was left alone.',
    'linked-hooks': "Git commit check skipped: .git/hooks is a link or points outside this repository's git folder, so goodvibes left it alone.",
  }[r.status]
  return line && dryRun && (r.status === 'installed' || r.status === 'updated') ? `Would: ${line}` : line
}
