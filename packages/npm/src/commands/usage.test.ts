import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Command } from 'commander'
import { findSessions, projectFolderName, registerUsageCommand, summarizeTranscript } from './usage.js'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 8, 25, 12)
const FOOTER = "Claude Code's log format is internal and can change; these numbers are best effort."
const NEAR_LIMIT = '! near the context limit of most Claude models (200k); starting a fresh session is cheaper'

const assistant = (id: string | undefined, usage: Record<string, number> | undefined) =>
  JSON.stringify({ type: 'assistant', message: { ...(id ? { id } : {}), role: 'assistant', content: [{ type: 'text', text: 'SECRET PROMPT TEXT' }], ...(usage ? { usage } : {}) } })

const transcript = [
  JSON.stringify({ type: 'user', message: { role: 'user', content: 'SECRET PROMPT TEXT' } }),
  assistant('msg_1', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 40 }),
  assistant('msg_1', { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 100, cache_creation_input_tokens: 40 }),
  '{ this line is not json',
  assistant('msg_2', { input_tokens: 20, output_tokens: 7, cache_read_input_tokens: 300 }),
  assistant('msg_3', undefined),
  JSON.stringify({ type: 'summary', summary: 'x' }),
].join('\n')

describe('usage', () => {
  let root: string
  let config: string
  let cwd: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gv-usage-'))
    config = join(root, 'config')
    cwd = join(root, 'my.app_1')
    mkdirSync(cwd)
    vi.stubEnv('CLAUDE_CONFIG_DIR', config)
    vi.stubEnv('HOME', join(root, 'home'))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rmSync(root, { recursive: true, force: true })
  })

  const writeSession = (folder: string, id: string, text: string, ageDays = 0) => {
    const dir = join(config, 'projects', folder)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${id}.jsonl`)
    writeFileSync(file, text)
    const t = (NOW - ageDays * DAY) / 1000
    utimesSync(file, t, t)
    return file
  }

  describe('projectFolderName', () => {
    it('replaces every character that is not a letter or digit with a dash', () => {
      expect(projectFolderName('/home/u/my.app_1')).toBe('-home-u-my-app-1')
      expect(projectFolderName('C:\\Users\\me\\proj')).toBe('C--Users-me-proj')
    })
  })

  describe('summarizeTranscript', () => {
    it('dedupes by message id keeping the highest output, skips bad lines and entries without usage', () => {
      expect(summarizeTranscript(transcript)).toEqual({
        input: 30, output: 57, cacheRead: 400, cacheCreation: 40,
        cacheHitRatio: 400 / 470, peakContext: 320,
      })
    })

    it('returns null when no assistant entry carries usage', () => {
      expect(summarizeTranscript([JSON.stringify({ type: 'user', message: {} }), assistant('m', undefined), 'nope'].join('\n'))).toBeNull()
    })

    it('counts entries without a message id separately and reports a zero ratio when nothing was read', () => {
      const text = [assistant(undefined, { output_tokens: 3 }), assistant(undefined, { output_tokens: 4 })].join('\n')
      expect(summarizeTranscript(text)).toEqual({ input: 0, output: 7, cacheRead: 0, cacheCreation: 0, cacheHitRatio: 0, peakContext: 0 })
    })
  })

  describe('findSessions', () => {
    it('reads only the current project by default, newest first, within the day window', () => {
      const folder = projectFolderName(cwd)
      writeSession(folder, 'aaaaaaaa-old', transcript, 1)
      const newest = writeSession(folder, 'bbbbbbbb-new', transcript, 0)
      writeSession(folder, 'cccccccc-too-old', transcript, 8)
      writeSession('-other-project', 'dddddddd', transcript, 0)

      const { sessions, problems, missing } = findSessions({ all: false, days: 7, cwd, now: NOW })

      expect(missing).toBeUndefined()
      expect(problems).toEqual([])
      expect(sessions.map(s => s.id)).toEqual(['bbbbbbbb-new', 'aaaaaaaa-old'])
      expect(sessions[0]).toMatchObject({ file: newest, mtime: new Date(NOW).toISOString(), output: 57, peakContext: 320 })
    })

    it('reads every project with all', () => {
      writeSession(projectFolderName(cwd), 'aaaaaaaa', transcript, 1)
      writeSession('-other-project', 'dddddddd', transcript, 0)
      expect(findSessions({ all: true, days: 7, cwd, now: NOW }).sessions.map(s => s.id)).toEqual(['dddddddd', 'aaaaaaaa'])
    })

    it('says the project folder is missing and suggests --all', () => {
      writeSession('-other-project', 'dddddddd', transcript, 0)
      const { sessions, missing } = findSessions({ all: false, days: 7, cwd, now: NOW })
      expect(sessions).toEqual([])
      expect(missing).toBe(`No Claude Code sessions found for this project (looked in ${join(config, 'projects', projectFolderName(cwd))}). Run goodvibes usage --all to see every project.`)
    })

    it('says no logs exist when the projects folder is missing', () => {
      expect(findSessions({ all: true, days: 7, cwd, now: NOW }).missing)
        .toBe(`No Claude Code session logs found in ${join(config, 'projects')}. They appear after you use Claude Code.`)
    })

    it('reports an unreadable session file by name and keeps the others', () => {
      const folder = projectFolderName(cwd)
      writeSession(folder, 'aaaaaaaa', transcript, 0)
      const bad = join(config, 'projects', folder, 'broken.jsonl')
      mkdirSync(bad)

      const { sessions, problems } = findSessions({ all: false, days: 7, cwd, now: NOW })

      expect(sessions.map(s => s.id)).toEqual(['aaaaaaaa'])
      expect(problems).toEqual([`Skipped ${bad}: could not read it (EISDIR).`])
    })
  })

  describe('registerUsageCommand', () => {
    async function run(...args: string[]) {
      const out: string[] = []
      const err: string[] = []
      vi.spyOn(console, 'log').mockImplementation((m: string) => { out.push(m) })
      vi.spyOn(console, 'error').mockImplementation((m: string) => { err.push(m) })
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      vi.spyOn(process, 'cwd').mockReturnValue(cwd)
      vi.spyOn(Date, 'now').mockReturnValue(NOW)
      const program = new Command()
      registerUsageCommand(program)
      await program.parseAsync(['usage', ...args], { from: 'user' })
      return { out, err, exitSpy }
    }

    it('prints a table with totals, marks sessions near the context limit, and ends with the footer', async () => {
      const folder = projectFolderName(cwd)
      writeSession(folder, 'aaaaaaaa-1111', transcript, 1)
      writeSession(folder, 'bbbbbbbb-2222', assistant('m', { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 150_000, cache_creation_input_tokens: 20_000 }), 0)

      const { out, exitSpy } = await run()
      const local = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

      expect(out).toEqual([
        'Token usage for this project, last 7 days: 2 session(s)',
        '',
        'Date        Session   Total tokens  Cache hit  Peak context',
        `${local(NOW)}  bbbbbbbb       173,000        87%       171,000 !`,
        `${local(NOW - DAY)}  aaaaaaaa           527        85%           320`,
        'Total                      173,527        87%       171,000',
        'Input 1,030, output 2,057, cache read 150,400, cache creation 20,040',
        '',
        NEAR_LIMIT,
        FOOTER,
      ])
      expect(out.join('\n')).not.toContain('SECRET PROMPT TEXT')
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('shows only the 10 most recent sessions but totals every session', async () => {
      for (let i = 0; i < 12; i++) writeSession(projectFolderName(cwd), `s${String(i).padStart(7, '0')}`, assistant('m', { output_tokens: 1 }), i * 0.1)
      const { out } = await run()
      expect(out[0]).toBe('Token usage for this project, last 7 days: 12 session(s), showing the 10 most recent')
      expect(out.filter(l => /^\d{4}-/.test(l))).toHaveLength(10)
      expect(out).toContain('Total                           12         0%             0')
    })

    it('prints machine-readable JSON with every session and the totals', async () => {
      const file = writeSession(projectFolderName(cwd), 'aaaaaaaa-1111', transcript, 0)
      const { out, err } = await run('--json', '--days', '3')
      expect(JSON.parse(out.join('\n'))).toEqual({
        sessions: [{ id: 'aaaaaaaa-1111', file, mtime: new Date(NOW).toISOString(), input: 30, output: 57, cacheRead: 400, cacheCreation: 40, cacheHitRatio: 400 / 470, peakContext: 320 }],
        totals: { input: 30, output: 57, cacheRead: 400, cacheCreation: 40, cacheHitRatio: 400 / 470, peakContext: 320 },
      })
      expect(err).toEqual([FOOTER])
    })

    it('keeps the blank line before the footer when no session is near the context limit', async () => {
      writeSession(projectFolderName(cwd), 'aaaaaaaa', transcript, 0)
      const { out } = await run()
      expect(out.slice(-3)).toEqual(['Input 30, output 57, cache read 400, cache creation 40', '', FOOTER])
    })

    it('reads every project with --all', async () => {
      writeSession('-other-project', 'dddddddd', transcript, 0)
      const { out } = await run('--all')
      expect(out[0]).toBe('Token usage for all projects, last 7 days: 1 session(s)')
    })

    it('explains that no session logs exist yet and exits 0', async () => {
      const { out, exitSpy } = await run()
      expect(out).toEqual([`No Claude Code session logs found in ${join(config, 'projects')}. They appear after you use Claude Code.`, FOOTER])
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('says so when no session falls inside the day window', async () => {
      writeSession(projectFolderName(cwd), 'aaaaaaaa', transcript, 5)
      const { out } = await run('--days', '2')
      expect(out).toEqual(['No Claude Code sessions with token usage in the last 2 day(s).', FOOTER])
    })

    it('rejects a --days value that is not a whole number of 1 or more with exit 1', async () => {
      const { err, exitSpy } = await run('--days', 'soon')
      expect(err).toEqual(['--days must be a whole number of 1 or more (got "soon").'])
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
