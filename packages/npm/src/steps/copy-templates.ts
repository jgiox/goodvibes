import { copy } from 'fs-extra'
import { readFile, rename } from 'node:fs/promises'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { mergeClaude } from '../utils/sentinel-merge.js'
import { type ProjectType } from '../utils/detect-project-type.js'

export function resolveTemplatesDir(): string {
  // tsup bundles everything into dist/index.js so import.meta.url at runtime points to
  // packages/npm/dist/index.js → '../templates' resolves to packages/npm/templates/ (prebuild copy).
  // When vitest runs source files directly, import.meta.url points to src/steps/copy-templates.ts
  // → '../../../../templates' resolves to the repo-root templates/ directory.
  // We probe both candidates and return the first that exists.
  const distRelative = fileURLToPath(new URL('../templates', import.meta.url))
  if (existsSync(distRelative)) return distRelative
  // Fallback: source-relative path (dev / vitest)
  return fileURLToPath(new URL('../../../../templates', import.meta.url))
}

export async function listTemplateFiles(templateDir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else {
        results.push(relative(templateDir, fullPath))
      }
    }
  }

  await walk(templateDir)
  return results.sort()
}

async function walkDir(dir: string, base: string): Promise<string[]> {
  const results: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walkDir(fullPath, base))
    } else {
      results.push(relative(base, fullPath))
    }
  }
  return results
}

export async function copyTemplates(
  templateDir: string,
  destDir: string,
  dryRun: boolean,
  minimal: boolean,
  projectType: ProjectType = 'both',
): Promise<string[]> {
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariant = `ci-${projectType}.yml`

  if (dryRun) {
    // Return template files excluding non-selected CI variants (preserves --dry-run NPM-07 behaviour)
    const all = await listTemplateFiles(templateDir)
    return all.filter(p => !ciVariants.some(v => p.endsWith(v) && v !== selectedVariant))
  }

  await copy(templateDir, destDir, {
    overwrite: false,
    errorOnExist: false,
    filter: (src: string) => {
      if (src.endsWith('CLAUDE.md')) return false // handled by sentinel merge
      if (minimal && src.includes('.github/workflows')) return false
      // ponytail: path traversal guard per T-02-02-A (templates are repo-controlled but belt-and-suspenders)
      if (relative(templateDir, src).includes('..')) return false
      // Skip CI variants not matching the detected project type
      for (const variant of ciVariants) {
        if (src.endsWith(variant) && variant !== selectedVariant) return false
      }
      return true
    },
  })

  // Rename selected CI variant to ci.yml
  if (!minimal) {
    const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
    const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
    if (existsSync(variantPath)) {
      await rename(variantPath, ciPath)
    }
  }

  const claudeSrc = join(templateDir, 'CLAUDE.md')
  const claudeDest = join(destDir, 'CLAUDE.md')
  const templateContent = await readFile(claudeSrc, 'utf-8')
  await mergeClaude(claudeDest, templateContent)

  // Walk destDir so return shows ci.yml (not ci-node.yml) — per RESEARCH.md Pitfall 6
  const destFiles = await walkDir(destDir, destDir)
  return destFiles.sort()
}
