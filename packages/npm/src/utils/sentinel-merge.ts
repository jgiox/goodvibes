import { outputFile, pathExists } from 'fs-extra'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { writeBlocked } from './fs-safe.js'

const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'
// A marker counts only alone on its line; the lookahead keeps trailing whitespace and \r out of the match.
const START_LINE = /^<!-- goodvibes:start -->(?=[ \t\r]*$)/gm
const END_LINE = /^<!-- goodvibes:end -->(?=[ \t\r]*$)/gm

const TAG = '(?:alpha|beta|rc|a|b|post|dev)'

export function extractVersion(block: string): string | null {
  const match = block.match(new RegExp(`# goodvibes: v(\\d+(?:\\.\\d+)*(?:[-.]?${TAG}(?:\\.?\\d+)?\\b)?)`))
  return match ? match[1] : null
}

const PHASE: Record<string, number> = { dev: -4, alpha: -3, a: -3, beta: -2, b: -2, rc: -1, post: 1 }

function parseVersion(v: string): number[] | null {
  const m = v.trim().match(new RegExp(`^v?(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?(?:[-.]?(${TAG})(?:\\.?(\\d+))?)?$`, 'i'))
  if (!m) return null
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0), m[4] ? PHASE[m[4].toLowerCase()] : 0, Number(m[5] ?? 0)]
}

// Unparseable input compares as "not newer", so callers never skip an update or install on a bad string.
export function versionGte(a: string, b: string): boolean {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return false
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i]
  }
  return true
}

function extractSentinelBlock(content: string): string {
  const start = content.indexOf(SENTINEL_START)
  const end = content.indexOf(SENTINEL_END)
  if (start === -1 || end === -1) return ''
  return content.slice(start, end + SENTINEL_END.length)
}

export class MarkerError extends Error {}

function markerProblem(starts: number[], ends: number[]): string | null {
  if (starts.length > 1) return `has ${starts.length} ${SENTINEL_START} lines; expected one`
  if (ends.length > 1) return `has ${ends.length} ${SENTINEL_END} lines; expected one`
  if (starts.length === 1 && ends.length === 0) return `has a ${SENTINEL_START} line but no ${SENTINEL_END} line`
  if (ends.length === 1 && starts.length === 0) return `has a ${SENTINEL_END} line but no ${SENTINEL_START} line`
  if (starts.length === 1 && ends[0] < starts[0]) return `has its ${SENTINEL_END} line before its ${SENTINEL_START} line (the end line comes before the start line)`
  return null
}

// Checked here, just before the write: a caller's earlier check can be stale by the time the file is written.
async function refuseLink(destPath: string): Promise<void> {
  if (!(await lstat(dirname(destPath)).catch(() => null))) return // mergeClaude may create the folder; a missing folder is no link
  const why = await writeBlocked(dirname(destPath), basename(destPath))
  if (why) throw new MarkerError(why)
}

// Node's plain utf-8 read turns a bad byte into U+FFFD, which the write would then save over the user's text.
async function readUtf8(destPath: string): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(destPath))
  } catch (e) {
    if (!(e instanceof TypeError)) throw e
    throw new MarkerError(`${destPath} is not UTF-8 text, so goodvibes did not change it; save it as UTF-8 and re-run.`)
  }
}

function markers(destPath: string, existing: string): { starts: number[]; ends: number[] } {
  const starts = [...existing.matchAll(START_LINE)].map(m => m.index)
  const ends = [...existing.matchAll(END_LINE)].map(m => m.index)
  const problem = markerProblem(starts, ends)
  if (problem) {
    throw new MarkerError(
      `${destPath} ${problem}, so goodvibes did not change it; fix CLAUDE.md by hand: keep exactly one ${SENTINEL_START} line ` +
        `followed later by one ${SENTINEL_END} line, or delete both to get a fresh block.`,
    )
  }
  return { starts, ends }
}

// Removes the goodvibes block and keeps the text around it; true when there was a block.
export async function stripBlock(destPath: string, dryRun = false): Promise<boolean> {
  await refuseLink(destPath)
  if (!(await pathExists(destPath))) return false
  const existing = await readUtf8(destPath)
  const { starts, ends } = markers(destPath, existing)
  if (starts.length === 0) return false
  if (!dryRun) {
    const eol = existing.includes('\r\n') ? '\r\n' : '\n'
    const after = existing.slice(ends[0] + SENTINEL_END.length).replace(/^(?:[ \t]*\r?\n)+/, '')
    const parts = [existing.slice(0, starts[0]).trimEnd(), after.trimEnd()].filter(Boolean)
    await writeFile(destPath, parts.join(eol + eol) + (parts.length > 0 ? eol : ''))
  }
  return true
}

// Throws MarkerError without writing when the markers are ambiguous, so no user text is ever cut.
export async function mergeClaude(destPath: string, templateContent: string): Promise<void> {
  const templateBlock = extractSentinelBlock(templateContent)
  await refuseLink(destPath)

  if (!(await pathExists(destPath))) {
    await outputFile(destPath, templateContent)
    return
  }

  const existing = await readUtf8(destPath)
  const eol = existing.includes('\r\n') ? '\r\n' : '\n'
  const block = templateBlock.replace(/\r?\n/g, eol)
  const { starts, ends } = markers(destPath, existing)

  if (starts.length === 0) {
    await writeFile(destPath, existing.trimEnd() + eol + eol + block + eol)
    return
  }

  const startIdx = starts[0]
  const endIdx = ends[0] + SENTINEL_END.length
  const existingVersion = extractVersion(existing.slice(startIdx, endIdx))
  const templateVersion = extractVersion(templateBlock)
  if (existingVersion && templateVersion && versionGte(existingVersion, templateVersion)) return

  await writeFile(destPath, existing.slice(0, startIdx) + block + existing.slice(endIdx))
}
