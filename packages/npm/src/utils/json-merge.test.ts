import { describe, it, expect } from 'vitest'
import { managedIds, presentIds, mergeManagedJson } from './json-merge.js'

const gate = { matcher: 'Bash', hooks: [{ type: 'command', command: ': goodvibes-journal-gate; exit 0' }] }
const gateV2 = { matcher: 'Bash', hooks: [{ type: 'command', command: ': goodvibes-journal-gate; exit 2' }] }
const userHook = { matcher: 'Edit', hooks: [{ type: 'command', command: 'npx prettier --write' }] }
const tplSettings = {
  permissions: { allow: ['Bash(npx*)'], ask: ['Bash(git push*)'], deny: ['Bash(git reset --hard*)'] },
  hooks: { PreToolUse: [gateV2] },
}
const tplMcp = { mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } }

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

describe('mergeManagedJson', () => {
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
