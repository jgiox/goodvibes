// File-size ratchet: a new code file must stay within its line limit, and a file already over it may not grow.
// Run from anywhere in the repo: node .github/scripts/check-file-sizes.mjs (Node 20+, git, no npm packages).
//
// Derived from block/buzz scripts/check-file-sizes-core.mjs, Copyright 2026 Block, Inc.,
// licensed under the Apache License, Version 2.0. Modified by goodvibes: one standalone file
// instead of a shared core plus per-project policies; limits come from built-in defaults and
// an optional .github/file-size-limits.json instead of code; the base is the merge-base with
// origin/$GITHUB_BASE_REF, the commit before a push, or HEAD^ (every file is new on a first
// commit); lockfiles, build output, vendored, generated and binary files are skipped; lines are
// counted like wc -l; untracked files are not checked; beginner-friendly messages.
//
// Optional .github/file-size-limits.json (every key optional):
//   { "default": 500, "extensions": { ".py": 600 }, "ignore": ["gen/**"], "allow": { "src/big.ts": 1200 } }
// "default" applies to the built-in code extensions; "extensions" overrides one or adds a new one;
// "allow" sets the limit for one file. Globs match the whole repo-relative path:
// * is any characters except /, ** is any number of folders, ? is one character.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'

const CONFIG = '.github/file-size-limits.json'
const CODE = new Set('.js .jsx .ts .tsx .mjs .cjs .py .rb .go .rs .java .kt .swift .php .cs .c .cc .cpp .h .hpp .vue .svelte'.split(' '))
const SKIP = ['**/*.lock', '**/*-lock.*', '**/*.lockb', '**/go.sum', '**/*.min.*', '**/dist/**', '**/build/**',
  '**/node_modules/**', '**/vendor/**', '**/.venv/**']

// Git hooks export GIT_DIR and friends, which would point these commands at another repository.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
let root

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env, stdio: ['ignore', 'pipe', 'pipe'], ...options })
}

function gitOk(args) {
  try {
    git(args)
    return true
  } catch {
    return false // ponytail: only used to ask git a yes/no question
  }
}

function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2 }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1 }
    else if (glob[i] === '*') re += '[^/]*'
    else if (glob[i] === '?') re += '[^/]'
    else re += glob[i].replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

function isCount(value) {
  return Number.isInteger(value) && value > 0
}

function loadConfig() {
  const file = path.join(root, CONFIG)
  if (!existsSync(file)) return { default: 500, extensions: {}, ignore: [], allow: {} }
  const fail = (why) => { throw new Error(`${CONFIG}: ${why}`) }
  let config
  try {
    config = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`is not valid JSON (${error.message}).`)
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) fail('must be a JSON object like { "default": 500 }.')
  for (const key of Object.keys(config)) {
    if (!['default', 'extensions', 'ignore', 'allow'].includes(key)) fail(`unknown key "${key}". Allowed keys: default, extensions, ignore, allow.`)
  }
  const { default: limit = 500, extensions = {}, ignore = [], allow = {} } = config
  if (!isCount(limit)) fail('"default" must be a whole number above 0.')
  for (const [name, map] of [['extensions', extensions], ['allow', allow]]) {
    if (map === null || typeof map !== 'object' || Array.isArray(map)) fail(`"${name}" must be an object like { "${name === 'allow' ? 'src/big.ts' : '.py'}": 600 }.`)
    for (const [key, value] of Object.entries(map)) if (!isCount(value)) fail(`"${name}" → "${key}" must be a whole number above 0.`)
  }
  for (const ext of Object.keys(extensions)) if (!/^\.[^./]+$/.test(ext)) fail(`"extensions" key "${ext}" must look like ".py".`)
  if (!Array.isArray(ignore) || !ignore.every((g) => typeof g === 'string')) fail('"ignore" must be a list of globs like ["gen/**"].')
  return { default: limit, extensions, ignore, allow }
}

