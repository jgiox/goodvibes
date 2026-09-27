import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { USER_OWNED, USER_REMOVED } from './write-manifest.js'
import { writeBlocked } from '../utils/fs-safe.js'

export const STRIPPED = 'CLAUDE.md: removed the old goodvibes rules block; the rules now come from your Claude Code settings folder'
export const KEPT_OLD_BLOCK = 'CLAUDE.md: kept the old goodvibes rules block because you edited it; Claude also reads the rules in your Claude Code settings folder, so remove the block by hand when you no longer need it'
export const KEPT_BLOCK = 'CLAUDE.md: kept your edited goodvibes rules block; the new block is in CLAUDE.md.goodvibes-new, copy over what you want, then delete that file'
export const STRIP_PLAN = 'CLAUDE.md: will remove the old goodvibes rules block; the rules now come from your Claude Code settings folder'
export const EDITED = 'Edited skill copies stay in this project; the same skills are now set up for all your projects, so Claude may load both. Delete a copy you no longer need: '
export const offerLine = (rel: string, planned: boolean) =>
  planned
    ? `${rel}: will write goodvibes' new version to ${rel}.goodvibes-new; your copy stays`
    : `${rel}: kept your edited copy; goodvibes' new version is in ${rel}.goodvibes-new, copy over what you want, then delete that file`
export const removedLine = (rel: string) => `${rel}: removed, now set up for all your projects`

// Tracked project skill files left from project scope: unchanged since goodvibes wrote them, or edited by the user.
export async function oldSkillCopies(cwd: string, files: Record<string, string>): Promise<{ unedited: string[]; edited: string[] }> {
  const unedited: string[] = []
  const edited: string[] = []
  for (const [rel, sha] of Object.entries(files)) {
    if (!rel.startsWith('.claude/skills/') || sha === USER_OWNED || sha === USER_REMOVED) continue
    if (await writeBlocked(cwd, rel)) continue
    const path = join(cwd, rel)
    if (!(await stat(path).then(s => s.isFile(), () => false))) continue
    const got = createHash('sha256').update(await readFile(path)).digest('hex')
    ;(got === sha ? unedited : edited).push(rel)
  }
  return { unedited: unedited.sort(), edited: edited.sort() }
}
