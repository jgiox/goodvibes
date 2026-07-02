import type { Command } from 'commander'
import { intro, outro, note, tasks } from '@clack/prompts'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { extractVersion, versionGte, mergeClaude } from '../utils/sentinel-merge.js'
import { copy, pathExists } from 'fs-extra'
import { readFile, rename } from 'node:fs/promises'
import { existsSync } from 'fs'
import { join, relative } from 'path'
import { execa } from 'execa'
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
const _GV_UPGRADING = '_GV_UPGRADING'

async function checkLatestNpmVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa('npm', ['view', 'goodvibes-cli', 'version'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

function getInstalledVersion(): string | null {
  try {
    // Walk up from this file to find package.json bundled in the dist
    const pkg = _require('../../package.json') as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

async function selfUpdateNpm(version: string): Promise<void> {
  await execa('npm', ['install', '-g', `goodvibes-cli@${version}`], { stdio: 'inherit' })
}

const MANAGED_FIXED = new Set([
  'CLAUDE.md',
  '.github/workflows/ci.yml',
  '.github/workflows/security.yml',
  '.github/workflows/dependency-review.yml',
  '.github/dependabot.yml',
])

async function detectInstalledVersion(cwd: string): Promise<string | null> {
  const claudePath = join(cwd, 'CLAUDE.md')
  if (!(await pathExists(claudePath))) return null
  const content = await readFile(claudePath, 'utf-8')
  return extractVersion(content)
}

async function computeChanges(
  templateDir: string,
  destDir: string,
  projectType: string,
): Promise<Array<{ path: string; status: 'changed' | 'unchanged' | 'new' }>> {
  const allFiles = (await listTemplateFiles(templateDir)) ?? []
  const managedFiles = allFiles.filter(
    f =>
      f.startsWith('.claude/skills/') ||
      MANAGED_FIXED.has(f) ||
      // ci.yml variant maps to the fixed set already — include it for comparison
      f === `.github/workflows/ci-${projectType}.yml`,
  )

  const results: Array<{ path: string; status: 'changed' | 'unchanged' | 'new' }> = []

  for (const rel of managedFiles) {
    // Normalise ci variant to its dest path for comparison purposes
    const destRel =
      rel === `.github/workflows/ci-${projectType}.yml` ? '.github/workflows/ci.yml' : rel

    const srcPath = join(templateDir, rel)
    const destPath = join(destDir, destRel)

    if (!(await pathExists(destPath))) {
      results.push({ path: destRel, status: 'new' })
      continue
    }

    const srcContent = await readFile(srcPath, 'utf-8')
    const destContent = await readFile(destPath, 'utf-8')
    results.push({ path: destRel, status: srcContent === destContent ? 'unchanged' : 'changed' })
  }

  return results.sort((a, b) => a.path.localeCompare(b.path))
}

export function formatChangeSummary(changes: Array<{ path: string; status: string }>): string {
  if (changes.length === 0) return '(no managed files found)'
  const label: Record<string, string> = { changed: 'updated', unchanged: 'unchanged', new: 'new' }
  return changes.map(c => `${label[c.status] ?? '?'} ${c.path}`).join('\n')
}

async function upgradeTemplates(templateDir: string, destDir: string, projectType: string): Promise<string[]> {
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariant = `ci-${projectType}.yml`
  const claudeDest = join(destDir, 'CLAUDE.md')

  await copy(templateDir, destDir, {
    overwrite: true,
    errorOnExist: false,
    filter: (src: string) => {
      if (src.endsWith('CLAUDE.md')) return false // handled by mergeClaude
      // ponytail: path traversal guard per T-05-02 (templates are repo-controlled but belt-and-suspenders)
      if (relative(templateDir, src).includes('..')) return false
      if (src.includes('.claude/skills/')) return true
      for (const v of ciVariants) {
        if (src.endsWith(v) && v !== selectedVariant) return false
      }
      if (src.includes('.github/workflows/')) return true
      return false // default: only touch the declared managed set
    },
  })

  // Rename selected CI variant to ci.yml
  const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
  const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
  if (existsSync(variantPath)) {
    await rename(variantPath, ciPath)
  }

  const claudeSrc = join(templateDir, 'CLAUDE.md')
  const templateContent = await readFile(claudeSrc, 'utf-8')
  await mergeClaude(claudeDest, templateContent)

  // Return paths written — walk only the managed prefixes to avoid touching user files
  const allDest = (await listTemplateFiles(destDir)) ?? []
  return allDest
    .filter(f => f.startsWith('.claude/skills/') || f.startsWith('.github/workflows/') || f === 'CLAUDE.md')
    .sort()
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .alias('update')
    .description('Update goodvibes-managed files to the latest version')
    .option('--dry-run', 'Preview what would change without writing')
    .action(async (options: { dryRun: boolean }) => {
      const dryRun = options.dryRun ?? false
      const cwd = process.cwd()

      intro('goodvibes upgrade')

      // Self-update: check npm for a newer package version and re-exec if found.
      // _GV_UPGRADING prevents infinite re-exec if the new binary still sees itself as outdated.
      if (!process.env[_GV_UPGRADING]) {
        const current = getInstalledVersion()
        const latest = await checkLatestNpmVersion()
        if (latest && current && !versionGte(current, latest)) {
          note(`Updating goodvibes ${current} → ${latest}…`, 'New version available')
          await selfUpdateNpm(latest)
          note(`Updated to ${latest} — re-applying templates…`, '✓')
          const { execa: execaFn } = await import('execa')
          await execaFn(process.argv[1], process.argv.slice(2), {
            stdio: 'inherit',
            env: { ...process.env, [_GV_UPGRADING]: '1' },
          })
          process.exit(0)
          return
        }
      }

      const templateDir = resolveTemplatesDir()
      const projectType = detectProjectType(cwd)

      const installedVersion = await detectInstalledVersion(cwd)
      const bundledVersion = getInstalledVersion()

      if (installedVersion && bundledVersion && versionGte(installedVersion, bundledVersion)) {
        outro(`Already up to date (v${installedVersion})`)
        return
      }

      const changes = await computeChanges(templateDir, cwd, projectType)
      note(formatChangeSummary(changes), 'What will change')

      if (dryRun) {
        outro('Run without --dry-run to apply these changes.')
        return
      }

      const updated: string[] = []
      await tasks([
        {
          title: 'Upgrading managed files',
          task: async () => {
            const files = await upgradeTemplates(templateDir, cwd, projectType)
            updated.push(...files)
            return `Updated ${files.length} files`
          },
        },
      ])

      note(updated.join('\n') || '(no files changed)', 'Files updated')
      outro('Upgrade complete!')
    })
}
