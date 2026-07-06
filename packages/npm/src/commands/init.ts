import type { Command } from 'commander'
import { readdirSync } from 'node:fs'
import { intro, outro, note, tasks, cancel } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { installHeadroom, type HeadroomResult } from '../steps/install-headroom.js'
import { configureMcp, type McpResult } from '../steps/configure-mcp.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { sendTelemetry } from '../steps/telemetry.js'

// ponytail: inline helper — too small to justify a separate module
function formatHeadroomStatus(hr: HeadroomResult | undefined, mr: McpResult | undefined): string {
  const lines: string[] = []
  if (hr) {
    const install = ({
      'installed':         'headroom: installed',
      'already-installed': 'headroom: already installed',
      'skipped':           `headroom: skipped (${hr.status === 'skipped' ? hr.reason : ''})`,
      'failed':            `headroom: install failed (${hr.status === 'failed' ? hr.reason : ''})`,
    } as Record<HeadroomResult['status'], string>)[hr.status]
    lines.push(install)
  }
  if (mr) {
    const mcp = ({
      'registered':         'MCP: registered',
      'already-registered': 'MCP: already configured',
      'skipped':            `MCP: skipped (${mr.status === 'skipped' ? mr.reason : ''})`,
      'failed':             `MCP: failed (${mr.status === 'failed' ? mr.reason : ''})`,
    } as Record<McpResult['status'], string>)[mr.status]
    lines.push(mcp)
  }
  return lines.join('\n')
}

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

      const telemetryOptOut = process.env.DO_NOT_TRACK === '1' || process.env.GOODVIBES_NO_TELEMETRY === '1' || process.env.CI === 'true'
      if (!telemetryOptOut) { note('Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.', 'Privacy') }

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
            '1. Open this project in your AI coding tool',
            '2. Claude Code users: /plugin marketplace add DietrichGebert/ponytail',
            '   Other IDEs (Cursor, Windsurf, Kiro, Antigravity, etc.): rules already active',
            '3. Start coding — CLAUDE.md rules are already active',
            ...(minimal ? ['4. Run without --minimal to also add CI workflows and docs.'] : []),
          ].join('\n'),
          'Next steps'
        )
        outro('Run without --dry-run to apply these changes.')
        return
      }

      const telemetryPromise = sendTelemetry()

      const createdFiles: string[] = []
      const skippedFiles: string[] = []
      let headroomResult: HeadroomResult | undefined
      let mcpResult: McpResult | undefined

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
        // ponytail: inline label tables — too small to justify a separate module
        const headroomLabels: Record<HeadroomResult['status'], string> = {
          'installed':         'headroom installed',
          'already-installed': 'headroom already installed',
          'skipped':           'headroom skipped (Python 3.10+ not found)',
          'failed':            'headroom install failed — see note below',
        }
        const mcpLabels: Record<McpResult['status'], string> = {
          'registered':         'MCP server registered',
          'already-registered': 'MCP server already configured',
          'skipped':            'MCP registration skipped',
          'failed':             'MCP registration failed — see note below',
        }
        taskList.push(
          {
            title: 'Installing headroom',
            task: async (message) => {
              headroomResult = await installHeadroom((msg) => message(msg))
              return headroomLabels[headroomResult.status]
            },
          },
          {
            title: 'Configuring headroom MCP',
            task: async (message) => {
              mcpResult = await configureMcp((msg) => message(msg))
              return mcpLabels[mcpResult.status]
            },
          }
        )
      }

      try {
        await tasks(taskList)
      } catch (e) {
        const err = e as NodeJS.ErrnoException
        const msg = err.code === 'EACCES' || err.code === 'EPERM'
          ? `Cannot write files to ${cwd}.\nWhy: You do not have write permission here.\nFix: Make sure you are inside your project directory before running this command.\n      If permissions are the issue: chmod u+w ${cwd}  (macOS/Linux) or check folder properties (Windows)`
          : `Setup failed: ${err.message ?? String(e)}`
        cancel(msg)
        process.exit(1)
      }

      await Promise.race([telemetryPromise, sleep(1_000)])

      note(createdFiles.join('\n') || '(none)', `Files written (${createdFiles.length})`)
      if (skippedFiles.length > 0) {
        note(skippedFiles.join('\n'), `Files skipped (${skippedFiles.length})`)
      }

      if (!minimal && headroomResult) {
        note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')
      }

      const nextSteps = [
        '1. Open this project in your AI coding tool',
        '2. Claude Code users: /plugin marketplace add DietrichGebert/ponytail',
        '   Other IDEs (Cursor, Windsurf, Kiro, Antigravity, etc.): rules already active',
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

// ponytail: inline helper — keeps Promise.race readable
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }
