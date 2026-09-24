import type { Command } from 'commander'
import { intro, outro, note, confirm, isCancel, cancel } from '@clack/prompts'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { readManifest, writeManifest } from '../steps/write-manifest.js'
import { mergeClaude } from '../utils/sentinel-merge.js'
import { MANAGED_JSON, mergeManagedJson, managedRecord } from '../utils/json-merge.js'
import { applyGlobalConfig, claudeConfigDir, formatGlobal } from '../steps/global-setup.js'
import { GLOBAL_OWNED, type Scope } from '../utils/scope.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { packageVersion } from '../utils/version.js'
import { copy } from 'fs-extra'

// Not a hex digest, so the file always classifies as user-modified on later runs.
const USER_OWNED = 'user-owned'

function assertSafe(base: string, rel: string): void {
  const resolved = resolve(base, rel)
  if (!resolved.startsWith(resolve(base) + sep)) {
    throw new Error(`Unsafe manifest key rejected: ${rel}`)
  }
}

async function categorise(
  templateDir: string,
  cwd: string,
  manifest: { files: Record<string, string> },
  projectType: string,
  scope: Scope = 'project',
): Promise<{ overwrite: string[]; skip: string[]; netNew: string[]; kept: string[] }> {
  // In global scope the rules block, skills and context7 live in the user config, never in the project.
  const excluded = (rel: string) => scope === 'global' && (rel === 'CLAUDE.md' || GLOBAL_OWNED(rel))
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariantSrc = `ci-${projectType}.yml`
  const overwrite: string[] = []
  const skip: string[] = []
  const netNew: string[] = []
  const kept: string[] = []

  // First pass: check manifest-tracked files — unmodified → overwrite, user-modified → skip
  for (const [rel, manifestSha] of Object.entries(manifest.files)) {
    if (excluded(rel)) continue
    assertSafe(cwd, rel)
    const destPath = join(cwd, rel)
    if (!existsSync(destPath)) {
      overwrite.push(rel) // dest gone, re-create
    } else if (rel === 'CLAUDE.md') {
      // mergeClaude only ever replaces the sentinel block, so it's always safe to
      // run even when custom prose outside the block changes the whole-file hash.
      overwrite.push(rel)
    } else {
      const destContent = await readFile(destPath, 'utf-8')
      const destSha = createHash('sha256').update(destContent, 'utf8').digest('hex')
      if (destSha === manifestSha) {
        overwrite.push(rel) // unmodified, safe to overwrite with new template version
      } else {
        skip.push(rel) // user-modified, preserve
      }
    }
  }

  // Second pass: template files absent from manifest are net-new
  const allTemplateFiles = await listTemplateFiles(templateDir)
  for (const templateFile of allTemplateFiles) {
    if (templateFile === '.goodvibes.json') continue
    const isVariant = ciVariants.some(v => templateFile.endsWith(v))
    if (isVariant && !templateFile.endsWith(selectedVariantSrc)) continue
    const destRel = templateFile.endsWith(selectedVariantSrc)
      ? '.github/workflows/ci.yml'
      : templateFile
    if (destRel in manifest.files || excluded(destRel)) continue
    // init only records files it wrote; a file already on disk is the user's own.
    if (destRel !== 'CLAUDE.md' && existsSync(join(cwd, destRel))) {
      kept.push(destRel)
    } else {
      netNew.push(destRel)
    }
  }

  return { overwrite, skip, netNew, kept }
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

  const manifest = await readManifest(cwd)
  const globalManifest = await readManifest(claudeConfigDir())
  if (!manifest && !globalManifest) {
    note(
      "No .goodvibes.json found. This project was initialised before v1.2.0.\n" +
        "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update' to keep files current.",
      'No manifest',
    )
    outro('Nothing updated.')
    return // exit 0 — UPD-05 requires no crash, no process.exit(1)
  }

  const templateDir = resolveTemplatesDir()
  if (globalManifest || manifest?.scope === 'global') {
    const g = await applyGlobalConfig(templateDir, packageVersion(), dryRun)
    note(formatGlobal(g, undefined, undefined), `${dryRun ? 'Dry run — ' : ''}Global setup (${g.configDir})`)
  }
  if (!manifest) {
    outro(dryRun ? 'Run without --dry-run to apply changes.' : 'Done!')
    return
  }

  const projectType = detectProjectType(cwd)
  const scope: Scope = manifest.scope ?? 'project'
  const { overwrite, skip, netNew, kept } = await categorise(templateDir, cwd, manifest, projectType, scope)

  // User-modified settings.json / .mcp.json still receive goodvibes-managed keys.
  const merges: { rel: string; merged: Record<string, unknown>; changes: string[] }[] = []
  const mergeErrors: string[] = []
  for (const rel of [...skip, ...kept].filter(r => MANAGED_JSON.includes(r))) {
    const tplPath = join(templateDir, rel)
    if (!existsSync(tplPath)) continue
    let user: Record<string, unknown>
    try {
      user = JSON.parse(await readFile(join(cwd, rel), 'utf-8'))
    } catch (e) {
      mergeErrors.push(`${rel}: not valid JSON (${(e as Error).message}); left unchanged, fix it and re-run update`)
      continue
    }
    const tpl = JSON.parse(await readFile(tplPath, 'utf-8'))
    const { merged, changes } = mergeManagedJson(rel, tpl, user, manifest.managed?.[rel])
    if (changes.length > 0) merges.push({ rel, merged, changes })
  }
  const mergeLines = [
    ...merges.map(m => `Will merge goodvibes keys into ${m.rel}:\n  ${m.changes.join('\n  ')}`),
    ...mergeErrors.map(e => `Cannot merge ${e}`),
  ]

  if (dryRun) {
    note(
      [
        overwrite.length > 0
          ? `Will overwrite (${overwrite.length}): ${overwrite.join(', ')}`
          : null,
        skip.length > 0
          ? `Will skip — user-modified (${skip.length}): ${skip.join(', ')}`
          : null,
        netNew.length > 0 ? `Will add net-new (${netNew.length}): ${netNew.join(', ')}` : null,
        kept.length > 0
          ? `Will keep — already yours, not written by goodvibes (${kept.length}): ${kept.join(', ')}`
          : null,
        ...mergeLines,
      ]
        .filter(Boolean)
        .join('\n'),
      'Dry run — no files written',
    )
    outro('Run without --dry-run to apply changes.')
    return
  }

  if (!force && (overwrite.length > 0 || merges.length > 0)) {
    const proceed = await confirm({
      message: `Overwrite ${overwrite.length} managed file(s) and merge goodvibes keys into ${merges.length} file(s)?`,
    })
    if (isCancel(proceed) || !proceed) {
      cancel('Update cancelled.')
      process.exit(0)
    }
  }

  // Apply overwrite + net-new; skip user-modified files
  const selectedVariantSrc = `.github/workflows/ci-${projectType}.yml`
  for (const rel of [...overwrite, ...netNew]) {
    assertSafe(cwd, rel)
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
      await mergeClaude(join(cwd, rel), templateContent)
    } else {
      await copy(templateSrc, join(cwd, rel), { overwrite: true })
    }
  }

  for (const m of merges) {
    await writeFile(join(cwd, m.rel), JSON.stringify(m.merged, null, 2) + '\n', 'utf-8')
  }

  // Preserve skipped (user-modified) files' prior hashes so they stay
  // protected on every later run instead of dropping out of the manifest.
  const preserved: Record<string, string> = {}
  for (const rel of skip) {
    preserved[rel] = manifest.files[rel]
  }
  for (const rel of kept) {
    preserved[rel] = USER_OWNED
  }

  await writeManifest(
    cwd,
    [...overwrite, ...netNew].filter(rel => existsSync(join(cwd, rel))),
    packageVersion(),
    preserved,
    await managedRecord(cwd, templateDir, manifest.managed),
    scope,
  )

  const applied = overwrite.length + netNew.length
  note(
    [
      `Applied ${applied} file(s). Skipped ${skip.length + kept.length} user-modified file(s).`,
      ...merges.map(m => `Merged ${m.changes.length} goodvibes key(s) into ${m.rel}.`),
      ...mergeErrors.map(e => `Not merged: ${e}`),
    ].join('\n'),
    'Update complete',
  )
  outro('Done!')
}
