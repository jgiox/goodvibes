import type { Command } from 'commander'
import { readdirSync } from 'node:fs'
import { packageVersion } from '../utils/version.js'
import { intro, outro, note, tasks, cancel } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { installHeadroom, type HeadroomResult } from '../steps/install-headroom.js'
import { configureMcp, type McpResult } from '../steps/configure-mcp.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { sendTelemetry, telemetryOptedOut } from '../steps/telemetry.js'
import { readManifest, writeManifest, type Manifest } from '../steps/write-manifest.js'
import { managedRecord } from '../utils/json-merge.js'
import { applyGlobalConfig, claudeConfigDir, ensureGlobalCli, registerContext7, formatGlobal, type GlobalResult, type CliStatus, type McpStatus } from '../steps/global-setup.js'
import { GLOBAL_OWNED, MINIMAL_SKIPPED, samePath, type Scope } from '../utils/scope.js'
import { gitHookLine, hookInPlace, installGitHook, type GitHookResult } from '../steps/git-hook.js'
import { homedir } from 'node:os'
import { join, resolve, parse } from 'node:path'
import { EDITED, STRIPPED, oldSkillCopies, removedLine } from '../steps/project-copies.js'
import { MarkerError, stripBlock } from '../utils/sentinel-merge.js'
import { removeRetired, writeBlocked } from '../utils/fs-safe.js'

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
      'repaired':           'MCP: repaired (was missing "mcp serve")',
      'already-registered': 'MCP: already configured',
      'skipped':            `MCP: skipped (${mr.status === 'skipped' ? mr.reason : ''})`,
      'failed':             `MCP: failed (${mr.status === 'failed' ? mr.reason : ''})`,
    } as Record<McpResult['status'], string>)[mr.status]
    lines.push(mcp)
  }
  return lines.join('\n')
}

