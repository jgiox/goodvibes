import type { Command } from 'commander'
import { intro, outro, note, tasks } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { installHeadroom } from '../steps/install-headroom.js'
import { configureMcp } from '../steps/configure-mcp.js'

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
      const templateDir = resolveTemplatesDir()

      intro('goodvibes init')

      if (dryRun) {
        const files = await listTemplateFiles(templateDir)
        note(files.map(f => `  Would write: ${f}`).join('\n'), 'Dry run — no files written')
        note(
          [
            '1. Open this project in Claude Code',
            '2. Run /plugin marketplace add DietrichGebert/ponytail',
            '3. Start coding — CLAUDE.md rules are already active',
          ].join('\n'),
          'Next steps'
        )
        outro('Run without --dry-run to apply these changes.')
        return
      }

      const createdFiles: string[] = []

      const taskList: Array<{ title: string; task: (message: (msg: string) => void) => Promise<string> }> = [
        {
          title: 'Copying template files',
          task: async (message) => {
            const files = await copyTemplates(templateDir, cwd, false, minimal)
            createdFiles.push(...files)
            return `Copied ${files.length} files`
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

      await tasks(taskList)

      note(createdFiles.join('\n'), 'Files created')

      const nextSteps = [
        '1. Open this project in Claude Code',
        '2. Run /plugin marketplace add DietrichGebert/ponytail',
        '3. Start coding — CLAUDE.md rules are already active',
      ].join('\n')
      note(nextSteps, 'Next steps')

      outro("You're all set!")
    })
}
