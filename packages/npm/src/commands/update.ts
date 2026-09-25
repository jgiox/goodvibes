import type { Command } from 'commander'
import { intro, outro, note, confirm, isCancel, cancel } from '@clack/prompts'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { readManifest, writeManifest, posixKey, USER_OWNED, USER_REMOVED, type Manifest } from '../steps/write-manifest.js'
import { mergeClaude, MarkerError } from '../utils/sentinel-merge.js'
import { MANAGED_JSON, mergeManagedJson, managedRecord, isJsonObject } from '../utils/json-merge.js'
import { assertSafe, removeRetired, writeBlocked, writeFileAtomic } from '../utils/fs-safe.js'
import { applyGlobalConfig, claudeConfigDir, formatGlobal } from '../steps/global-setup.js'
import { GLOBAL_OWNED, type Scope } from '../utils/scope.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { packageVersion } from '../utils/version.js'
import { copy } from 'fs-extra'
import { gitHookLine, hookInPlace, installGitHook, type GitHookResult } from '../steps/git-hook.js'

const removedNote = (rel: string) => `${rel}: removed by you, not re-added (run goodvibes init to restore)`

// init skips a whole layer (CI when the project had workflows, .github/docs under --minimal); update must not add it later.
const layer = (rel: string) =>
  rel.startsWith('.github/workflows/') ? 'workflows' : rel.startsWith('.github/') ? 'github' : rel.startsWith('docs/') ? 'docs' : null

async function categorise(
  templateDir: string,
  cwd: string,
  manifest: { files: Record<string, string> },
  projectType: string,
  scope: Scope = 'project',
): Promise<{ overwrite: string[]; skip: string[]; netNew: string[]; kept: string[]; removed: string[]; stillRemoved: string[]; retired: string[]; blocked: Record<string, string> }> {
  // In global scope the rules block, skills and context7 live in the user config, never in the project.
  const excluded = (rel: string) => scope === 'global' && (rel === 'CLAUDE.md' || GLOBAL_OWNED(rel))
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariantSrc = `ci-${projectType}.yml`
  const overwrite: string[] = []
  const skip: string[] = []
  const netNew: string[] = []
  const kept: string[] = []
  const removed: string[] = []
  const stillRemoved: string[] = []
  const retired: string[] = []
  // Symlinked destinations: never read for hashing, never written; tracked ones keep their manifest entry.
  const blocked: Record<string, string> = {}

  // First pass: check manifest-tracked files — unmodified → overwrite, user-modified → skip
  for (const [rel, manifestSha] of Object.entries(manifest.files)) {
    if (excluded(rel)) continue
    const why = await writeBlocked(cwd, rel)
    if (why) {
      blocked[rel] = why
      continue
    }
    const destPath = join(cwd, rel)
    if (manifestSha === USER_REMOVED) {
      if (existsSync(destPath)) kept.push(rel) // recreated by the user: theirs now
      else stillRemoved.push(rel)
    } else if (!existsSync(destPath)) {
      removed.push(rel)
    } else if (rel === 'CLAUDE.md') {
      // mergeClaude only ever replaces the sentinel block, so it's always safe to
      // run even when custom prose outside the block changes the whole-file hash.
      overwrite.push(rel)
    } else {
      const destContent = await readFile(destPath, 'utf-8')
      const destSha = createHash('sha256').update(destContent, 'utf8').digest('hex')
      if (destSha === manifestSha && rel.startsWith('.claude/skills/') && !existsSync(join(templateDir, rel))) {
        retired.push(rel) // unmodified skill goodvibes no longer ships
      } else if (destSha === manifestSha) {
        overwrite.push(rel) // unmodified, safe to overwrite with new template version
      } else {
        skip.push(rel) // user-modified, preserve
      }
    }
  }

  // Second pass: template files absent from manifest are net-new
  const trackedLayers = new Set(Object.entries(manifest.files).filter(([, v]) => v !== USER_REMOVED).map(([k]) => layer(k)))
  const allTemplateFiles = (await listTemplateFiles(templateDir)).map(posixKey)
  for (const templateFile of allTemplateFiles) {
    if (templateFile === '.goodvibes.json') continue
    const isVariant = ciVariants.some(v => templateFile.endsWith(v))
    if (isVariant && !templateFile.endsWith(selectedVariantSrc)) continue
    const destRel = templateFile.endsWith(selectedVariantSrc)
      ? '.github/workflows/ci.yml'
      : templateFile
    if (destRel in manifest.files || excluded(destRel)) continue
    const destLayer = layer(destRel)
    if (destLayer && !trackedLayers.has(destLayer)) continue
    const why = await writeBlocked(cwd, destRel)
    if (why) {
      blocked[destRel] = why
      continue
    }
    // init only records files it wrote; a file already on disk is the user's own.
    if (destRel !== 'CLAUDE.md' && existsSync(join(cwd, destRel))) {
      kept.push(destRel)
    } else {
      netNew.push(destRel)
    }
  }

  return { overwrite, skip, netNew, kept, removed, stillRemoved, retired, blocked }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update goodvibes-managed files using the manifest')
    .option('--dry-run', 'Preview what would change without writing')
    .option('--force', 'Skip confirmation prompt and overwrite without asking')
    .action(async (options: { dryRun: boolean; force: boolean }) => {
      intro('goodvibes update')
      await runUpdate(options.dryRun ?? false, options.force ?? false)
    })
}

