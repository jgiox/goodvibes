import { describe, it, expect } from 'vitest'
import { managedIds, presentIds, mergeManagedJson, shapeError } from './json-merge.js'

const gate = { matcher: 'Bash', hooks: [{ type: 'command', command: ': goodvibes-journal-gate; exit 0' }] }
const gateV2 = { matcher: 'Bash', hooks: [{ type: 'command', command: ': goodvibes-journal-gate; exit 2' }] }
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

  it('keeps a user-added headers block on context7 while updating its managed fields', () => {
    const user = {
      mcpServers: { context7: { type: 'http', url: 'https://old.example/mcp', headers: { Authorization: 'Bearer ${CONTEXT7_API_KEY}' } } },
    }
    const { merged, changes } = mergeManagedJson('.mcp.json', tplMcp, user)
    expect(merged.mcpServers.context7).toEqual({
      type: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: { Authorization: 'Bearer ${CONTEXT7_API_KEY}' },
    })
    expect(changes).toEqual(['~ mcpServers.context7'])
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
    const doctor = { type: 'command', command: ': goodvibes-doctor; goodvibes doctor --quick', timeout: 10 }
    const doctorV2 = { type: 'command', command: ': goodvibes-doctor; goodvibes doctor --quick', timeout: 20 }
    const mine = { type: 'command', command: 'echo hello' }
    const user = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [doctor, mine] }] } }
    const tpl = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [doctorV2] }] } }
    const { merged } = mergeManagedJson('.claude/settings.json', tpl, user)
    expect(merged.hooks.SessionStart).toEqual([{ matcher: 'startup', hooks: [doctorV2, mine] }])
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
  const guard = (cmd: string, matcher: string) => ({ matcher, hooks: [{ type: 'command', command: `: goodvibes-read-guard; ${cmd}` }] })
  const tpl = { hooks: { PreToolUse: [guard('v2', 'Read|Bash|Grep')] }, permissions: { deny: ['Bash(git push --force *)'] } }

  it('refreshes the matcher of the goodvibes hook group so new tools reach the read guard', () => {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tpl, { hooks: { PreToolUse: [guard('v1', 'Read|Bash')] } })
    expect(merged.hooks.PreToolUse).toEqual([guard('v2', 'Read|Bash|Grep')])
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
    const tpl = { hooks: { PreToolUse: [{ matcher: 'Read|Bash|Grep', hooks: [{ type: 'command', command: ': goodvibes-read-guard; v2' }] }] } }
    const user = { hooks: { PreToolUse: [{ matcher: 'Read|Bash|Edit', hooks: [{ type: 'command', command: './mine.sh' }, { type: 'command', command: ': goodvibes-read-guard; v1' }] }] } }
    const { merged } = mergeManagedJson('.claude/settings.json', tpl, user)
    expect(merged.hooks.PreToolUse[0].matcher).toBe('Read|Bash|Edit')
    expect(merged.hooks.PreToolUse[0].hooks[1].command).toBe(': goodvibes-read-guard; v2')
  })
})
