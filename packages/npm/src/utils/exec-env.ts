// Windows looks for a program in the current folder before PATH, so a cloned repo could ship its own git.cmd; execa and cmd.exe skip that folder when this is set.
export const EXEC_ENV = { NoDefaultCurrentDirectoryInExePath: '1' }
