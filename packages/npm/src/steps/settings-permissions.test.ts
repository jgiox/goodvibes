import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const ASK_PATTERNS = [
  'Bash(git push*)',
  'Bash(npm publish*)',
  'Bash(npx npm publish*)',
  'Bash(uv publish*)',
  'Bash(twine upload*)',
  'Bash(python -m twine upload*)',
  'Bash(npx wrangler deploy*)',
  'Bash(npx wrangler pages deploy*)',
  'Bash(npx vercel*)',
  'Bash(npx netlify deploy*)',
  'Bash(npx firebase deploy*)',
]

// Publish or deploy forms that match no ASK_PATTERNS prefix; they still prompt if a user adds a broad allow rule (npx*, uv*, npm run*, node*).
const BYPASS_ASK_PATTERNS = [
  'Bash(npx -y *)',
  'Bash(npx --yes *)',
  'Bash(npx wrangler@*)',
  'Bash(npx netlify-cli*)',
  'Bash(npx firebase-tools*)',
  'Bash(uv run twine*)',
  'Bash(uv run python -m twine*)',
  'Bash(npm run deploy*)',
  'Bash(npm run release*)',
  'Bash(npm run publish*)',
  'Bash(node node_modules/.bin/*)',
]

// Each runs arbitrary code, installs unvetted packages, or discards work, bypassing every ask and deny rule.
const REMOVED_ALLOW = [
  'Bash(node*)',
  'Bash(python*)',
  'Bash(npx*)',
  'Bash(uv*)',
  'Bash(npm run*)',
  'Bash(npm install*)',
  'Bash(pip install*)',
  'Bash(git restore *)',
]

const NEW_ASK = [
  'Bash(git restore*)',
  'Bash(git branch -D*)',
  'Bash(git branch --delete*)',
  'Bash(git stash drop*)',
  'Bash(git stash clear*)',
  'Bash(git clean*)',
  'Bash(git push --force-with-lease*)',
]

const NEW_DENY = [
  'Bash(git push --force*)',
  'Bash(git push -f*)',
  'Bash(git push * -f*)',
  'Bash(git push * --force*)',
  'Bash(git push * +*)',
  'Bash(git reset --hard*)',
]

const loadSettings = async () =>
  JSON.parse(await readFile(join(resolveTemplatesDir(), '.claude', 'settings.json'), 'utf-8'))

describe('templates/.claude/settings.json permissions', () => {
  it.each(REMOVED_ALLOW)('does not auto-approve %s', async pattern => {
    expect((await loadSettings()).permissions.allow).not.toContain(pattern)
  })

  it('still runs tests unprompted through npm test, pytest, uv run pytest and python -m pytest', async () => {
    const { allow } = (await loadSettings()).permissions
    for (const p of ['Bash(npm test*)', 'Bash(pytest*)', 'Bash(uv run pytest*)', 'Bash(python -m pytest*)']) {
      expect(allow).toContain(p)
    }
  })

  it('asks before git commands that delete branches, stashes, untracked files or uncommitted work', async () => {
    const { ask } = (await loadSettings()).permissions
    for (const p of NEW_ASK) expect(ask).toContain(p)
  })

  it('denies force pushes written with -f, a flag after the remote, or a + refspec', async () => {
    const { deny } = (await loadSettings()).permissions
    for (const p of NEW_DENY) expect(deny).toContain(p)
  })

  it('requires explicit ask approval for push, publish, and deploy commands', async () => {
    const templateDir = resolveTemplatesDir()
    const raw = await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8')
    const settings = JSON.parse(raw)

    expect(Array.isArray(settings.permissions.ask)).toBe(true)
    for (const pattern of ASK_PATTERNS) {
      expect(settings.permissions.ask).toContain(pattern)
    }
  })

  it('asks before publish or deploy forms that slip past the prefix rules via npx -y, uv run, npm run scripts, or pinned versions', async () => {
    const templateDir = resolveTemplatesDir()
    const settings = JSON.parse(await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8'))
    for (const pattern of BYPASS_ASK_PATTERNS) {
      expect(settings.permissions.ask).toContain(pattern)
    }
  })

  it('leaves permissions.allow, permissions.deny, and hooks.PreToolUse in place', async () => {
    const templateDir = resolveTemplatesDir()
    const raw = await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8')
    const settings = JSON.parse(raw)

    expect(Array.isArray(settings.permissions.allow)).toBe(true)
    expect(settings.permissions.allow.length).toBeGreaterThan(0)
    expect(Array.isArray(settings.permissions.deny)).toBe(true)
    expect(settings.permissions.deny.length).toBeGreaterThan(0)
    expect(Array.isArray(settings.hooks.PreToolUse)).toBe(true)
    expect(settings.hooks.PreToolUse.length).toBeGreaterThan(0)
  })
})

const SECRET_READ_DENY = [
  'Read(./.env)',
  'Read(./.env.local)',
  'Read(./.env.production)',
  'Read(**/.env)',
  'Read(~/.ssh/**)',
  'Read(~/.aws/credentials)',
  'Read(~/.git-credentials)',
  'Read(~/.netrc)',
  'Read(**/*.pem)',
  'Read(**/id_rsa)',
  'Read(**/id_ed25519)',
]

// Gitignore-style: `**/` spans folders, `*` stays inside one path segment.
const matches = (rule: string, path: string) => {
  const glob = rule.slice('Read('.length, -1).replace(/^\.\//, '')
  const re = glob
    .split('**/')
    .map(s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('(.*/)?')
  return new RegExp(`^${re}$`).test(path)
}

describe('secret files', () => {
  it('denies reading .env files, SSH keys, cloud credentials and private keys', async () => {
    const { deny } = (await loadSettings()).permissions
    for (const p of SECRET_READ_DENY) expect(deny).toContain(p)
  })

  it('leaves .env.example readable at the root and in subfolders', async () => {
    const reads = ((await loadSettings()).permissions.deny as string[]).filter(p => p.startsWith('Read('))
    expect(reads.length).toBeGreaterThan(0)
    for (const path of ['.env.example', 'app/.env.example']) {
      expect(reads.filter(r => matches(r, path))).toEqual([])
    }
    expect(matches('Read(./.env.*)', '.env.example')).toBe(true)
  })
})

describe('guard rails', () => {
  const GUARD_ASK = ['Edit(./.claude/settings.json)', 'Edit(./.claude/settings.local.json)', 'Edit(./.mcp.json)', 'Edit(./.cursor/mcp.json)', 'Edit(./.vscode/mcp.json)', 'Edit(./.claude/hooks/**)', 'Edit(./.codex/hooks.json)', 'Edit(./.gemini/settings.json)', 'Edit(./.github/hooks/**)', 'Edit(./.windsurf/hooks.json)', 'Edit(./.kiro/hooks/**)', 'Edit(./.devin/hooks.v1.json)']

  it('asks before the agent edits its own settings, MCP servers or hooks', async () => {
    const { ask } = (await loadSettings()).permissions
    for (const p of GUARD_ASK) expect(ask).toContain(p)
  })

  it('never asks before editing CLAUDE.md or JOURNAL.md, which the rules tell the agent to edit', async () => {
    const { ask } = (await loadSettings()).permissions
    expect((ask as string[]).filter(p => /CLAUDE\.md|JOURNAL\.md/.test(p))).toEqual([])
  })
})
