import { execa } from 'execa'
import { posix, win32 } from 'node:path'
import { EXEC_ENV } from '../utils/exec-env.js'

export type McpResult =
  | { status: 'registered' }
  | { status: 'repaired' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

const firstLine = (e: unknown) => (e as Error).message?.split('\n')[0] ?? 'unknown'
const opts = { timeout: 10_000, env: EXEC_ENV }

// A cloned repo could ship its own headroom; a user-scope MCP server runs in every project, so never register one from inside this one.
const insideProject = (p: string) => {
  const path = process.platform === 'win32' ? win32 : posix
  const rel = path.relative(process.cwd(), p)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Register headroom (`headroom mcp serve`) as a user-scope MCP server in Claude Code.
 *
 * 1. `claude mcp get headroom`: registered with `mcp serve` → done; registered without it
 *    (older goodvibes added only the binary path) → remove and add again ("repaired").
 * 2. `claude mcp add -s user headroom -- <absolute path> mcp serve`; the absolute path comes from
 *    `which`/`where` because MCP clients may not inherit the user's PATH.
 * 3. No claude CLI: fall back to `headroom mcp status` / `headroom mcp install`.
 *
 * All execa calls pass args as arrays (no shell), and nothing here writes ~/.claude.json directly.
 */
export async function configureMcp(log: (msg: string) => void): Promise<McpResult> {
  let repair = false
  try {
    try {
      const { stdout } = await execa('claude', ['mcp', 'get', 'headroom'], opts)
      if (stdout.includes('mcp serve')) {
        log('headroom MCP already configured — skipping')
        return { status: 'already-registered' }
      }
      repair = true
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw e
      // Non-zero exit: headroom is not registered yet.
    }

    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    let found: string[] = []
    try {
      const pathResult = await execa(whichCmd, ['headroom'], opts)
      // `where` lists every match on Windows, starting with the current folder; the first one outside the project is the one PATH resolves.
      found = pathResult.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    } catch {
      found = []
    }
    const absolutePath = found.find(p => !insideProject(p))
    if (!absolutePath && found.length > 0) {
      log('headroom was found only inside this project folder, where a cloned repo could plant it, so it was not registered as an MCP server. Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.')
      return { status: 'skipped', reason: 'headroom found only inside the project folder' }
    }
    if (!absolutePath) {
      log('headroom binary not found on PATH — MCP registration skipped. Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.')
      return { status: 'skipped', reason: 'headroom binary not found on PATH' }
    }

    if (repair) await execa('claude', ['mcp', 'remove', 'headroom', '-s', 'user'], opts)
    await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', '--', absolutePath, 'mcp', 'serve'], opts)
    if (repair) {
      log('headroom MCP entry was missing "mcp serve" — repaired')
      return { status: 'repaired' }
    }
    log('headroom registered as global MCP server')
    return { status: 'registered' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      log('claude CLI not found — falling back to headroom mcp install')
      log('Warning: if you use CLAUDE_CONFIG_DIR, you may need to run `headroom mcp install` manually')
      try {
        await execa('headroom', ['mcp', 'status'], opts)
        log('headroom MCP already configured — skipping')
        return { status: 'already-registered' }
      } catch {
        // Non-zero or ENOENT: not registered; `headroom mcp install` below reports a missing binary.
      }
      try {
        await execa('headroom', ['mcp', 'install'], opts)
        return { status: 'registered' }
      } catch (fallbackErr: unknown) {
        if ((fallbackErr as NodeJS.ErrnoException).code === 'ENOENT') {
          log('headroom binary not found — MCP registration skipped. Install headroom and run `headroom mcp install` manually.')
          return { status: 'skipped', reason: 'headroom binary not found' }
        }
        log(`headroom mcp install failed: ${firstLine(fallbackErr)}`)
        return { status: 'failed', reason: firstLine(fallbackErr) }
      }
    }
    log(`MCP registration failed: ${firstLine(e)}`)
    return { status: 'failed', reason: firstLine(e) }
  }
}
