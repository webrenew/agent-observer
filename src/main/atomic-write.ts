import fs from 'fs'
import path from 'path'

/**
 * Atomically replace file contents using write + fsync + rename.
 * Best-effort fsync on parent directory is included for durability.
 */
export function writeFileAtomicSync(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath)
  const baseName = path.basename(targetPath)
  const tempPath = path.join(dir, `.${baseName}.${process.pid}.${Date.now()}.tmp`)
  let fd: number | null = null

  try {
    fd = fs.openSync(tempPath, 'w')
    fs.writeFileSync(fd, content, 'utf-8')
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = null

    fs.renameSync(tempPath, targetPath)

    try {
      const dirFd = fs.openSync(dir, 'r')
      try {
        fs.fsyncSync(dirFd)
      } finally {
        fs.closeSync(dirFd)
      }
    } catch {
      // Best effort; directory fsync may fail on some platforms.
    }
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd)
      } catch {
        // Ignore close errors during cleanup.
      }
    }
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    } catch {
      // Ignore temp cleanup failures.
    }
    throw err
  }
}
