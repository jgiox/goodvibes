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

const dependabotBlock = (ecosystem: string) =>
  `  - package-ecosystem: "${ecosystem}"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n    cooldown:\n      default-days: 7\n`

// Dependabot fails every week for an ecosystem whose files are missing, so only the ones this project has are added.
export function dependabotYml(template: string, cwd: string): string {
  const has = (f: string) => existsSync(join(cwd, f))
  const ecosystems = [
    ...(has('package.json') ? ['npm'] : []),
    ...(has('uv.lock') ? ['uv'] : has('pyproject.toml') || has('requirements.txt') ? ['pip'] : []),
  ]
  return template + ecosystems.map(dependabotBlock).join('')
}
