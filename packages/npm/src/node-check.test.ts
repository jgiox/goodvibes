import { describe, it, expect } from 'vitest'
import { nodeVersionError } from './node-check.js'

describe('nodeVersionError', () => {
  it('explains the requirement and the installed version when Node is 20', () => {
    const msg = nodeVersionError('v20.12.0')
    expect(msg).toContain('goodvibes requires Node.js 22.12 or higher')
    expect(msg).toContain('v20.12.0')
    expect(msg).toContain('https://nodejs.org')
  })

  it('rejects Node 22 releases older than 22.12', () => {
    expect(nodeVersionError('v22.11.0')).not.toBeNull()
  })

  it('returns null for Node 22.12 and newer majors', () => {
    expect(nodeVersionError('v22.12.0')).toBeNull()
    expect(nodeVersionError('v23.0.0')).toBeNull()
    expect(nodeVersionError('v24.1.0')).toBeNull()
  })
})
