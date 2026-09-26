import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { USER_OWNED, USER_REMOVED } from './write-manifest.js'
import { writeBlocked } from '../utils/fs-safe.js'

export const STRIPPED = 'CLAUDE.md: removed the old goodvibes rules block; the rules now come from your Claude Code settings folder'
export const STRIP_PLAN = 'CLAUDE.md: will remove the old goodvibes rules block; the rules now come from your Claude Code settings folder'
export const EDITED = 'Edited skill copies stay in this project; the same skills are now set up for all your projects, so Claude may load both. Delete a copy you no longer need: '
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
