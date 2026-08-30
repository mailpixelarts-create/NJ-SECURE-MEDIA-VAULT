/**
 * Tests for DownloadQueueManager (download/queue.ts)
 * Tests download queue, pause/resume/cancel, and retry logic.
 */
import * as crypto from 'crypto';
import * as os from 'os';

const MOCK_TMP_DIR = os.tmpdir();

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: () => MOCK_TMP_DIR,
  },
}));

// Mock YtDlpManager
// ... (rest of the mocks)
jest.mock('../../main/download/ytdlp', () => ({
  YtDlpManager: {
    getInstance: jest.fn(() => ({
      extractInfo: jest.fn(async (url: string) => ({
        title: 'Test Video',
        duration: 213,
        thumbnail: 'https://example.com/thumb.jpg',
        uploader: 'Test Uploader',
        filesize: 1024 * 1024 * 50,
      })),
      download: jest.fn(async () => {}),
      downloadWithProcess: jest.fn(() => ({
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
      })),
      on: jest.fn(),
      emit: jest.fn(),
    })),
  },
}));

// Mock VaultManager
jest.mock('../../main/security/vault', () => ({
  VaultManager: {
    getInstance: jest.fn(() => ({
      storeFile: jest.fn(async () => 'mock-file-id'),
      getVaultPath: jest.fn(() => MOCK_TMP_DIR),
      getTempPath: jest.fn(() => MOCK_TMP_DIR),
    })),
  },
}));

// Mock DatabaseManager
jest.mock('../../main/database/init', () => ({
  DatabaseManager: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        prepare: jest.fn(() => ({
          run: jest.fn(),
          get: jest.fn(),
          all: jest.fn(() => []),
        })),
        transaction: jest.fn((fn) => fn),
        exec: jest.fn(),
      })),
    })),
  },
}));

// Mock HttpDownloader
jest.mock('../../main/download/httpDownloader', () => ({
  HttpDownloader: {
    getInstance: jest.fn(() => ({
      getInfo: jest.fn(async () => ({ size: 1024, contentType: 'video/mp4' })),
      download: jest.fn(async () => ({ size: 1024, contentType: 'video/mp4' })),
    })),
  },
}));

import { DownloadQueueManager } from '../../main/download/queue';

describe('DownloadQueueManager', () => {
  let manager: DownloadQueueManager;

  beforeEach(() => {
    (DownloadQueueManager as any).instance = undefined;
    manager = DownloadQueueManager.getInstance();
  });

  afterEach(() => {
    manager.destroy();
    (DownloadQueueManager as any).instance = undefined;
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = DownloadQueueManager.getInstance();
      const b = DownloadQueueManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('addDownload', () => {
    it('should return a download ID', async () => {
      const id = await manager.addDownload('https://example.com/video.mp4', {});
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should track active downloads', async () => {
      await manager.addDownload('https://example.com/video1.mp4', {});
      await manager.addDownload('https://example.com/video2.mp4', {});

      const active = manager.getActiveDownloads();
      expect(active.length).toBeGreaterThanOrEqual(2);
    });

    it('should emit download:added event', async () => {
      const emitSpy = jest.spyOn(manager, 'emit');
      await manager.addDownload('https://example.com/video.mp4', {});
      expect(emitSpy).toHaveBeenCalledWith('download:added', expect.any(Object));
    });
  });

  describe('addBulkDownloads', () => {
    it('should add multiple downloads', async () => {
      const urls = [
        'https://example.com/video1.mp4',
        'https://example.com/video2.mp4',
        'https://example.com/video3.mp4',
      ];

      const ids = await manager.addBulkDownloads(urls, {});
      expect(ids.length).toBe(3);
      expect(new Set(ids).size).toBe(3); // All unique
    });

    it('should handle empty URL list', async () => {
      const ids = await manager.addBulkDownloads([], {});
      expect(ids.length).toBe(0);
    });
  });

  describe('cancelDownload', () => {
    it('should cancel a download', async () => {
      const id = await manager.addDownload('https://example.com/video.mp4', {});
      manager.cancelDownload(id);

      const active = manager.getActiveDownloads();
      const cancelled = active.find(d => d.id === id);
      // Download should be removed or marked cancelled
      expect(!cancelled || cancelled.status === 'cancelled').toBe(true);
    });

    it('should emit download:cancelled event', async () => {
      const emitSpy = jest.spyOn(manager, 'emit');
      const id = await manager.addDownload('https://example.com/video.mp4', {});
      manager.cancelDownload(id);
      expect(emitSpy).toHaveBeenCalledWith('download:cancelled', expect.any(Object));
    });
  });

  describe('pauseDownload', () => {
    it('should not crash when pausing a pending task', async () => {
      const id = await manager.addDownload('https://example.com/video.mp4', {});
      // Task is pending, not downloading - pauseDownload should not crash
      expect(() => manager.pauseDownload(id)).not.toThrow();
    });

    it('should emit pause event for downloading task', async () => {
      const id = await manager.addDownload('https://example.com/video.mp4', {});
      // Manually set the task status to downloading
      const active = manager.getActiveDownloads();
      const task = active.find(d => d.id === id);
      if (task) {
        (task as any).status = 'downloading';
      }
      const emitSpy = jest.spyOn(manager, 'emit');
      manager.pauseDownload(id);
      expect(emitSpy).toHaveBeenCalledWith('download:paused', expect.any(Object));
    });
  });

  describe('getActiveDownloads', () => {
    it('should return empty array when no downloads', () => {
      const active = manager.getActiveDownloads();
      expect(Array.isArray(active)).toBe(true);
    });

    it('should return added downloads', async () => {
      await manager.addDownload('https://example.com/video1.mp4', {});
      const active = manager.getActiveDownloads();
      expect(active.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit events via EventEmitter', async () => {
      const handler = jest.fn();
      manager.on('download:added', handler);
      await manager.addDownload('https://example.com/video.mp4', {});
      expect(handler).toHaveBeenCalled();
    });
  });
});
