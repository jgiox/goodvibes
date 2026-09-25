import { execa } from 'execa'

export type McpResult =
  | { status: 'registered' }
  | { status: 'repaired' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

const firstLine = (e: unknown) => (e as Error).message?.split('\n')[0] ?? 'unknown'

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
      const { stdout } = await execa('claude', ['mcp', 'get', 'headroom'], { timeout: 10_000 })
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
    let absolutePath: string | undefined
    try {
      const pathResult = await execa(whichCmd, ['headroom'], { timeout: 10_000 })
      // `where` lists every match on Windows; the first is the one PATH resolves.
      absolutePath = pathResult.stdout.split(/\r?\n/).map(l => l.trim()).find(Boolean)
    } catch {
      absolutePath = undefined
    }
    if (!absolutePath) {
      log('headroom binary not found on PATH — MCP registration skipped. Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.')
      return { status: 'skipped', reason: 'headroom binary not found on PATH' }
    }

    if (repair) await execa('claude', ['mcp', 'remove', 'headroom', '-s', 'user'], { timeout: 10_000 })
    await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', '--', absolutePath, 'mcp', 'serve'], { timeout: 10_000 })
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
        await execa('headroom', ['mcp', 'status'], { timeout: 10_000 })
        log('headroom MCP already configured — skipping')
        return { status: 'already-registered' }
      } catch {
        // Non-zero or ENOENT: not registered; `headroom mcp install` below reports a missing binary.
      }
      try {
        await execa('headroom', ['mcp', 'install'], { timeout: 10_000 })
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
