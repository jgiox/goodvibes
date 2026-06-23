import { copy } from 'fs-extra'
import { readFile } from 'node:fs/promises'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { mergeClaude } from '../utils/sentinel-merge.js'

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

export async function copyTemplates(
  templateDir: string,
  destDir: string,
  dryRun: boolean,
  minimal: boolean,
): Promise<string[]> {
  if (dryRun) {
    return listTemplateFiles(templateDir)
  }

  await copy(templateDir, destDir, {
    overwrite: false,
    errorOnExist: false,
    filter: (src: string) => {
      if (src.endsWith('CLAUDE.md')) return false // handled by sentinel merge
      if (minimal && src.includes('.github/workflows')) return false
      // ponytail: path traversal guard per T-02-02-A (templates are repo-controlled but belt-and-suspenders)
      if (relative(templateDir, src).includes('..')) return false
      return true
    },
  })

  const claudeSrc = join(templateDir, 'CLAUDE.md')
  const claudeDest = join(destDir, 'CLAUDE.md')
  const templateContent = await readFile(claudeSrc, 'utf-8')
  await mergeClaude(claudeDest, templateContent)

  return listTemplateFiles(templateDir)
}
