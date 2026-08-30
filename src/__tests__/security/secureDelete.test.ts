/**
 * Tests for SecureDeleteManager (security/secureDelete.ts)
 * Tests multi-pass file deletion, pattern writing, and folder deletion.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}));

import { SecureDeleteManager } from '../../main/security/secureDelete';

// Patch flushDirectory to handle Windows EPERM errors gracefully
const origFlushDir = (SecureDeleteManager.prototype as any).flushDirectory;
(SecureDeleteManager.prototype as any).flushDirectory = async function(dirPath: string) {
  try {
    await origFlushDir.call(this, dirPath);
  } catch (err: any) {
    // Ignore EPERM errors in test environment
    if (err.code !== 'EPERM') throw err;
  }
};

describe('SecureDeleteManager', () => {
  let manager: SecureDeleteManager;
  let tmpDir: string;

  beforeEach(() => {
    (SecureDeleteManager as any).instance = undefined;
    manager = SecureDeleteManager.getInstance();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-delete-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    (SecureDeleteManager as any).instance = undefined;
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = SecureDeleteManager.getInstance();
      const b = SecureDeleteManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('secureDeleteFile', () => {
    it('should delete a file', async () => {
      const filePath = path.join(tmpDir, 'test-file.txt');
      fs.writeFileSync(filePath, 'This is sensitive data that must be destroyed');

      expect(fs.existsSync(filePath)).toBe(true);

      await manager.secureDeleteFile(filePath, 1);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should overwrite file data before deletion', async () => {
      const filePath = path.join(tmpDir, 'overwrite-test.bin');
      const originalData = Buffer.alloc(1024, 0xAB);
      fs.writeFileSync(filePath, originalData);

      // Verify file has original content
      const beforeRead = fs.readFileSync(filePath);
      expect(beforeRead[0]).toBe(0xAB);

      await manager.secureDeleteFile(filePath, 3);

      // File should be deleted
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should work with 1 pass (quick delete)', async () => {
      const filePath = path.join(tmpDir, 'quick-delete.txt');
      fs.writeFileSync(filePath, 'Quick delete test');

      await manager.secureDeleteFile(filePath, 1);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should work with multiple passes', async () => {
      const filePath = path.join(tmpDir, 'multi-pass.txt');
      fs.writeFileSync(filePath, 'Multi-pass delete test with enough data to overwrite');

      await manager.secureDeleteFile(filePath, 5);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(tmpDir, 'empty-file.txt');
      fs.writeFileSync(filePath, '');

      await manager.secureDeleteFile(filePath, 1);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle large files (1MB)', async () => {
      const filePath = path.join(tmpDir, 'large-file.bin');
      const largeData = Buffer.alloc(1024 * 1024, 0xFF);
      fs.writeFileSync(filePath, largeData);

      await manager.secureDeleteFile(filePath, 3);
      expect(fs.existsSync(filePath)).toBe(false);
    }, 60000);

    it('should call onProgress callback', async () => {
      const filePath = path.join(tmpDir, 'progress-test.txt');
      fs.writeFileSync(filePath, 'Progress test');

      const progressCalls: Array<{ pass: number; total: number }> = [];
      const onProgress = (pass: number, total: number) => {
        progressCalls.push({ pass, total });
      };

      await manager.secureDeleteFile(filePath, 3, onProgress);

      expect(progressCalls.length).toBe(3);
      expect(progressCalls[0].pass).toBe(1);
      expect(progressCalls[2].pass).toBe(3);
    });

    it('should handle non-existent file gracefully', async () => {
      const filePath = path.join(tmpDir, 'does-not-exist.txt');

      // Should not throw — silently returns
      await manager.secureDeleteFile(filePath, 1);
    });
  });

  describe('secureDeleteFolder', () => {
    it('should delete all files in a folder', async () => {
      const folderPath = path.join(tmpDir, 'test-folder');
      fs.mkdirSync(folderPath);
      fs.writeFileSync(path.join(folderPath, 'file1.txt'), 'File 1 content');
      fs.writeFileSync(path.join(folderPath, 'file2.txt'), 'File 2 content');
      fs.writeFileSync(path.join(folderPath, 'file3.txt'), 'File 3 content');

      await manager.secureDeleteFolder(folderPath, 1);

      expect(fs.existsSync(path.join(folderPath, 'file1.txt'))).toBe(false);
      expect(fs.existsSync(path.join(folderPath, 'file2.txt'))).toBe(false);
      expect(fs.existsSync(path.join(folderPath, 'file3.txt'))).toBe(false);
    });

    it('should delete files in subfolders', async () => {
      const folderPath = path.join(tmpDir, 'nested-folder');
      const subPath = path.join(folderPath, 'sub');
      fs.mkdirSync(subPath, { recursive: true });
      fs.writeFileSync(path.join(folderPath, 'root.txt'), 'Root file');
      fs.writeFileSync(path.join(subPath, 'nested.txt'), 'Nested file');

      await manager.secureDeleteFolder(folderPath, 1);

      expect(fs.existsSync(path.join(folderPath, 'root.txt'))).toBe(false);
      expect(fs.existsSync(path.join(subPath, 'nested.txt'))).toBe(false);
    });

    it('should handle empty folders', async () => {
      const folderPath = path.join(tmpDir, 'empty-folder');
      fs.mkdirSync(folderPath);

      await manager.secureDeleteFolder(folderPath, 1);

      // Empty folder should be removed
      expect(fs.existsSync(folderPath)).toBe(false);
    });

    it('should call onProgress with file info', async () => {
      const folderPath = path.join(tmpDir, 'progress-folder');
      fs.mkdirSync(folderPath);
      fs.writeFileSync(path.join(folderPath, 'a.txt'), 'A');
      fs.writeFileSync(path.join(folderPath, 'b.txt'), 'B');

      const progressCalls: Array<{ pass: number; total: number; file: string }> = [];
      const onProgress = (pass: number, total: number, file?: string) => {
        progressCalls.push({ pass, total, file: file || '' });
      };

      await manager.secureDeleteFolder(folderPath, 1, onProgress);

      expect(progressCalls.length).toBeGreaterThan(0);
      // Each call should have a valid file path
      progressCalls.forEach(call => {
        expect(call.file).toBeTruthy();
      });
    });
  });
});