const NEXT_STEPS = [
  '1. Open this project in your AI coding tool',
  '2. Optional, in the Claude Code terminal, for /ponytail-review and /ponytail-audit:',
  '   /plugin marketplace add DietrichGebert/ponytail',
  '   /plugin install ponytail@ponytail',
  '   Other IDEs (Cursor, Windsurf, Kiro, Antigravity, etc.): rules already active',
  '3. Start coding: CLAUDE.md rules are already active',
]

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Bootstrap a project with goodvibes configuration')
    .option('--dry-run', 'Preview files without writing to disk')
    .option('--minimal', "Skip headroom, docs/ and the .github CI files (workflows, scripts, Dependabot, issue and PR templates); Copilot's rules and hooks in .github are still added")
    .option('--scope <scope>', 'global (default): set up Claude Code for every project and install goodvibes globally; project: this folder only', 'global')
    .action(async (options: { dryRun: boolean; minimal: boolean; scope?: string }) => {
      const dryRun = options.dryRun ?? false
      const minimal = options.minimal ?? false
      const scope = (options.scope ?? 'global') as Scope
      if (scope !== 'global' && scope !== 'project') {
        cancel(`Unknown --scope "${options.scope}". Use --scope global (the default) or --scope project.`)
        process.exit(1)
      }
      const cwd = process.cwd()
      // The Claude Code settings folder holds the global manifest; a project setup there would replace it.
      const inConfigDir = samePath(cwd, claudeConfigDir())
      if (inConfigDir && scope === 'project') {
        cancel(`${cwd} is your Claude Code settings folder, not a project.\nRun goodvibes init --scope project inside your project folder.`)
        process.exit(1)
      }
      // Running init from the home folder (or a drive root) sets up global config only, never scatters project files there.
      const inProject = !inConfigDir && !(scope === 'global' && (resolve(cwd) === resolve(homedir()) || resolve(cwd) === parse(resolve(cwd)).root))
      const projectType = detectProjectType(cwd)
      const templateDir = resolveTemplatesDir()

      // Moved before dryRun check — needed for both dry-run and normal paths
      const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
      const selectedVariant = `ci-${projectType}.yml`

      intro('goodvibes init')

      if (!telemetryOptedOut()) { note('Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.', 'Privacy') }

      const existingEntries = readdirSync(cwd).filter(e => e !== '.git' && e !== '.DS_Store')
      if (existingEntries.length > 0) {
        note('Existing files will not be overwritten.', 'Non-empty project detected')
      }

      if (dryRun) {
        if (scope === 'global') {
          const g = await applyGlobalConfig(templateDir, packageVersion(), true, true)
          const cli = await ensureGlobalCli(packageVersion(), true)
          note(formatGlobal(g, cli, undefined), `Dry run — global setup (${g.configDir})`)
        }
        const allFiles = inProject ? (await listTemplateFiles(templateDir)).filter(f => scope === 'project' || !GLOBAL_OWNED(f)) : []
        const files = minimal
          ? allFiles.filter(f => !MINIMAL_SKIPPED(f))
          : allFiles.filter(f => !ciVariants.some((v: string) => f.endsWith(v) && v !== selectedVariant))
            .map(f => f.endsWith(selectedVariant) ? f.slice(0, -selectedVariant.length) + 'ci.yml' : f)
        const cleanup: string[] = []
        if (inProject && scope === 'global') {
          let prev: Manifest | null = null
          try {
            prev = await readManifest(cwd)
          } catch (e) {
            cancel((e as Error).message)
            process.exit(1)
          }
          const { unedited } = await oldSkillCopies(cwd, prev?.files ?? {})
          const why = await writeBlocked(cwd, 'CLAUDE.md')
          try {
            if (why) cleanup.push(`  ${why}`)
            else if (await stripBlock(join(cwd, 'CLAUDE.md'), true)) cleanup.push('  Would remove the old goodvibes rules block from CLAUDE.md')
          } catch (e) {
            if (!(e instanceof MarkerError)) throw e
            cleanup.push(`  ${e.message}`)
          }
          cleanup.push(...unedited.map(r => `  Would remove: ${r}`))
        }
        note([...files.map(f => `  Would write: ${f}`), ...cleanup].join('\n') || '  (no project files: run init inside a project folder)', 'Dry run — no files written')
        const hookLine = inProject ? gitHookLine(await installGitHook(cwd, true), true) : null
        if (hookLine) note(hookLine, 'Git commit check')
        note(
          [...NEXT_STEPS, ...(minimal ? ['4. Run without --minimal to also add CI workflows and docs.'] : [])].join('\n'),
          'Next steps'
        )
        outro('Run without --dry-run to apply these changes.')
        return
      }

      // Read before writing anything: a broken manifest must stop init, not be silently replaced.
      let prevManifest: Manifest | null = null
      if (inProject) {
        try {
          prevManifest = await readManifest(cwd)
        } catch (e) {
          cancel((e as Error).message)
          process.exit(1)
        }
      }

      const telemetryPromise = sendTelemetry()

      const createdFiles: string[] = []
      const skippedFiles: string[] = []
      const problems: string[] = []
      const cleanup: string[] = []
      const removedCopies: string[] = []
      let headroomResult: HeadroomResult | undefined
      let mcpResult: McpResult | undefined
      let globalResult: GlobalResult | undefined
      let cliResult: CliStatus | undefined
      let context7Result: McpStatus | undefined
      let gitHookResult: GitHookResult | undefined

      const taskList: Array<{ title: string; task: (message: (msg: string) => void) => Promise<string> }> = []
      if (scope === 'global') {
        taskList.push({
          title: 'Setting up goodvibes for all your projects',
          task: async () => {
            globalResult = await applyGlobalConfig(templateDir, packageVersion(), false, true)
            context7Result = await registerContext7(false)
            cliResult = await ensureGlobalCli(packageVersion(), false)
            return `Global setup in ${globalResult.configDir}`
          },
        })
      }
      if (inProject) {
        taskList.push({
          title: 'Copying template files',
          task: async () => {
            const { written, skipped, problems: found } = await copyTemplates(templateDir, cwd, false, minimal, projectType, scope)
            createdFiles.push(...written)
            skippedFiles.push(...skipped)
            problems.push(...found)
            gitHookResult = await installGitHook(cwd, false)
            if (scope === 'global') {
              // A project set up in project scope keeps its old rules block and skill copies; Claude would load both versions.
              const { unedited, edited } = await oldSkillCopies(cwd, prevManifest?.files ?? {})
              const why = await writeBlocked(cwd, 'CLAUDE.md')
              try {
                if (why) {
                  if (!skippedFiles.includes(why)) skippedFiles.push(why)
                } else if (await stripBlock(join(cwd, 'CLAUDE.md'))) cleanup.push(STRIPPED)
              } catch (e) {
                if (!(e instanceof MarkerError)) throw e
                problems.push(e.message)
              }
              for (const rel of unedited) await removeRetired(cwd, rel, '.claude/skills')
              removedCopies.push(...unedited)
              cleanup.push(...unedited.map(removedLine), ...(edited.length > 0 ? [EDITED + edited.join(', ')] : []))
            }
            return `Copied ${written.length} files`
          },
        })
      }

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
          'repaired':           'MCP server entry repaired',
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

      const _ver = packageVersion()
      if (inProject) {
        // Earlier entries survive a re-run: files kept this time are still goodvibes', and removed hooks stay removed.
        const blocked = await writeManifest(
          cwd,
          createdFiles.filter(f => f !== '.goodvibes.json'),
          _ver,
          prevManifest ? Object.fromEntries(Object.entries(prevManifest.files).filter(([k]) => !removedCopies.includes(k))) : undefined,
          await managedRecord(cwd, templateDir, prevManifest?.managed),
          scope,
          gitHookResult && hookInPlace(gitHookResult) ? 'installed' : prevManifest?.gitHook,
        )
        if (blocked) skippedFiles.push(blocked)
      }

      await Promise.race([telemetryPromise.catch(() => {}), sleep(1_000)])

      if (globalResult) note(formatGlobal(globalResult, cliResult, context7Result), `Global setup (${globalResult.configDir})`)
      if (inProject) note(createdFiles.join('\n') || '(none)', `Files written (${createdFiles.length})`)
      else note(`No project files written: ${cwd} is your ${inConfigDir ? 'Claude Code settings' : 'home'} folder.\nRun goodvibes init inside a project folder to add JOURNAL.md, CI and IDE rule files.`, 'Project files')
      if (cleanup.length > 0) note(cleanup.join('\n'), 'Old project copies')
      if (skippedFiles.length > 0) {
        note(skippedFiles.join('\n'), `Files skipped (${skippedFiles.length})`)
      }
      const hookLine = gitHookResult && gitHookLine(gitHookResult, false)
      if (hookLine) note(hookLine, 'Git commit check')

      if (problems.length > 0) note(problems.join('\n'), 'Needs your attention')

      if (!minimal && headroomResult) {
        note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')
      }

      note(NEXT_STEPS.join('\n'), 'Next steps')

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
