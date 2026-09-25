import { copy } from 'fs-extra'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { readdir } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import { fileURLToPath } from 'url'
import { mergeClaude, MarkerError } from '../utils/sentinel-merge.js'
import { writeBlocked } from '../utils/fs-safe.js'
import { dependabotYml, type ProjectType } from '../utils/detect-project-type.js'
import { GLOBAL_OWNED, MINIMAL_SKIPPED, projectStub, type Scope } from '../utils/scope.js'

const FILE_SIZE_WORKFLOW = join('.github', 'workflows', 'file-size.yml')

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

// Same two-candidate probe as resolveTemplatesDir: dist → packages/npm/hooks (prebuild copy), source → repo-root hooks/.
export function resolveHooksDir(): string {
  const distRelative = fileURLToPath(new URL('../hooks', import.meta.url))
  if (existsSync(distRelative)) return distRelative
  return fileURLToPath(new URL('../../../../hooks', import.meta.url))
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
  projectType: ProjectType = 'both',
  scope: Scope = 'project',
): Promise<{ written: string[]; skipped: string[]; problems: string[] }> {
  const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
  const selectedVariant = `ci-${projectType}.yml`

  if (dryRun) {
    // Return template files excluding non-selected CI variants (preserves --dry-run NPM-07 behaviour)
    const all = (await listTemplateFiles(templateDir)).filter(p => scope === 'project' || !GLOBAL_OWNED(p))
    return { written: all.filter(p => !ciVariants.some(v => p.endsWith(v) && v !== selectedVariant)), skipped: [], problems: [] }
  }

  // Only goodvibes destinations are checked, never the whole project: an unreadable folder or node_modules must not matter.
  const ours = [...await listTemplateFiles(templateDir), join('.github', 'workflows', 'ci.yml')]
  const onDisk = async (): Promise<Set<string>> => {
    const found = await Promise.all(ours.map(async f => existsSync(join(destDir, f)) && !(await writeBlocked(destDir, f))))
    return new Set(ours.filter((_, i) => found[i]))
  }
  const existingBefore = await onDisk()

  const skippedFiles: string[] = []
  const problems: string[] = []
  const destCiYml = join(destDir, '.github', 'workflows', 'ci.yml')
  const workflowPrefix = join('.github', 'workflows') + sep
  const destWorkflows = join(destDir, '.github', 'workflows')
  const destHasWorkflows = existsSync(destWorkflows) && statSync(destWorkflows).isDirectory() &&
    readdirSync(destWorkflows).some(f => f.endsWith('.yml') || f.endsWith('.yaml'))

  try {
    await copy(templateDir, destDir, {
      overwrite: false,
      errorOnExist: false,
      filter: async (src: string, dest: string) => {
        if (src.endsWith('CLAUDE.md')) return false // handled by sentinel merge
        const rel = relative(templateDir, src)
        if (rel === '') return true
        if (minimal && MINIMAL_SKIPPED(rel)) return false
        // ponytail: path traversal guard per T-02-02-A (templates are repo-controlled but belt-and-suspenders)
        if (rel.includes('..')) return false
        if (scope === 'global' && GLOBAL_OWNED(rel)) return false
        // Skip selected CI variant on re-runs where ci.yml already exists (prevents orphaned variant file)
        if (src.endsWith(selectedVariant) && existsSync(destCiYml)) return false
        // Skip CI variants not matching the detected project type
        for (const variant of ciVariants) {
          if (src.endsWith(variant) && variant !== selectedVariant) return false
        }
        // Skip template workflows if dest already has CI; file-size.yml travels with its script in .github/scripts
        if (destHasWorkflows && rel.startsWith(workflowPrefix) && src.endsWith('.yml') && rel !== FILE_SIZE_WORKFLOW) return false
        const blocked = await writeBlocked(destDir, relative(destDir, dest))
        if (blocked) skippedFiles.push(blocked)
        return !blocked
      },
    })
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    const hint = err.code === 'EACCES' || err.code === 'EPERM'
      ? 'Check directory permissions.'
      : 'Check available disk space.'
    err.message = `Cannot copy template files: ${err.message}. ${hint}`
    throw err
  }

  // Rename selected CI variant to ci.yml
  if (!minimal) {
    const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
    const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
    // The variant was just copied, so it is only there if .github/workflows is a real folder inside the project.
    if (existsSync(variantPath) && !(await writeBlocked(destDir, join('.github', 'workflows', selectedVariant)))) {
      const ciBlocked = await writeBlocked(destDir, join('.github', 'workflows', 'ci.yml'))
      if (ciBlocked) {
        skippedFiles.push(ciBlocked)
        await rm(variantPath)
      } else if (existsSync(ciPath)) {
        skippedFiles.push('.github/workflows/ci.yml') // ponytail: UX-04
      } else {
        await rename(variantPath, ciPath)
      }
    }
  }

  const dependabot = join('.github', 'dependabot.yml')
  if (!existingBefore.has(dependabot) && existsSync(join(destDir, dependabot)) && !(await writeBlocked(destDir, dependabot))) {
    await writeFile(join(destDir, dependabot), dependabotYml(await readFile(join(templateDir, dependabot), 'utf-8'), destDir), 'utf-8')
  }

  const claudeSrc = join(templateDir, 'CLAUDE.md')
  const claudeDest = join(destDir, 'CLAUDE.md')
  const templateContent = await readFile(claudeSrc, 'utf-8')
  const claudeBlocked = await writeBlocked(destDir, 'CLAUDE.md')
  let claudeMerged = false
  if (claudeBlocked) {
    skippedFiles.push(claudeBlocked)
  } else if (scope === 'project') {
    try {
      await mergeClaude(claudeDest, templateContent)
      claudeMerged = true
    } catch (e) {
      if (!(e instanceof MarkerError)) throw e
      problems.push(e.message)
    }
  } else if (!existsSync(claudeDest)) {
    await writeFile(claudeDest, projectStub(templateContent), 'utf-8')
  }

  const allDestFiles = [...await onDisk()].sort()
  const written = allDestFiles.filter(f => !existingBefore.has(f))
  // CLAUDE.md is always in 'written' — sentinel merge runs regardless (per RESEARCH.md note)
  const writtenWithClaude = written.includes('CLAUDE.md') || !claudeMerged ? written : ['CLAUDE.md', ...written]
  const skipped = [...allDestFiles.filter(f => existingBefore.has(f) && f !== 'CLAUDE.md'), ...skippedFiles]
  return { written: writtenWithClaude.sort(), skipped: skipped.sort(), problems }
}
