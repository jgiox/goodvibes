import type { Command } from 'commander'
import { readdirSync } from 'node:fs'
import { intro, outro, note, tasks, cancel } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { installHeadroom } from '../steps/install-headroom.js'
import { configureMcp } from '../steps/configure-mcp.js'
import { detectProjectType } from '../utils/detect-project-type.js'

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Bootstrap a project with goodvibes configuration')
    .option('--dry-run', 'Preview files without writing to disk')
    .option('--minimal', 'Skip headroom install and CI workflows')
    .action(async (options: { dryRun: boolean; minimal: boolean }) => {
      const dryRun = options.dryRun ?? false
      const minimal = options.minimal ?? false
      const cwd = process.cwd()
      const projectType = detectProjectType(cwd)
      const templateDir = resolveTemplatesDir()

      // Moved before dryRun check — needed for both dry-run and normal paths
      const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
      const selectedVariant = `ci-${projectType}.yml`

      intro('goodvibes init')

      const existingEntries = readdirSync(cwd).filter(e => e !== '.git' && e !== '.DS_Store')
      if (existingEntries.length > 0) {
        note('Existing files will not be overwritten.', 'Non-empty project detected')
      }

      if (dryRun) {
        const allFiles = await listTemplateFiles(templateDir)
        const files = minimal
          ? allFiles.filter(f => !f.startsWith('.github') && !f.startsWith('docs'))
          : allFiles.filter(f => !ciVariants.some((v: string) => f.endsWith(v) && v !== selectedVariant))
        note(files.map(f => `  Would write: ${f}`).join('\n'), 'Dry run — no files written')
        note(
          [
            '1. Open this project in Claude Code',
            '2. In Claude Code CLI: /plugin marketplace add DietrichGebert/ponytail',
            '3. Start coding — CLAUDE.md rules are already active',
            ...(minimal ? ['4. Run without --minimal to also add CI workflows and docs.'] : []),
          ].join('\n'),
          'Next steps'
        )
        outro('Run without --dry-run to apply these changes.')
        return
      }

      const createdFiles: string[] = []
      const skippedFiles: string[] = []

      const taskList: Array<{ title: string; task: (message: (msg: string) => void) => Promise<string> }> = [
        {
          title: 'Copying template files',
          task: async (message) => {
            const { written, skipped } = await copyTemplates(templateDir, cwd, false, minimal, projectType)
            createdFiles.push(...written)
            skippedFiles.push(...skipped)
            return `Copied ${written.length} files`
          },
        },
      ]

      if (!minimal) {
        taskList.push(
          {
            title: 'Installing headroom',
            task: async (message) => {
              await installHeadroom((msg) => message(msg))
              return 'headroom ready'
            },
          },
          {
            title: 'Configuring headroom MCP',
            task: async (message) => {
              await configureMcp((msg) => message(msg))
              return 'MCP server registered'
            },
          }
        )
      }

      try {
        await tasks(taskList)
      } catch (e) {
        const err = e as NodeJS.ErrnoException
        const msg = err.code === 'EACCES' || err.code === 'EPERM'
          ? `Cannot write files to ${cwd}.\nWhy: You do not have write permission.\nFix: chmod u+w ${cwd}  (macOS/Linux) or check folder properties (Windows)`
          : `Setup failed: ${err.message ?? String(e)}\nFix: Run npx goodvibes@latest init`
        cancel(msg)
        process.exit(1)
      }

      note(createdFiles.join('\n') || '(none)', `Files written (${createdFiles.length})`)
      if (skippedFiles.length > 0) {
        note(skippedFiles.join('\n'), `Files skipped (${skippedFiles.length})`)
      }

      const nextSteps = [
        '1. Open this project in Claude Code',
        '2. In Claude Code CLI: /plugin marketplace add DietrichGebert/ponytail',
        '3. Start coding — CLAUDE.md rules are already active',
      ].join('\n')
      note(nextSteps, 'Next steps')

      if (minimal) {
        note(
          'CI workflows and docs were skipped.\nRun goodvibes init without --minimal to add them.',
          'Skipped layers'
        )
      }

      outro("You're all set!")
    })
}
