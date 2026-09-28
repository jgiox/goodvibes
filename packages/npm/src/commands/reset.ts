import type { Command } from 'commander'
import { intro, outro, note, cancel } from '@clack/prompts'
import { copyFile, lstat, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { MANIFEST_PATH, USER_OWNED, readManifest, writeManifest, type Manifest } from '../steps/write-manifest.js'
import { claudeConfigDir } from '../steps/global-setup.js'
import { dependabotYml, detectProjectType } from '../utils/detect-project-type.js'
import {
  MANAGED_JSON, covers, fileAllowRules, isJsonObject, managedIds, managedRecord, mergeManagedJson, presentIds, shapeError, userAllowRules, yieldedIds,
} from '../utils/json-merge.js'
import { writeBlocked, writeFileAtomic } from '../utils/fs-safe.js'
import { GLOBAL_OWNED, goodvibesBlock, samePath } from '../utils/scope.js'
import { MarkerError, mergeClaude } from '../utils/sentinel-merge.js'
import { packageVersion } from '../utils/version.js'
import { ask, shown } from './update.js'

// The pip CLI prints these exact strings; change both together.
const NO_MANIFEST = "No .goodvibes.json in this folder, so goodvibes manages no files here. To reset goodvibes' files in your Claude Code settings folder, run goodvibes reset --global."
const NOTHING = "Nothing to reset: everything goodvibes manages here already matches goodvibes' version."
const BACKUPS = 'Each changed file is copied to <file>.goodvibes-backup first.'
const BLOCK_ONLY = "CLAUDE.md: only goodvibes' rules block is replaced; your text outside it stays"
const SETTINGS = '.claude/settings.json'
type Json = Record<string, any>

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description("Put back goodvibes' version of files and settings you edited or deleted (your copies are backed up)")
    .argument('[files...]', 'Only these files (default: every file goodvibes wrote here)')
    .option('--global', "Reset goodvibes' files in your Claude Code settings folder instead of this project")
    .option('--dry-run', 'Preview what would change without writing')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .action(async (files: string[], options: { global?: boolean; dryRun?: boolean; yes?: boolean }) => {
      intro('goodvibes reset')
      await runReset(files, options.global ?? false, options.dryRun ?? false, options.yes ?? false)
    })
}

// Copies path beside itself under a name no earlier backup uses.
export async function backup(path: string): Promise<string> {
  const taken = (p: string) => lstat(p).then(() => true, () => false)
  let dest = `${path}.goodvibes-backup`
  for (let n = 2; await taken(dest); n++) dest = `${path}.goodvibes-backup-${n}`
  await copyFile(path, dest)
  return dest
}

function fail(lines: string[]): never {
  cancel(shown(lines))
  process.exit(1)
}

function coveredLines(label: string, tpl: Json, merged: Json, allows: string[]): string[] {
  const have: string[] = merged.permissions?.ask ?? []
  const lines: string[] = []
  for (const p of tpl.permissions?.ask ?? []) {
    const by = allows.find(a => covers(a, p))
    if (by && !have.includes(p)) {
      lines.push(`${label}: goodvibes' ask rule ${p} stays out because your allow rule ${by} covers it; delete ${by}, then run goodvibes reset again to have Claude Code ask first`)
    }
  }
  return lines
}

