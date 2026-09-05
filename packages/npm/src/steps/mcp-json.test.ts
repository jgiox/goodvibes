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
