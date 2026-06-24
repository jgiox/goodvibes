import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ProjectType = 'node' | 'python' | 'both'

export function detectProjectType(cwd: string): ProjectType {
  const hasNode = existsSync(join(cwd, 'package.json'))
  const hasPython =
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'requirements.txt'))
  if (hasNode && hasPython) return 'both'
  if (hasNode) return 'node'
  if (hasPython) return 'python'
  return 'both' // safe default: install all workflows
}
