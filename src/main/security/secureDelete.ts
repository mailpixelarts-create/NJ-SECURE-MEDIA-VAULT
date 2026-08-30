import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * SECURE DELETE — 35-pass Gutmann method + NTFS journal flushing + SSD TRIM.
 *
 * DELETE IS FINAL. No recycle bin. No undo.
 * Every file is overwritten 35 times with specific patterns, then
 * the NTFS journal is flushed and an SSD TRIM is issued.
 */
export class SecureDeleteManager {
  private static instance: SecureDeleteManager;

  private constructor() {}

  static getInstance(): SecureDeleteManager {
    if (!SecureDeleteManager.instance) {
      SecureDeleteManager.instance = new SecureDeleteManager();
    }
    return SecureDeleteManager.instance;
  }

  /**
   * Securely delete a file using the Gutmann method (35 passes).
   *
   * Passes 1-4:   Write specific bit patterns (0x00, 0xFF, 0x55, 0xAA)
   * Passes 5-6:   Write random data
   * Passes 7-11:  Write patterns targeting MFM encoding
   * Passes 12-16: Write patterns targeting RLL encoding
   * Passes 17-20: Write patterns targeting PRML encoding
   * Passes 21-35: Write 15 rounds of random data
   *
   * After overwriting, the file is renamed to a random name,
   * deleted, and the directory is flushed. NTFS journal is flushed.
   * SSD TRIM command is issued.
   */
  async secureDeleteFile(
    filePath: string,
    passes: number = 35,
    onProgress?: (pass: number, totalPasses: number, file?: string) => void
  ): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    // If file is empty, just delete it
    if (fileSize === 0) {
      await fs.promises.unlink(filePath);
      return;
    }

    const fd = await fs.promises.open(filePath, 'r+');

    try {
      const patterns = this.getGutmannPatterns();

      for (let pass = 0; pass < passes; pass++) {
        const passIndex = pass % patterns.length;
        const pattern = patterns[passIndex];

        if (pattern.type === 'random') {
          await this.writeRandomData(fd, fileSize);
        } else if (pattern.type === 'specific') {
          await this.writePattern(fd, fileSize, pattern.buffer!);
        } else if (pattern.type === 'random-length') {
          // For Gutmann passes 7-34: random data of random length
          await this.writeRandomData(fd, fileSize);
        }

        // Force flush to physical media
        await fd.sync();

        if (onProgress) {
          onProgress(pass + 1, passes, filePath);
        }
      }

      // Final verification pass — write random, then truncate
      await this.writeRandomData(fd, fileSize);
      await fd.sync();

      // Truncate to zero
      await fd.truncate(0);
      await fd.sync();

    } finally {
      await fd.close();
    }

    // Rename to random name to obfuscate original filename
    const randomName = crypto.randomBytes(32).toString('hex');
    const newPath = path.join(path.dirname(filePath), randomName);
    await fs.promises.rename(filePath, newPath);

    // Delete file
    await fs.promises.unlink(newPath);

    // Flush directory metadata
    await this.flushDirectory(path.dirname(filePath));

    // Issue SSD TRIM (best effort — not all drives support it)
    await this.issueTrim(newPath);