export async function runReset(files: string[], globalScope: boolean, dryRun: boolean, yes: boolean): Promise<void> {
  const cwd = process.cwd()
  const cfg = claudeConfigDir()
  // In the Claude Code settings folder the manifest there is the global one.
  const isGlobal = globalScope || samePath(cwd, cfg)
  const root = isGlobal ? cfg : cwd
  let manifest: Manifest | null
  try {
    manifest = await readManifest(root)
  } catch (e) {
    fail([(e as Error).message])
  }
  if (!manifest) fail([isGlobal ? `goodvibes is not set up in your Claude Code settings folder (${cfg}), so there is nothing to reset there.` : NO_MANIFEST])
  const templateDir = resolveTemplatesDir()
  const tplSettings: Json = JSON.parse(await readFile(join(templateDir, SETTINGS), 'utf-8'))
  const recorded = manifest.files

  // What goodvibes would write for each file it manages here; null: no longer shipped.
  const sources = new Map<string, string | null>()
  if (isGlobal) {
    sources.set('rules/goodvibes.md', goodvibesBlock(await readFile(join(templateDir, 'CLAUDE.md'), 'utf-8')))
    for (const rel of (await listTemplateFiles(templateDir)).map(f => f.split('\\').join('/'))) {
      if (rel.startsWith('.claude/skills/')) sources.set(rel.slice('.claude/'.length), await readFile(join(templateDir, rel), 'utf-8'))
    }
    sources.set('settings.json', '')
  } else {
    const scope = manifest.scope ?? 'project'
    const projectType = detectProjectType(cwd)
    for (const rel of Object.keys(recorded)) {
      if (scope === 'global' && (rel === 'CLAUDE.md' || GLOBAL_OWNED(rel))) continue
      const src = rel === '.github/workflows/ci.yml' ? join(templateDir, '.github', 'workflows', `ci-${projectType}.yml`) : join(templateDir, rel)
      const data = existsSync(src) && (await stat(src)).isFile() ? await readFile(src, 'utf-8') : null
      sources.set(rel, data !== null && rel === '.github/dependabot.yml' ? dependabotYml(data, cwd) : data)
    }
  }

  const wanted = files.map(f => relative(resolve(root), resolve(root, f)).split(sep).join('/'))
  const unknown = files.filter((_, i) => !sources.has(wanted[i])).map(f => `${f}: goodvibes does not manage this file here, so reset cannot restore it. Nothing was changed.`)
  if (unknown.length > 0) fail(unknown)

  const extraAllow = isGlobal
    ? []
    : [...(await fileAllowRules(join(cwd, '.claude', 'settings.local.json'), tplSettings)), ...(await fileAllowRules(join(cfg, 'settings.json'), tplSettings))]
  const items: { rel: string; kind: 'claude' | 'json' | 'file'; payload: any }[] = []
  const replace: string[] = []
  const restore: string[] = []
  const merges: string[] = []
  const notes: string[] = []
  const problems: string[] = []
  const chosen = wanted.length > 0 ? [...new Set(wanted)] : [...sources.keys()].filter(r => recorded[r] !== USER_OWNED)
  for (const rel of chosen) {
    const data = sources.get(rel) ?? null
    const dest = join(root, rel)
    if (data === null) {
      if (wanted.length > 0) notes.push(`${rel}: goodvibes no longer ships this file, so there is nothing to reset it to`)
      continue
    }
    if (!isGlobal) {
      const why = await writeBlocked(cwd, rel)
      if (why) {
        notes.push(why)
        continue
      }
    }
    const exists = existsSync(dest)
    if (rel === 'CLAUDE.md' && !isGlobal) {
      try {
        if ((await mergeClaude(dest, data, true, true)) === 'unchanged') continue
      } catch (e) {
        if (!(e instanceof MarkerError)) throw e
        problems.push(e.message)
        continue
      }
      items.push({ rel, kind: 'claude', payload: data })
    } else if (MANAGED_JSON.includes(rel) || (isGlobal && rel === 'settings.json')) {
      const tplRel = isGlobal ? SETTINGS : rel
      const tpl: Json = isGlobal ? tplSettings : JSON.parse(data)
      let user: unknown = null
      try {
        if (exists) user = JSON.parse(await readFile(dest, 'utf-8'))
      } catch (e) {
        problems.push(`${rel}: not valid JSON (${(e as Error).message}); left unchanged, fix it and re-run reset`)
        continue
      }
      const problem = exists && !isJsonObject(user) ? 'not a JSON object' : user ? shapeError(tplRel, user as Json) : null
      if (problem) {
        problems.push(`${rel}: ${problem}; left unchanged, fix it and re-run reset`)
        continue
      }
      // A missing project file is written as the template; its ask rules count as installed, so covered ones drop out.
      const [base, installed]: [Json, string[]] = exists ? [user as Json, []] : isGlobal ? [{}, []] : [tpl, managedIds(rel, tpl)]
      const allow = tplRel === SETTINGS ? extraAllow : []
      const { merged, changes } = mergeManagedJson(tplRel, tpl, base, installed, false, allow, true)
      notes.push(...coveredLines(rel, tpl, merged, [...userAllowRules(merged, tpl), ...allow]))
      if (exists && JSON.stringify(merged) === JSON.stringify(user)) continue
      items.push({ rel, kind: 'json', payload: merged })
      if (exists) merges.push(`Will reset goodvibes entries in ${rel}:\n  ${changes.join('\n  ')}`)
    } else {
      if (exists && (await readFile(dest, 'utf-8')) === data) continue
      items.push({ rel, kind: 'file', payload: data })
    }
    if (!exists) restore.push(rel)
    else if (items[items.length - 1].kind !== 'json') replace.push(rel)
  }

  const title = dryRun ? 'Dry run: no files written' : 'Plan'
  note(
    shown([
      replace.length > 0 && `Will replace with goodvibes' version (${replace.length}): ${replace.join(', ')}`,
      replace.includes('CLAUDE.md') && !isGlobal && BLOCK_ONLY,
      restore.length > 0 && `Will restore, deleted (${restore.length}): ${restore.join(', ')}`,
      ...merges,
      ...notes,
      ...problems,
      items.length > 0 ? BACKUPS : NOTHING,
    ]),
    isGlobal ? `${title} (${cfg})` : title,
  )
  if (items.length === 0) {
    if (problems.length > 0) process.exit(1)
    outro('Nothing reset.')
    return
  }
  if (dryRun) {
    outro('Run without --dry-run to reset these files.')
    return
  }
  if (!yes && !(await ask(`Reset ${items.length} file(s) to goodvibes' version? Your copies are backed up first.`))) {
    cancel('Reset cancelled. Nothing was changed.')
    process.exit(0)
  }

  const done: string[] = []
  const written: string[] = []
  for (const { rel, kind, payload } of items) {
    const dest = join(root, rel)
    // Checked again after the question: the folder may have become a symlink while reset waited.
    const why = isGlobal ? null : await writeBlocked(cwd, rel)
    if (why) {
      problems.push(why)
      continue
    }
    const saved = existsSync(dest) ? await backup(dest) : null
    try {
      if (kind === 'claude') await mergeClaude(dest, payload, false, true)
      else {
        await mkdir(dirname(dest), { recursive: true })
        if (kind === 'json') await writeFileAtomic(dest, JSON.stringify(payload, null, 2) + '\n')
        else await writeFile(dest, payload, 'utf-8')
      }
    } catch (e) {
      if (!(e instanceof MarkerError)) throw e
      problems.push(e.message)
      continue
    }
    written.push(rel)
    done.push(saved ? `${rel}: reset to goodvibes' version; your copy is in ${relative(root, saved).split(sep).join('/')}` : `${rel}: restored goodvibes' version`)
  }

  if (isGlobal) {
    const filesRec = { ...recorded }
    for (const rel of written) {
      if (rel !== 'settings.json') filesRec[rel] = createHash('sha256').update(await readFile(join(cfg, rel), 'utf-8'), 'utf8').digest('hex')
    }
    const managed = { ...(manifest.managed ?? {}) }
    if (written.includes('settings.json')) {
      const merged = items.find(i => i.rel === 'settings.json')?.payload
      const forget = yieldedIds(tplSettings, merged, userAllowRules(merged, tplSettings))
      managed['settings.json'] = [...new Set([...(managed['settings.json'] ?? []), ...presentIds(SETTINGS, tplSettings, merged)])].filter(i => !forget.has(i))
    }
    await writeFileAtomic(join(cfg, MANIFEST_PATH), JSON.stringify({ ...manifest, version: packageVersion(), files: filesRec, managed }, null, 2) + '\n')
  } else {
    const preserved = Object.fromEntries(Object.entries(recorded).filter(([k]) => !written.includes(k)))
    const blocked = await writeManifest(cwd, written, packageVersion(), preserved, await managedRecord(cwd, templateDir, manifest.managed, cfg), manifest.scope, manifest.gitHook)
    if (blocked) problems.push(blocked)
  }

  note(shown([...done, ...problems]), 'Reset complete')
  if (problems.length > 0) process.exit(1)
  outro('Done!')
}
