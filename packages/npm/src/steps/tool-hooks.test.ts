import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

// Each tool's hook file must run the exact commands from .claude/settings.json, on that tool's shell and file-read actions.
const tpl = resolveTemplatesDir()
const read = (rel: string) => JSON.parse(readFileSync(join(tpl, rel), 'utf-8'))
const claude = read('.claude/settings.json')
const command = (id: string): string =>
  claude.hooks.PreToolUse.flatMap((g: any) => g.hooks).find((h: any) => h.command.startsWith(`: goodvibes-${id};`)).command
const id = (cmd: string) => cmd.match(/^: goodvibes-([a-z-]+);/)?.[1]

type Route = [event: string, matcher: string, hook: string | undefined]
const nested = (hooks: Record<string, any[]>, field = 'command'): Route[] =>
  Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap(g => g.hooks.map((h: any) => [event, g.matcher, id(h[field])] as Route)))

describe('hook files for other AI tools', () => {
  it('keeps the Claude Code matchers that Cursor and the Copilot CLI map onto their own shell and read tools', () => {
    expect(nested({ PreToolUse: claude.hooks.PreToolUse })).toEqual([
      ['PreToolUse', 'Bash', 'journal-gate'],
      ['PreToolUse', 'Read|Bash', 'read-guard'],
    ])
  })

  it('gives Devin CLI both checks on exec and the read guard on read in .devin/hooks.v1.json, which has no hooks wrapper', () => {
    expect(nested(read('.devin/hooks.v1.json'))).toEqual([
      ['PreToolUse', '^exec$', 'journal-gate'],
      ['PreToolUse', '^(read|exec)$', 'read-guard'],
    ])
  })

  it('gives Codex CLI both checks on its Bash tool in .codex/hooks.json', () => {
    const f = read('.codex/hooks.json')
    expect(Object.keys(f)).toEqual(['hooks'])
    expect(nested(f.hooks)).toEqual([
      ['PreToolUse', 'Bash', 'journal-gate'],
      ['PreToolUse', 'Bash', 'read-guard'],
    ])
  })

  it('gives Gemini CLI both checks on run_shell_command and the read guard on read_file, with anchored matchers', () => {
    expect(nested(read('.gemini/settings.json').hooks)).toEqual([
      ['BeforeTool', '^run_shell_command$', 'journal-gate'],
      ['BeforeTool', '^(run_shell_command|read_file)$', 'read-guard'],
    ])
  })

  it('gives the Copilot cloud agent and VS Code both checks in .github/hooks/goodvibes.json, as bash commands only', () => {
    const f = read('.github/hooks/goodvibes.json')
    expect(f.version).toBe(1)
    expect(nested(f.hooks, 'bash')).toEqual([
      ['PreToolUse', 'Bash', 'journal-gate'],
      ['PreToolUse', 'Read|Bash', 'read-guard'],
    ])
    expect(f.hooks.PreToolUse.flatMap((g: any) => g.hooks).every((h: any) => !('command' in h) && !('powershell' in h))).toBe(true)
  })

  it('gives Windsurf both checks before a command and the read guard before a file read', () => {
    const f = read('.windsurf/hooks.json')
    const routes = Object.entries<any[]>(f.hooks).flatMap(([event, hooks]) => hooks.map(h => [event, id(h.command)]))
    expect(routes).toEqual([
      ['pre_run_command', 'journal-gate'],
      ['pre_run_command', 'read-guard'],
      ['pre_read_code', 'read-guard'],
    ])
  })

  it('gives Kiro both checks on shell and the read guard on read, in .kiro/hooks/goodvibes.json', () => {
    const f = read('.kiro/hooks/goodvibes.json')
    expect(f.version).toBe('v1')
    expect(f.hooks.map((h: any) => [h.trigger, h.matcher, h.action.type, id(h.action.command)])).toEqual([
      ['PreToolUse', 'shell', 'command', 'journal-gate'],
      ['PreToolUse', 'shell', 'command', 'read-guard'],
      ['PreToolUse', 'read', 'command', 'read-guard'],
    ])
  })

  it('runs the exact .claude/settings.json command in every file, so the checks cannot drift apart', () => {
    const all = [
      ...read('.devin/hooks.v1.json').PreToolUse.flatMap((g: any) => g.hooks.map((h: any) => h.command)),
      ...read('.codex/hooks.json').hooks.PreToolUse.flatMap((g: any) => g.hooks.map((h: any) => h.command)),
      ...read('.gemini/settings.json').hooks.BeforeTool.flatMap((g: any) => g.hooks.map((h: any) => h.command)),
      ...read('.github/hooks/goodvibes.json').hooks.PreToolUse.flatMap((g: any) => g.hooks.map((h: any) => h.bash)),
      ...Object.values<any[]>(read('.windsurf/hooks.json').hooks).flatMap(hs => hs.map(h => h.command)),
      ...read('.kiro/hooks/goodvibes.json').hooks.map((h: any) => h.action.command),
    ]
    expect(all.length).toBe(14)
    for (const cmd of all) expect(cmd).toBe(command(id(cmd)!))
  })
})
