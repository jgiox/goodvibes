import type { Command } from 'commander'
import { intro, outro, note, confirm, isCancel, cancel } from '@clack/prompts'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { readManifest, writeManifest } from '../steps/write-manifest.js'
import { mergeClaude } from '../utils/sentinel-merge.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copy } from 'fs-extra'

const _require = createRequire(import.meta.url)

function assertSafe(base: string, rel: string): void {
  const resolved = resolve(base, rel)
  if (!resolved.startsWith(resolve(base) + sep)) {
    throw new Error(`Unsafe manifest key rejected: ${rel}`)
  }
}

function getVersion(): string {
  try {
    const pkg = _require('../../package.json') as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function categorise(
  templateDir: string,
  cwd: string,
  manifest: { files: Record<string, string> },
  projectType: string,
): Promise<{ overwrite: string[]; skip: string[]; netNew: string[] }> {
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariantSrc = `ci-${projectType}.yml`
  const overwrite: string[] = []
  const skip: string[] = []
  const netNew: string[] = []

  // First pass: check manifest-tracked files — unmodified → overwrite, user-modified → skip
  for (const [rel, manifestSha] of Object.entries(manifest.files)) {
    assertSafe(cwd, rel)
    const destPath = join(cwd, rel)
    if (!existsSync(destPath)) {
      overwrite.push(rel) // dest gone, re-create
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
    if (!(destRel in manifest.files)) {
      netNew.push(destRel)
    }
  }

  return { overwrite, skip, netNew }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update goodvibes-managed files using the manifest')
    .option('--dry-run', 'Preview what would change without writing')
    .option('--force', 'Skip confirmation prompt and overwrite without asking')
    .action(async (options: { dryRun: boolean; force: boolean }) => {
      const dryRun = options.dryRun ?? false
      const force = options.force ?? false
      const cwd = process.cwd()

      intro('goodvibes update')

      const manifest = await readManifest(cwd)
      if (!manifest) {
        note(
          "No .goodvibes.json found. This project was initialised before v1.2.0.\n" +
            "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update' to keep files current.",
          'No manifest',
        )
        outro('Nothing updated.')
        return // exit 0 — UPD-05 requires no crash, no process.exit(1)
      }

      const templateDir = resolveTemplatesDir()
      const projectType = detectProjectType(cwd)
      const { overwrite, skip, netNew } = await categorise(templateDir, cwd, manifest, projectType)

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
          ]
            .filter(Boolean)
            .join('\n'),
          'Dry run — no files written',
        )
        outro('Run without --dry-run to apply changes.')
        return
      }

      if (!force && overwrite.length > 0) {
        const proceed = await confirm({ message: `Overwrite ${overwrite.length} managed file(s)?` })
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

      await writeManifest(
        cwd,
        [...overwrite, ...netNew].filter(rel => existsSync(join(cwd, rel))),
        getVersion(),
      )

      const applied = overwrite.length + netNew.length
      note(
        `Applied ${applied} file(s). Skipped ${skip.length} user-modified file(s).`,
        'Update complete',
      )
      outro('Done!')
    })
}
