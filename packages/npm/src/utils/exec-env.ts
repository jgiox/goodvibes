import { delimiter, isAbsolute, relative } from 'node:path'

const insideProject = (dir: string) => {
  const rel = relative(process.cwd(), dir)
  return !rel.startsWith('..') && !isAbsolute(rel)
}

// A PATH entry that is ".", empty, relative or inside this project would let a cloned repo pick the program (git, claude, headroom).
const safePath = () => (process.env.PATH ?? '').split(delimiter).filter(d => isAbsolute(d) && !insideProject(d)).join(delimiter)

// Windows looks for a program in the current folder before PATH, so a cloned repo could ship its own git.cmd; execa and cmd.exe skip that folder when this is set.
// PATH is a getter so each call sees the PATH and folder of that moment (execa spreads env, which reads it).
export const EXEC_ENV: Record<string, string> = { NoDefaultCurrentDirectoryInExePath: '1' }
if (process.platform !== 'win32') Object.defineProperty(EXEC_ENV, 'PATH', { get: safePath, enumerable: true })
