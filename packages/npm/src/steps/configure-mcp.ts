import { execa } from 'execa'

export type McpResult =
  | { status: 'registered' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

/**
 * Register headroom as a global MCP server in Claude Code.
 *
 * @param log - Function to emit status messages (enables testing without console side effects)
 *
 * Strategy:
 * 1. Idempotency check: try `headroom mcp status` — if exit 0, already registered, skip
 * 2. Primary (Strategy B): `claude mcp add -s user headroom <absolute-path>`
 *    - Resolves absolute headroom path via `which` (Linux/macOS) or `where` (Windows)
 *    - Handles CLAUDE_CONFIG_DIR correctly (delegates path resolution to claude CLI)
 *    - Checks `claude mcp list` first to avoid duplicate registration
 * 3. Fallback (Strategy A): `headroom mcp install`
 *    - Used when claude CLI is not on PATH
 *    - Logs a warning about CLAUDE_CONFIG_DIR users who may need manual registration
 *
 * Security:
 * - All execa calls pass args as arrays — no shell:true, no string interpolation
 * - Absolute path from which/where is passed as a discrete array element (T-02-03-B)
 * - Never writes to ~/.claude.json or ~/.claude/ directly
 */
export async function configureMcp(log: (msg: string) => void): Promise<McpResult> {
  // Step 1: Idempotency check via headroom mcp status
  try {
    await execa('headroom', ['mcp', 'status'], { timeout: 10_000 })
    // Exit code 0 → already registered
    log('headroom MCP already configured — skipping')
    return { status: 'already-registered' }
  } catch {
    // Non-zero or ENOENT → not registered yet, continue to registration
  }

  // Step 2: Primary strategy — claude mcp add -s user (handles CLAUDE_CONFIG_DIR correctly)
  try {
    // Check if headroom already appears in the mcp list (belt-and-suspenders idempotency)
    const list = await execa('claude', ['mcp', 'list'], { timeout: 10_000 })
    if (list.stdout.includes('headroom')) {
      log('headroom already registered in claude MCP — skipping')
      return { status: 'already-registered' }
    }

    // Resolve absolute path to headroom binary — fails gracefully if headroom not installed
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    let absolutePath: string
    try {
      const pathResult = await execa(whichCmd, ['headroom'], { timeout: 10_000 })
      absolutePath = pathResult.stdout.trim()
    } catch {
      log('headroom binary not found on PATH — MCP registration skipped. Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.')
      return { status: 'skipped', reason: 'headroom binary not found on PATH' }
    }

    // Register with absolute path — MCP clients may not inherit full user PATH
    await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', absolutePath], { timeout: 10_000 })
    log('headroom registered as global MCP server')
    return { status: 'registered' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // claude CLI not on PATH — fall back to headroom mcp install
      log('claude CLI not found — falling back to headroom mcp install')
      log('Warning: if you use CLAUDE_CONFIG_DIR, you may need to run `headroom mcp install` manually')
      try {
        await execa('headroom', ['mcp', 'install'], { timeout: 10_000 })
        return { status: 'registered' }
      } catch (fallbackErr: unknown) {
        if ((fallbackErr as NodeJS.ErrnoException).code === 'ENOENT') {
          log('headroom binary not found — MCP registration skipped. Install headroom and run `headroom mcp install` manually.')
          return { status: 'skipped', reason: 'headroom binary not found' }
        }
        const summary = (fallbackErr as Error).message?.split('\n')[0] ?? 'unknown'
        log(`headroom mcp install failed: ${summary}`)
        return { status: 'failed', reason: summary }
      }
    }
    // Non-ENOENT error from primary strategy (e.g. claude mcp add CalledProcessError)
    const summary = (e as Error).message?.split('\n')[0] ?? 'unknown'
    log(`MCP registration failed: ${summary}`)
    return { status: 'failed', reason: summary }
  }
}