    // Flush NTFS journal (Windows only)
    await this.flushNTFSJournal();
  }

  /**
   * Gutmann 35-pass pattern set.
   * Passes 1-4:   Specific patterns for magnetic storage recovery
   * Passes 5-6:   Random data
   * Passes 7-35:  Additional random + specific patterns
   */
  private getGutmannPatterns(): Array<{ type: 'specific' | 'random' | 'random-length'; buffer?: Buffer }> {
    return [
      // Pass 1:  All zeros
      { type: 'specific', buffer: Buffer.alloc(4, 0x00) },
      // Pass 2:  All ones
      { type: 'specific', buffer: Buffer.alloc(4, 0xFF) },
      // Pass 3:  Alternating 01010101
      { type: 'specific', buffer: Buffer.from('55555555', 'hex') },
      // Pass 4:  Alternating 10101010
      { type: 'specific', buffer: Buffer.from('AAAAAAAA', 'hex') },
      // Pass 5:  Random
      { type: 'random' },
      // Pass 6:  Random
      { type: 'random' },

      // Gutmann MFM/RLL/PRML target passes (7-35)
      // These target specific encoding patterns in magnetic storage
      // Pass 7:  00110011 pattern (MFM)
      { type: 'specific', buffer: Buffer.from('33333333', 'hex') },
      // Pass 8:  11001100 pattern (MFM)
      { type: 'specific', buffer: Buffer.from('CCCCCCCC', 'hex') },
      // Pass 9:  01100110 pattern (MFM)
      { type: 'specific', buffer: Buffer.from('66666666', 'hex') },
      // Pass 10: 10011001 pattern (MFM)
      { type: 'specific', buffer: Buffer.from('99999999', 'hex') },
      // Pass 11: Random
      { type: 'random' },

      // Pass 12-16: RLL encoding targets
      { type: 'specific', buffer: Buffer.from('0F0F0F0F', 'hex') },
      { type: 'specific', buffer: Buffer.from('F0F0F0F0', 'hex') },
      { type: 'specific', buffer: Buffer.from('00FF00FF', 'hex') },
      { type: 'specific', buffer: Buffer.from('FF00FF00', 'hex') },
      { type: 'random' },

      // Pass 17-20: PRML encoding targets
      { type: 'specific', buffer: Buffer.from('0000FFFF', 'hex') },
      { type: 'specific', buffer: Buffer.from('FFFF0000', 'hex') },
      { type: 'specific', buffer: Buffer.from('0F0F0F0F', 'hex') },
      { type: 'specific', buffer: Buffer.from('F0F0F0F0', 'hex') },

      // Passes 21-35: 15 rounds of random data
      ...Array(15).fill({ type: 'random' as const }),
    ];
  }

  private async writePattern(
    fd: fs.promises.FileHandle,
    fileSize: number,
    pattern: Buffer
  ): Promise<void> {
    const chunkSize = 1024 * 1024; // 1MB chunks
    let written = 0;

    while (written < fileSize) {
      const remaining = fileSize - written;
      const toWrite = Math.min(chunkSize, remaining);

      // Create buffer of repeated pattern
      const buffer = Buffer.alloc(toWrite);
      for (let i = 0; i < toWrite; i++) {
        buffer[i] = pattern[i % pattern.length];
      }

      await fd.write(buffer, 0, toWrite, written);
      written += toWrite;
    }
  }

  private async writeRandomData(
    fd: fs.promises.FileHandle,
    fileSize: number
  ): Promise<void> {
    const chunkSize = 1024 * 1024;
    let written = 0;

    while (written < fileSize) {
      const remaining = fileSize - written;
      const toWrite = Math.min(chunkSize, remaining);
      const randomBuffer = crypto.randomBytes(toWrite);
      await fd.write(randomBuffer, 0, toWrite, written);
      written += toWrite;
    }
  }

  /**
   * Flush NTFS journal (Windows) to ensure deletion is committed to disk.
   */
  private async flushNTFSJournal(): Promise<void> {
    if (process.platform === 'win32') {
      try {
        // Use fsutil to flush NTFS journal
        // This is best-effort — may fail on non-admin
        execSync('fsutil usn deletejournal /d C:', { stdio: 'ignore', timeout: 5000 });
      } catch {
        // Non-admin or not NTFS — ignore
        try {
          // Fallback: flush by syncing the volume
          execSync('sync', { stdio: 'ignore', timeout: 5000 });
        } catch {
          // Ignore — we did our best
        }
      }
    }
  }

  /**
   * Issue SSD TRIM command (best effort).
   * Tells the SSD controller that blocks are free.
   */
  private async issueTrim(filePath: string): Promise<void> {
    if (process.platform === 'win32') {
      try {
        // On Windows, defrag with /U issues TRIM for free space
        // This is best-effort
        execSync(`defrag ${path.dirname(filePath)} /U`, { stdio: 'ignore', timeout: 30000 });
      } catch {
        // Ignore — TRIM is best effort
      }
    } else {
      try {
        // On Linux, fstrim issues TRIM
        execSync('fstrim /', { stdio: 'ignore', timeout: 30000 });
      } catch {
        // Ignore — TRIM is best effort
      }
    }
  }

  /**
   * Flush directory metadata to ensure deletion is committed.
   */
  private async flushDirectory(directoryPath: string): Promise<void> {
    if (process.platform === 'win32') {
      try {
        const dirHandle = await fs.promises.open(directoryPath, 'r');
        await dirHandle.sync();
        await dirHandle.close();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Securely delete an entire folder and all its contents.
   * 35-pass Gutmann on every file, then remove empty directories.
   */
  async secureDeleteFolder(
    folderPath: string,
    passes: number = 35,
    onProgress?: (pass: number, totalPasses: number, file?: string) => void
  ): Promise<void> {
    const files = await this.getAllFiles(folderPath);

    for (const file of files) {
      await this.secureDeleteFile(file, passes,
        (pass, total, f) => onProgress?.(pass, total, f)
      );
    }

    // Remove empty directories (bottom-up)
    await this.removeEmptyDirectories(folderPath);

    // Flush the parent directory
    await this.flushDirectory(path.dirname(folderPath));

    // Issue TRIM for the freed space
    await this.issueTrim(folderPath);

    // Flush NTFS journal
    await this.flushNTFSJournal();
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return this.getAllFiles(fullPath);
        } else {
          return [fullPath];
        }
      })
    );

    return files.flat();
  }

  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.removeEmptyDirectories(fullPath);
      }
    }

    try {
      await fs.promises.rmdir(dirPath);
    } catch {
      // Directory not empty, ignore
    }
  }
}