export async function runUpdate(dryRun: boolean, force: boolean): Promise<void> {
  const cwd = process.cwd()

  let manifest: Manifest | null
  let globalManifest: Manifest | null
  try {
    manifest = await readManifest(cwd)
    globalManifest = await readManifest(claudeConfigDir())
  } catch (e) {
    cancel((e as Error).message)
    process.exit(1)
  }
  if (!manifest && !globalManifest) {
    note(
      "No .goodvibes.json in this folder or in your Claude Code settings, so goodvibes is not set up here yet.\n" +
        "Run 'goodvibes init' (files you already have are kept), then 'goodvibes update' keeps them current.",
      'No manifest',
    )
    outro('Nothing updated.')
    return // exit 0 — UPD-05 requires no crash, no process.exit(1)
  }

  // Everything is planned (global as a dry run) before the one prompt, so cancelling leaves every file untouched.
  const templateDir = resolveTemplatesDir()
  const globalPlan = globalManifest || manifest?.scope === 'global' ? await applyGlobalConfig(templateDir, packageVersion(), true) : undefined
  if (globalPlan) note(formatGlobal(globalPlan, undefined, undefined), `${dryRun ? 'Dry run — ' : 'Plan — '}Global setup (${globalPlan.configDir})`)

  const projectType = detectProjectType(cwd)
  const scope: Scope = manifest?.scope ?? 'project'
  const { overwrite, skip, netNew, kept, removed, stillRemoved, retired, blocked } = manifest
    ? await categorise(templateDir, cwd, manifest, projectType, scope)
    : { overwrite: [], skip: [], netNew: [], kept: [], removed: [], stillRemoved: [], retired: [], blocked: {} as Record<string, string> }

  // User-modified settings.json and MCP files still receive goodvibes-managed keys.
  const merges: { rel: string; merged: Record<string, unknown>; changes: string[] }[] = []
  const mergeErrors: string[] = []
  for (const rel of [...skip, ...kept].filter(r => MANAGED_JSON.includes(r))) {
    const tplPath = join(templateDir, rel)
    if (!existsSync(tplPath)) continue
    let user: unknown
    try {
      user = JSON.parse(await readFile(join(cwd, rel), 'utf-8'))
    } catch (e) {
      mergeErrors.push(`${rel}: not valid JSON (${(e as Error).message}); left unchanged, fix it and re-run update`)
      continue
    }
    if (!isJsonObject(user)) {
      mergeErrors.push(`${rel}: not a JSON object; left unchanged, fix it and re-run update`)
      continue
    }
    const tpl = JSON.parse(await readFile(tplPath, 'utf-8'))
    const { merged, changes } = mergeManagedJson(rel, tpl, user, manifest?.managed?.[rel], rel === '.claude/settings.json')
    if (changes.length > 0) merges.push({ rel, merged, changes })
  }

  // A hook the manifest says goodvibes installed, now missing, was deleted by the user: never re-add it.
  const hookPlan = manifest && manifest.gitHook !== USER_REMOVED ? await installGitHook(cwd, true) : null
  const hookRemoved = manifest?.gitHook === 'installed' && hookPlan?.status === 'installed'
  const hookWrites = !hookRemoved && (hookPlan?.status === 'installed' || hookPlan?.status === 'updated')

  if (manifest) {
    note(
      [
        overwrite.length > 0 ? `Will overwrite (${overwrite.length}): ${overwrite.join(', ')}` : null,
        skip.length > 0 ? `Will skip — user-modified (${skip.length}): ${skip.join(', ')}` : null,
        netNew.length > 0 ? `Will add net-new (${netNew.length}): ${netNew.join(', ')}` : null,
        kept.length > 0 ? `Will keep — already yours, not written by goodvibes (${kept.length}): ${kept.join(', ')}` : null,
        retired.length > 0 ? `Will remove — no longer shipped by goodvibes (${retired.length}): ${retired.join(', ')}` : null,
        ...merges.map(m => `Will merge goodvibes keys into ${m.rel}:\n  ${m.changes.join('\n  ')}`),
        ...mergeErrors.map(e => `Cannot merge ${e}`),
        ...removed.map(removedNote),
        ...Object.values(blocked),
        hookRemoved ? removedNote('.git/hooks/pre-commit') : hookPlan && gitHookLine(hookPlan, true),
      ]
        .filter(Boolean)
        .join('\n') || 'Nothing to change in this project.',
      dryRun ? 'Dry run — no files written' : 'Plan',
    )
  }
  if (dryRun) {
    outro('Run without --dry-run to apply changes.')
    return
  }

  const globalChanges = globalPlan ? globalPlan.written.length + globalPlan.retired.length + globalPlan.settingsChanges.length : 0
  if (!force && (globalChanges > 0 || overwrite.length > 0 || netNew.length > 0 || retired.length > 0 || merges.length > 0 || hookWrites)) {
    const proceed = await confirm({
      message:
        `Overwrite ${overwrite.length} managed file(s), add ${netNew.length}, merge goodvibes keys into ${merges.length} file(s)` +
        `${globalPlan ? ` and update ${globalPlan.configDir}` : ''}?`,
    })
    if (isCancel(proceed) || !proceed) {
      cancel('Update cancelled. Nothing was changed.')
      process.exit(0)
    }
  }

  if (globalPlan) {
    const g = await applyGlobalConfig(templateDir, packageVersion(), false)
    note(formatGlobal(g, undefined, undefined), `Global setup (${g.configDir})`)
  }
  if (!manifest) {
    outro('Done!')
    return
  }

  // Apply overwrite + net-new; skip user-modified files
  const selectedVariantSrc = `.github/workflows/ci-${projectType}.yml`
  const claudeProblems: string[] = []
  for (const rel of [...overwrite, ...netNew]) {
    await assertSafe(cwd, rel)
    let templateSrc: string
    if (rel === 'CLAUDE.md') {
      templateSrc = join(templateDir, 'CLAUDE.md')
    } else if (rel === '.github/workflows/ci.yml') {
      // ponytail: map dest ci.yml back to the selected source variant
      templateSrc = join(templateDir, selectedVariantSrc)
    } else {
      templateSrc = join(templateDir, rel)
    }
    if (!existsSync(templateSrc)) continue
    if (rel === 'CLAUDE.md') {
      const templateContent = await readFile(templateSrc, 'utf-8')
      try {
        await mergeClaude(join(cwd, rel), templateContent)
      } catch (e) {
        if (!(e instanceof MarkerError)) throw e
        claudeProblems.push(e.message)
      }
    } else {
      await copy(templateSrc, join(cwd, rel), { overwrite: true })
    }
  }

  for (const m of merges) {
    await writeFileAtomic(join(cwd, m.rel), JSON.stringify(m.merged, null, 2) + '\n')
  }

  for (const rel of retired) {
    await assertSafe(cwd, rel)
    await removeRetired(cwd, rel, '.claude/skills')
  }

  let hookResult: GitHookResult | null = null
  let gitHook = manifest.gitHook
  if (hookRemoved) gitHook = USER_REMOVED
  else if (hookPlan) {
    hookResult = await installGitHook(cwd, false)
    if (hookInPlace(hookResult)) gitHook = 'installed'
  }

  // Preserve skipped (user-modified) files' prior hashes so they stay
  // protected on every later run instead of dropping out of the manifest.
  const preserved: Record<string, string> = {}
  for (const rel of [...skip, ...Object.keys(blocked)]) {
    if (rel in manifest.files) preserved[rel] = manifest.files[rel]
  }
  if (claudeProblems.length > 0 && 'CLAUDE.md' in manifest.files) preserved['CLAUDE.md'] = manifest.files['CLAUDE.md']
  for (const rel of kept) {
    preserved[rel] = USER_OWNED
  }
  for (const rel of [...removed, ...stillRemoved]) {
    preserved[rel] = USER_REMOVED
  }

  const manifestBlocked = await writeManifest(
    cwd,
    [...overwrite, ...netNew].filter(rel => existsSync(join(cwd, rel)) && !(rel === 'CLAUDE.md' && claudeProblems.length > 0)),
    packageVersion(),
    preserved,
    await managedRecord(cwd, templateDir, manifest.managed),
    scope,
    gitHook,
  )

  const applied = overwrite.length + netNew.length
  note(
    [
      `Applied ${applied} file(s). Skipped ${skip.length + kept.length} user-modified file(s).`,
      ...merges.map(m => `Merged ${m.changes.length} goodvibes key(s) into ${m.rel}.`),
      ...retired.map(rel => `${rel}: removed, no longer shipped by goodvibes`),
      ...mergeErrors.map(e => `Not merged: ${e}`),
      ...removed.map(removedNote),
      ...Object.values(blocked),
      ...(manifestBlocked ? [manifestBlocked] : []),
      ...claudeProblems,
      hookRemoved ? removedNote('.git/hooks/pre-commit') : hookResult && gitHookLine(hookResult, false),
    ].filter(Boolean).join('\n'),
    'Update complete',
  )
  if (claudeProblems.length > 0) {
    cancel('CLAUDE.md was not updated; fix it by hand as described above, then run goodvibes update again.')
    process.exit(1)
  }
  outro('Done!')
}
