import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolveTemplatesDir } from './copy-templates.js'

describe('.mcp.json', () => {
  const mcpJson = JSON.parse(readFileSync(join(resolveTemplatesDir(), '.mcp.json'), 'utf-8'))

  it('ships context7 at the free/public HTTP endpoint with no headers block', () => {
    expect(mcpJson.mcpServers.context7.type).toBe('http')
    expect(mcpJson.mcpServers.context7.url).toBe('https://mcp.context7.com/mcp')
    expect(mcpJson.mcpServers.context7.headers).toBeUndefined()
  })
})

describe('context7 for Cursor and VS Code', () => {
  const read = (rel: string) => JSON.parse(readFileSync(join(resolveTemplatesDir(), rel), 'utf-8'))

  it('ships .cursor/mcp.json with only context7 under mcpServers as a url entry', () => {
    expect(read('.cursor/mcp.json')).toEqual({ mcpServers: { context7: { url: 'https://mcp.context7.com/mcp' } } })
  })

  it('ships .vscode/mcp.json with only context7 under servers as an http entry', () => {
    expect(read('.vscode/mcp.json')).toEqual({ servers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' } } })
  })
})
