import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { managedIds, presentIds, mergeManagedJson, shapeError } from './json-merge.js'

const repoJson = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../${rel}`, import.meta.url)), 'utf-8'))
const settingsNow = repoJson('templates/.claude/settings.json')
const settingsOld = repoJson('tests/shipped/settings-1.10.0.json')
const groupOf = (c: Record<string, any>, id: string, event = 'PreToolUse') => c.hooks[event].find((g: Record<string, any>) => g.hooks[0].command.startsWith(`: ${id};`))
// Real hooks: only a value goodvibes shipped counts as its own, so made-up ones would be kept as the user's.
const gate = groupOf(settingsOld, 'goodvibes-journal-gate')
const gateV2 = groupOf(settingsNow, 'goodvibes-journal-gate')
const userHook = { matcher: 'Edit', hooks: [{ type: 'command', command: 'npx prettier --write' }] }
const tplSettings = {
  permissions: { allow: ['Bash(npx*)'], ask: ['Bash(git push*)'], deny: ['Bash(git reset --hard*)'] },
  hooks: { PreToolUse: [gateV2] },
}
const tplMcp = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }
const tplCursor = { mcpServers: { context7: { url: 'https://mcp.context7.com/mcp' } } }
const tplVscode = { servers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }

describe('managedIds', () => {
  it('lists ask, deny and marked hook ids but never allow rules', () => {
    expect(managedIds('.claude/settings.json', tplSettings)).toEqual([
      'ask:Bash(git push*)',
      'deny:Bash(git reset --hard*)',
      'hook:PreToolUse:goodvibes-journal-gate',
    ])
  })

  it('lists one id per template MCP server', () => {
    expect(managedIds('.mcp.json', tplMcp)).toEqual(['mcp:context7'])
  })

  it('lists context7 for the Cursor and VS Code MCP files', () => {
    expect(managedIds('.cursor/mcp.json', tplCursor)).toEqual(['mcp:context7'])
    expect(managedIds('.vscode/mcp.json', tplVscode)).toEqual(['mcp:context7'])
  })
})

describe('presentIds', () => {
  it('returns only the managed ids found in the content', () => {
    const content = { permissions: { deny: ['Bash(git reset --hard*)'] }, hooks: { PreToolUse: [gate] } }
    expect(presentIds('.claude/settings.json', tplSettings, content)).toEqual([
      'deny:Bash(git reset --hard*)',
      'hook:PreToolUse:goodvibes-journal-gate',
    ])
  })
})

describe('presentIds for editor MCP files', () => {
  it('finds context7 under servers in .vscode/mcp.json', () => {
    expect(presentIds('.vscode/mcp.json', tplVscode, { servers: { context7: {} } })).toEqual(['mcp:context7'])
    expect(presentIds('.vscode/mcp.json', tplVscode, { mcpServers: { context7: {} } })).toEqual([])
  })
})

describe('mergeManagedJson', () => {
  it('adds context7 under servers in .vscode/mcp.json and keeps the user servers and inputs', () => {
    const user = { inputs: [{ id: 'token' }], servers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' } } }
    const { merged, changes } = mergeManagedJson('.vscode/mcp.json', tplVscode, user)
    expect(merged).toEqual({ inputs: user.inputs, servers: { ...user.servers, context7: tplVscode.servers.context7 } })
    expect(changes).toEqual(['+ servers.context7'])
  })

  it('adds context7 under mcpServers in .cursor/mcp.json and keeps the user servers', () => {
    const user = { mcpServers: { postgres: { command: 'pg-mcp' } } }
    const { merged, changes } = mergeManagedJson('.cursor/mcp.json', tplCursor, user)
    expect(merged.mcpServers).toEqual({ postgres: { command: 'pg-mcp' }, context7: tplCursor.mcpServers.context7 })
    expect(changes).toEqual(['+ mcpServers.context7'])
  })

  it('does not re-add context7 to .vscode/mcp.json after the user removed it', () => {
    const { merged, changes } = mergeManagedJson('.vscode/mcp.json', tplVscode, { servers: {} }, ['mcp:context7'])
    expect(merged).toEqual({ servers: {} })
    expect(changes).toEqual([])
  })

  it('adds missing managed keys and keeps every user key untouched', () => {
    const user = { permissions: { allow: ['Bash(make*)'], deny: ['Bash(rm -rf*)'] }, hooks: { PostToolUse: [userHook] }, model: 'x' }
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tplSettings, user)
    expect(merged.permissions.allow).toEqual(['Bash(make*)'])
    expect(merged.permissions.deny).toEqual(['Bash(rm -rf*)', 'Bash(git reset --hard*)'])
    expect(merged.permissions.ask).toEqual(['Bash(git push*)'])
    expect(merged.hooks.PostToolUse).toEqual([userHook])
    expect(merged.hooks.PreToolUse).toEqual([gateV2])
    expect(merged.model).toBe('x')
    expect(changes).toEqual([
      '+ permissions.ask: Bash(git push*)',
      '+ permissions.deny: Bash(git reset --hard*)',
      '+ hooks.PreToolUse: goodvibes-journal-gate',
    ])
  })

  it('never adds template allow rules to a user file', () => {
    const { merged } = mergeManagedJson('.claude/settings.json', tplSettings, {})
    expect(merged.permissions.allow).toBeUndefined()
  })

  it('replaces an outdated goodvibes hook in place and leaves the user hook in the same event', () => {
    const user = { hooks: { PreToolUse: [userHook, gate] } }
    const { merged, changes } = mergeManagedJson('.claude/settings.json', { hooks: { PreToolUse: [gateV2] } }, user)
    expect(merged.hooks.PreToolUse).toEqual([userHook, gateV2])
    expect(changes).toEqual(['~ hooks.PreToolUse: goodvibes-journal-gate'])
  })

  it('does not re-add a managed key the user removed after goodvibes installed it', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tplSettings, { permissions: {} }, [
      'ask:Bash(git push*)',
      'hook:PreToolUse:goodvibes-journal-gate',
    ])
    expect(merged.permissions.ask).toBeUndefined()
    expect(merged.hooks).toBeUndefined()
    expect(changes).toEqual(['+ permissions.deny: Bash(git reset --hard*)'])
  })

  it('adds context7 and keeps other MCP servers', () => {
    const user = { mcpServers: { postgres: { command: 'pg-mcp' } } }
    const { merged, changes } = mergeManagedJson('.mcp.json', tplMcp, user)
    expect(merged.mcpServers.postgres).toEqual({ command: 'pg-mcp' })
    expect(merged.mcpServers.context7).toEqual(tplMcp.mcpServers.context7)
    expect(changes).toEqual(['+ mcpServers.context7'])
  })

  it("keeps a context7 entry with the user's own url and headers as it is", () => {
    const user = {
      mcpServers: { context7: { type: 'http', url: 'https://old.example/mcp', headers: { Authorization: 'Bearer ${CONTEXT7_API_KEY}' } } },
    }
    const { merged, changes } = mergeManagedJson('.mcp.json', tplMcp, structuredClone(user))
    expect(merged).toEqual(user)
    expect(changes).toEqual([])
  })

  it('reports no changes when every managed key is already current', () => {
    const { changes } = mergeManagedJson('.mcp.json', tplMcp, structuredClone(tplMcp))
    expect(changes).toEqual([])
  })

  it('keeps a user hook added inside the journal-gate group and replaces only the goodvibes hook', () => {
    const mine = { type: 'command', command: 'echo mine' }
    const user = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [mine, gate.hooks[0]], note: 'x' }] } }
    const { merged, changes } = mergeManagedJson('.claude/settings.json', { hooks: { PreToolUse: [gateV2] } }, user)
    expect(merged.hooks.PreToolUse).toEqual([{ matcher: 'Bash', hooks: [mine, gateV2.hooks[0]], note: 'x' }])
    expect(changes).toEqual(['~ hooks.PreToolUse: goodvibes-journal-gate'])
  })

  it('keeps a user hook added next to the goodvibes-doctor hook in the SessionStart group', () => {
    const doctor = groupOf(settingsNow, 'goodvibes-doctor', 'SessionStart')
    const mine = { type: 'command', command: 'echo hello' }
    const user = { hooks: { SessionStart: [{ ...doctor, hooks: [...doctor.hooks, mine] }] } }
    const tpl = { hooks: { SessionStart: [doctor] } }
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tpl, structuredClone(user))
    expect(merged.hooks.SessionStart).toEqual(user.hooks.SessionStart)
    expect(changes).toEqual([])
  })
})

describe('retiring allow rules older goodvibes versions shipped', () => {
  const retired = ['Bash(npm install*)', 'Bash(npm run*)', 'Bash(npx*)', 'Bash(pip install*)', 'Bash(uv*)', 'Bash(python*)', 'Bash(node*)', 'Bash(git restore *)']
  const user = { permissions: { allow: ['Read(**)', ...retired, 'Bash(make test*)'] } }

  it('removes every allow rule that auto-approved arbitrary code from a project settings file and keeps the user own rules', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', {}, user, [], true)
    expect(merged.permissions.allow).toEqual(['Read(**)', 'Bash(make test*)'])
    for (const r of retired) expect(changes).toContain(`- permissions.allow: ${r}`)
  })

  it('leaves allow rules alone when not retiring (the user-level settings file, where goodvibes never wrote allow rules)', () => {
    const { merged } = mergeManagedJson('.claude/settings.json', {}, user)
    expect(merged.permissions.allow).toEqual(user.permissions.allow)
  })
})

describe('shapeError', () => {
  it('returns null for well-formed settings and MCP files, and for files without those keys', () => {
    expect(shapeError('.claude/settings.json', tplSettings)).toBeNull()
    expect(shapeError('.claude/settings.json', {})).toBeNull()
    expect(shapeError('.cursor/mcp.json', tplCursor)).toBeNull()
    expect(shapeError('.vscode/mcp.json', {})).toBeNull()
    expect(shapeError('.claude/settings.json', { hooks: null, permissions: { deny: null } })).toBeNull()
    expect(shapeError('.claude/settings.json', { hooks: { PreToolUse: [null] } })).toBeNull()
  })

  it('names the first container whose type the merge cannot use', () => {
    expect(shapeError('.mcp.json', { mcpServers: [] })).toBe('"mcpServers" is not a JSON object')
    expect(shapeError('.vscode/mcp.json', { servers: { context7: 'x' } })).toBe('"servers.context7" is not a JSON object')
    expect(shapeError('.claude/settings.json', { permissions: { ask: 'Bash(git push*)' } })).toBe('"permissions.ask" is not a JSON array')
    expect(shapeError('.claude/settings.json', { hooks: { PreToolUse: {} } })).toBe('"hooks.PreToolUse" is not a JSON array')
    expect(shapeError('.claude/settings.json', { hooks: { PreToolUse: ['x'] } })).toBe('"hooks.PreToolUse[0]" is not a JSON object')
    expect(shapeError('.claude/settings.json', { hooks: { PreToolUse: [{ hooks: {} }] } })).toBe('"hooks.PreToolUse[0].hooks" is not a JSON array')
  })
})

describe('mergeManagedJson with null containers and empty entries', () => {
  it('treats null hooks and permissions as absent and creates them', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tplSettings, { hooks: null, permissions: null, model: 'x' })
    expect(merged).toEqual({ hooks: { PreToolUse: [gateV2] }, permissions: { ask: ['Bash(git push*)'], deny: ['Bash(git reset --hard*)'] }, model: 'x' })
    expect(changes).toHaveLength(3)
  })

  it('treats null mcpServers and servers as absent and adds context7', () => {
    expect(mergeManagedJson('.mcp.json', tplMcp, { mcpServers: null }).merged).toEqual(tplMcp)
    expect(mergeManagedJson('.cursor/mcp.json', tplCursor, { mcpServers: null }).merged).toEqual(tplCursor)
    expect(mergeManagedJson('.vscode/mcp.json', tplVscode, { servers: null }).merged).toEqual(tplVscode)
  })

  it('fills an empty context7 entry with the template fields even when it was installed', () => {
    const { merged, changes } = mergeManagedJson('.mcp.json', tplMcp, { mcpServers: { context7: {} } }, ['mcp:context7'])
    expect(merged).toEqual(tplMcp)
    expect(changes).toEqual(['~ mcpServers.context7'])
  })
})

describe('refreshing goodvibes hook groups and retired deny rules', () => {
  const tpl = { hooks: { PreToolUse: [groupOf(settingsNow, 'goodvibes-read-guard')] }, permissions: { deny: ['Bash(git push --force *)'] } }

  it('refreshes the matcher of the goodvibes hook group so new tools reach the read guard', () => {
    const old = structuredClone(groupOf(settingsOld, 'goodvibes-read-guard'))
    expect(old.matcher).toBe('Read|Bash')
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tpl, { hooks: { PreToolUse: [old] } })
    expect(merged.hooks.PreToolUse).toEqual([groupOf(settingsNow, 'goodvibes-read-guard')])
    expect(changes).toContain('~ hooks.PreToolUse: goodvibes-read-guard')
  })

  it('removes the old force-push deny rules goodvibes installed, so --force-with-lease reaches the ask rule', () => {
    const user = { permissions: { deny: ['Bash(git push --force*)', 'Bash(git push * --force*)', 'Bash(rm -rf /*)'] } }
    const installed = ['deny:Bash(git push --force*)', 'deny:Bash(git push * --force*)']
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tpl, user, installed)
    expect(merged.permissions.deny).toEqual(['Bash(rm -rf /*)', 'Bash(git push --force *)'])
    expect(changes).toContain('- permissions.deny: Bash(git push --force*)')
  })

  it('keeps an old force-push deny rule the user added themselves', () => {
    const { merged } = mergeManagedJson('.claude/settings.json', tpl, { permissions: { deny: ['Bash(git push --force*)'] } })
    expect(merged.permissions.deny).toContain('Bash(git push --force*)')
  })
})

describe('matcher refresh in a shared group', () => {
  it('keeps the matcher of a group where the user added their own hooks next to the goodvibes hook', () => {
    const now = groupOf(settingsNow, 'goodvibes-read-guard')
    const tpl = { hooks: { PreToolUse: [now] } }
    const v1 = structuredClone(groupOf(settingsOld, 'goodvibes-read-guard').hooks[0])
    const user = { hooks: { PreToolUse: [{ matcher: 'Read|Bash|Edit', hooks: [{ type: 'command', command: './mine.sh' }, v1] }] } }
    const { merged } = mergeManagedJson('.claude/settings.json', tpl, user)
    expect(merged.hooks.PreToolUse[0].matcher).toBe('Read|Bash|Edit')
    expect(merged.hooks.PreToolUse[0].hooks[1]).toEqual(now.hooks[0])
  })
})

describe("a user's allow rule beats goodvibes' ask rule", () => {
  const tplGit = {
    permissions: {
      allow: ['Bash(git branch*)'],
      ask: ['Bash(git push*)', 'Bash(git branch -D*)'],
      deny: ['Bash(git push --force *)'],
    },
  }

  it('covers an ask rule when the allow rule matches every command the ask rule matches', async () => {
    const { covers } = await import('./json-merge.js')
    expect(covers('Bash(git push*)', 'Bash(git push*)')).toBe(true)
    expect(covers('Bash(git push:*)', 'Bash(git push --force-with-lease*)')).toBe(true)
    expect(covers('Bash(git push *)', 'Bash(git push*)')).toBe(true)
    expect(covers('Bash', 'Bash(git branch -D*)')).toBe(true)
    expect(covers('Bash(*)', 'Bash(git branch -D*)')).toBe(true)
    expect(covers('Edit(./.mcp.json)', 'Edit(./.mcp.json)')).toBe(true)
  })

  it('does not cover an ask rule that matches more commands than the allow rule', async () => {
    const { covers } = await import('./json-merge.js')
    expect(covers('Bash(git push origin*)', 'Bash(git push*)')).toBe(false)
    expect(covers('Bash(git branch -D old)', 'Bash(git branch -D*)')).toBe(false)
    expect(covers('Bash(git push * main)', 'Bash(git push*)')).toBe(false)
    expect(covers('Read(**)', 'Edit(./.mcp.json)')).toBe(false)
    expect(covers('Edit(**/*.yml)', 'Edit(./.mcp.json)')).toBe(false)
  })

  it('reports rules as overlapping when some command matches both', async () => {
    const { overlaps } = await import('./json-merge.js')
    expect(overlaps('Bash(git push origin*)', 'Bash(git push*)')).toBe(true)
    expect(overlaps('Bash(git branch -D old)', 'Bash(git branch -D*)')).toBe(true)
    expect(overlaps('Bash(git push * main)', 'Bash(git push*)')).toBe(true)
    expect(overlaps('Bash(git status*)', 'Bash(git push*)')).toBe(false)
    expect(overlaps('Bash(npm test*)', 'Bash(npm publish*)')).toBe(false)
    expect(overlaps('Bash(git push origin main)', 'Bash(git push --force-with-lease*)')).toBe(false)
  })

  it('leaves out allow rules goodvibes ships or used to ship when listing the user allow rules', async () => {
    const { userAllowRules } = await import('./json-merge.js')
    expect(userAllowRules({ permissions: { allow: ['Bash(git branch*)', 'Bash(npx*)', 'Bash(git push*)', 7] } }, tplGit)).toEqual(['Bash(git push*)'])
    expect(userAllowRules({ permissions: null }, tplGit)).toEqual([])
  })

  it('does not add an ask rule that a user allow rule covers', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tplGit, { permissions: { allow: ['Bash(git push:*)'] } }, [])
    expect((merged.permissions as { ask: string[] }).ask).toEqual(['Bash(git branch -D*)'])
    expect(changes).not.toContain('+ permissions.ask: Bash(git push*)')
  })

  it('removes an ask rule goodvibes installed once a user allow rule covers it', () => {
    const user = { permissions: { allow: ['Bash(git branch -D*)'], ask: ['Bash(git push*)', 'Bash(git branch -D*)'] } }
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tplGit, user, ['ask:Bash(git push*)', 'ask:Bash(git branch -D*)'])
    expect((merged.permissions as { ask: string[] }).ask).toEqual(['Bash(git push*)'])
    expect(changes).toContain('- permissions.ask: Bash(git branch -D*) (your allow rule Bash(git branch -D*) covers it)')
  })

  it('keeps an ask rule the user wrote even when their allow rule covers it', () => {
    const user = { permissions: { allow: ['Bash(git push*)'], ask: ['Bash(git push*)'] } }
    const { merged } = mergeManagedJson('.claude/settings.json', tplGit, user, [])
    expect((merged.permissions as { ask: string[] }).ask).toContain('Bash(git push*)')
  })

  it("never counts goodvibes' own allow rules as the user's", () => {
    const { merged } = mergeManagedJson('.claude/settings.json', tplGit, { permissions: { allow: ['Bash(git branch*)', 'Bash(npx*)'] } }, [])
    expect((merged.permissions as { ask: string[] }).ask).toEqual(['Bash(git push*)', 'Bash(git branch -D*)'])
  })

  it('yields to allow rules from other settings files', () => {
    const { merged } = mergeManagedJson('.claude/settings.json', tplGit, {}, [], false, ['Bash(git push*)'])
    expect((merged.permissions as { ask: string[] }).ask).toEqual(['Bash(git branch -D*)'])
  })

  it('never drops a deny rule for an allow rule', () => {
    const { merged } = mergeManagedJson('.claude/settings.json', tplGit, { permissions: { allow: ['Bash(git push --force *)'] } }, [])
    expect((merged.permissions as { deny: string[] }).deny).toEqual(['Bash(git push --force *)'])
  })

  it('names the goodvibes rule that still beats each allow rule', async () => {
    const { overriddenLines } = await import('./json-merge.js')
    const content = { permissions: { ask: ['Bash(git push*)', 'Bash(my own*)'], deny: ['Bash(git push --force *)'] } }
    const allows = ['Bash(git push origin main)', 'Bash(git push --force origin x)', 'Bash(my own thing)', 'Bash(make*)']
    expect(overriddenLines('.claude/settings.json', allows, content, tplGit)).toEqual([
      '.claude/settings.json: Claude Code still asks before commands your allow rule Bash(git push origin main) matches, ' +
        "because goodvibes' ask rule Bash(git push*) is checked first. To change that, delete Bash(git push*) from " +
        '.claude/settings.json; goodvibes will not add it back.',
      '.claude/settings.json: Claude Code still refuses commands your allow rule Bash(git push --force origin x) matches, ' +
        "because goodvibes' deny rule Bash(git push --force *) is checked first. To change that, delete Bash(git push --force *) from " +
        '.claude/settings.json; goodvibes will not add it back.',
    ])
  })

  it('says nothing about a deny rule that a broader allow rule merely includes', async () => {
    const { overriddenLines } = await import('./json-merge.js')
    const content = { permissions: { deny: ['Bash(git push --force *)'] } }
    expect(overriddenLines('.claude/settings.json', ['Bash(git push:*)'], content, tplGit)).toEqual([])
    expect(overriddenLines('.claude/settings.json', ['Bash(git push --force *)'], content, tplGit)).toHaveLength(1)
  })

  it('covers the paths a path rule with wildcards matches', async () => {
    const { covers } = await import('./json-merge.js')
    expect(covers('Edit(./.claude/**)', 'Edit(./.claude/settings.json)')).toBe(true)
    expect(covers('Edit(./.claude/**)', 'Edit(./.claude/hooks/**)')).toBe(true)
    expect(covers('Edit(./.claude/*.json)', 'Edit(./.claude/settings.local.json)')).toBe(true)
    expect(covers('Edit(./.claude/*)', 'Edit(./.claude/hooks/**)')).toBe(false)
    expect(covers('Edit(./.github/**)', 'Edit(./.claude/settings.json)')).toBe(false)
  })

  it('reports a path rule as overlapping a wildcard path rule that matches it', async () => {
    const { overlaps } = await import('./json-merge.js')
    expect(overlaps('Edit(./.claude/hooks/pre.sh)', 'Edit(./.claude/hooks/**)')).toBe(true)
    expect(overlaps('Edit(./.claude/**)', 'Edit(./.claude/hooks/**)')).toBe(true)
    expect(overlaps('Edit(./src/**)', 'Edit(./.claude/hooks/**)')).toBe(false)
  })
})

describe('hooks and MCP entries the user edited are kept', () => {
  const repo = (rel: string) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url))
  const realSettings = JSON.parse(readFileSync(repo('templates/.claude/settings.json'), 'utf-8'))
  const realMcp = JSON.parse(readFileSync(repo('templates/.mcp.json'), 'utf-8'))
  const settings1100 = JSON.parse(readFileSync(repo('tests/shipped/settings-1.10.0.json'), 'utf-8'))
  const gate = (c: Record<string, any>) => c.hooks.PreToolUse.find((g: Record<string, any>) => g.hooks[0].command.includes('goodvibes-journal-gate'))

  it('digests an entry as the sha256 of compact JSON with sorted keys', async () => {
    const { entryDigest } = await import('./json-merge.js')
    expect(entryDigest({ b: 1, a: 'é' })).toBe(createHash('sha256').update('{"a":"é","b":1}', 'utf8').digest('hex'))
  })

  it('lists every hook, matcher and server goodvibes ships, the same way as the pip CLI', async () => {
    const { SHIPPED_ENTRIES, entryDigest } = await import('./json-merge.js')
    for (const rel of ['.claude/settings.json', '.gemini/settings.json', '.codex/hooks.json']) {
      const tpl = JSON.parse(readFileSync(repo(`templates/${rel}`), 'utf-8'))
      for (const groups of Object.values<Record<string, any>[]>(tpl.hooks)) {
        for (const g of groups) {
          const h = g.hooks[0]
          const hid = h.command.split(';')[0].slice(2)
          expect(SHIPPED_ENTRIES.has(entryDigest(h)), `add ${entryDigest(h)} to SHIPPED_ENTRIES in json-merge.ts and json_merge.py`).toBe(true)
          expect(SHIPPED_ENTRIES.has(entryDigest({ hook: hid, matcher: g.matcher ?? null }))).toBe(true)
        }
      }
    }
    for (const [rel, key] of [['.mcp.json', 'mcpServers'], ['.cursor/mcp.json', 'mcpServers'], ['.vscode/mcp.json', 'servers']]) {
      for (const [name, server] of Object.entries(JSON.parse(readFileSync(repo(`templates/${rel}`), 'utf-8'))[key])) {
        expect(SHIPPED_ENTRIES.has(entryDigest({ server: name, value: server }))).toBe(true)
      }
    }
    const pip = readFileSync(repo('packages/pip/src/goodvibes_cli/utils/json_merge.py'), 'utf-8')
    const pipSet = pip.slice(pip.indexOf('SHIPPED_ENTRIES'), pip.indexOf('})', pip.indexOf('SHIPPED_ENTRIES')))
    expect([...pipSet.matchAll(/[0-9a-f]{64}/g)].map(m => m[0]).sort()).toEqual([...SHIPPED_ENTRIES].sort())
  })

  it('keeps a goodvibes hook the user edited', () => {
    const user = structuredClone(realSettings)
    gate(user).hooks[0].command += ' # mine'
    const { merged, changes } = mergeManagedJson('.claude/settings.json', realSettings, user, [])
    expect(gate(merged)).toEqual(gate(user))
    expect(changes.filter(c => c.includes('goodvibes-journal-gate'))).toEqual([])
  })

  it('keeps a goodvibes hook group whose matcher the user changed', () => {
    const user = structuredClone(realSettings)
    gate(user).matcher = 'Bash|Edit'
    const { merged, changes } = mergeManagedJson('.claude/settings.json', realSettings, user, [])
    expect(gate(merged).matcher).toBe('Bash|Edit')
    expect(changes.filter(c => c.includes('goodvibes-journal-gate'))).toEqual([])
  })

  it('refreshes a goodvibes hook an earlier version shipped', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', realSettings, structuredClone(settings1100), [])
    expect(gate(merged)).toEqual(gate(realSettings))
    expect(changes).toContain('~ hooks.PreToolUse: goodvibes-journal-gate')
  })

  it('keeps a context7 entry the user edited', () => {
    const user = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp/mine' } } }
    const { merged, changes } = mergeManagedJson('.mcp.json', realMcp, structuredClone(user), [])
    expect(merged).toEqual(user)
    expect(changes).toEqual([])
  })

  it('names each goodvibes hook and server the user edited', async () => {
    const { keptEntryLines } = await import('./json-merge.js')
    const user = structuredClone(realSettings)
    gate(user).hooks[0].command += ' # mine'
    expect(keptEntryLines('.claude/settings.json', realSettings, user)).toEqual([
      '.claude/settings.json: kept your edited hook goodvibes-journal-gate (PreToolUse); goodvibes did not replace it with its new version',
    ])
    expect(keptEntryLines('.mcp.json', realMcp, { mcpServers: { context7: { url: 'https://example.test/mcp' } } })).toEqual([
      '.mcp.json: kept your edited mcpServers.context7 entry; goodvibes did not replace it with its new version',
    ])
    expect(keptEntryLines('.claude/settings.json', realSettings, settings1100)).toEqual([])
  })
})
