import { outputFile, pathExists, readFile, writeFile } from 'fs-extra'

const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

export function extractVersion(block: string): string | null {
  const match = block.match(/# goodvibes: v([\d.]+)/)
  return match ? match[1] : null
}

export function versionGte(a: string, b: string): boolean {
  const pa = a.split('.').map(s => parseInt(s, 10))
  const pb = b.split('.').map(s => parseInt(s, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return true
    if (va < vb) return false
  }
  return true // equal
}

function extractSentinelBlock(content: string): string {
  const start = content.indexOf(SENTINEL_START)
  const end = content.indexOf(SENTINEL_END)
  if (start === -1 || end === -1) return ''
  return content.slice(start, end + SENTINEL_END.length)
}

export async function mergeClaude(destPath: string, templateContent: string): Promise<void> {
  const templateBlock = extractSentinelBlock(templateContent)

  if (!(await pathExists(destPath))) {
    // Case A: file absent — write template verbatim
    await outputFile(destPath, templateContent)
    return
  }

  const existing = await readFile(destPath, 'utf-8')
  const startIdx = existing.indexOf(SENTINEL_START)

  if (startIdx === -1) {
    // Case B: file exists, no sentinel — append sentinel block
    await writeFile(destPath, existing.trimEnd() + '\n\n' + templateBlock + '\n')
    return
  }

  const endIdx = existing.indexOf(SENTINEL_END)
  const existingBlock = existing.slice(startIdx, endIdx + SENTINEL_END.length)
  const existingVersion = extractVersion(existingBlock)
  const templateVersion = extractVersion(templateBlock)

  if (existingVersion && templateVersion && versionGte(existingVersion, templateVersion)) {
    // Case D: existing version >= template — skip
    return
  }

  // Case C: replace only the sentinel block, preserve surrounding content
  const before = existing.slice(0, startIdx)
  const after = existing.slice(endIdx + SENTINEL_END.length)
  await writeFile(destPath, before + templateBlock + after)
}