function resolveBase() {
  const baseBranch = process.env.GITHUB_BASE_REF
  if (baseBranch) {
    const remote = `origin/${baseBranch}`
    if (!gitOk(['rev-parse', '--verify', '--quiet', `${remote}^{commit}`])) {
      throw new Error(`Cannot find ${remote} to compare with. The workflow's actions/checkout step needs "fetch-depth: 0" so the full history is available.`)
    }
    return git(['merge-base', remote, 'HEAD']).trim()
  }
  // A push can carry several commits; compare with the commit before the push, not just HEAD^.
  const before = process.env.PUSH_BEFORE
  if (before && !/^0+$/.test(before) && gitOk(['rev-parse', '--verify', '--quiet', `${before}^{commit}`])) return before
  if (gitOk(['rev-parse', '--verify', '--quiet', 'HEAD^'])) return 'HEAD^'
  // A shallow clone hides HEAD^; treating every file as new would then fail on old big files.
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
    throw new Error('This is a shallow clone, so the previous commit is missing. The workflow\'s actions/checkout step needs "fetch-depth: 0".')
  }
  return null
}

function changedFiles(base) {
  if (base === null) return git(['ls-files', '-z']).split('\0').filter(Boolean).map((file) => ({ file, baseFile: null }))
  const fields = git(['diff', '--name-status', '-z', '-M', base]).split('\0')
  const changes = []
  for (let i = 0; i < fields.length - 1;) {
    const status = fields[i++]
    const from = /^[RC]/.test(status) ? fields[i++] : null
    const file = fields[i++]
    if (status === 'D') continue
    changes.push({ file, baseFile: status === 'A' ? null : from ?? file })
  }
  return changes
}

function countLines(buffer) {
  let count = 0
  for (const byte of buffer) if (byte === 10) count++
  return buffer.length > 0 && buffer[buffer.length - 1] !== 10 ? count + 1 : count
}

function isGenerated(buffer) {
  return /@generated|DO NOT EDIT/.test(buffer.subarray(0, 4096).toString('utf8').split('\n').slice(0, 5).join('\n'))
}

function main() {
  const config = loadConfig()
  const skip = [...SKIP, ...config.ignore].map(globToRegExp)
  const base = resolveBase()
  const problems = []
  let checked = 0
  for (const { file, baseFile } of changedFiles(base)) {
    const ext = path.extname(file)
    const limit = config.allow[file] ?? config.extensions[ext] ?? (CODE.has(ext) ? config.default : null)
    if (limit === null || skip.some((re) => re.test(file))) continue
    const full = path.join(root, file)
    if (!existsSync(full) || !lstatSync(full).isFile()) continue
    const content = readFileSync(full)
    if (content.includes(0) || isGenerated(content)) continue
    checked++
    const lines = countLines(content)
    const baseLines = baseFile === null ? null : countLines(git(['show', `${base}:${baseFile}`], { encoding: 'buffer' }))
    if (baseLines !== null && baseLines > limit) {
      if (lines > baseLines) problems.push({ file, lines, message: `${file}: grew from ${baseLines} to ${lines} lines; it is already over the ${limit}-line limit, so it may not grow. Move new code into a new file.` })
    } else if (lines > limit) {
      problems.push({ file, lines, message: `${file}: ${lines} lines (limit ${limit}). Split it into smaller files, each doing one job, so AI tools can read and edit it cheaply.` })
    }
  }
  if (problems.length === 0) {
    console.log(`File size check passed: ${checked} code ${checked === 1 ? 'file' : 'files'} checked.`)
    return
  }
  for (const problem of problems) console.error(problem.message)
  const { file, lines } = problems[0]
  console.error(`If a file really must be bigger, give it its own limit in ${CONFIG}, for example: { "allow": { ${JSON.stringify(file)}: ${lines} } }`)
  process.exitCode = 1
}

try {
  root = git(['rev-parse', '--show-toplevel']).trim()
  main()
} catch (error) {
  console.error(`File size check could not run: ${error.message.trim()}`)
  process.exitCode = 1
}
