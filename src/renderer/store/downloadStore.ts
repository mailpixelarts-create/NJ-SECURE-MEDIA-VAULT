import { create } from 'zustand';

interface DownloadTask {
  id: string;
  url: string;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed?: string;
  eta?: string;
  metadata?: any;
  error?: string;
  fileId?: string;
  created_at?: string;
}

interface DownloadState {
  activeDownloads: DownloadTask[];
  completedDownloads: DownloadTask[];
  failedDownloads: DownloadTask[];
  historyDownloads: DownloadTask[];
  isDownloading: boolean;
  historyLoaded: boolean;

  loadHistory: () => Promise<void>;
  addDownload: (url: string, options?: any) => Promise<string>;
  addBulkDownloads: (urls: string[], options?: any) => Promise<string[]>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  retryDownload: (id: string, url: string, options?: any) => Promise<void>;
  updateProgress: (progress: any) => void;
  clearCompleted: () => void;
  getStats: () => Promise<{ total: number; completed: number; failed: number; totalSize: number }>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  activeDownloads: [],
  completedDownloads: [],
  failedDownloads: [],
  historyDownloads: [],
  isDownloading: false,
  historyLoaded: false,

  /**
   * Load download history from SQLite database on mount.
   * This persists across app restarts.
   */
  loadHistory: async () => {
    try {
      const [completed, failed, allHistory] = await Promise.all([
        window.electronAPI.download.getHistory({ status: 'completed', limit: 100 }),
        window.electronAPI.download.getHistory({ status: 'failed', limit: 50 }),
        window.electronAPI.download.getHistory({ limit: 200 }),
      ]);

      const mapDbToTask = (row: any): DownloadTask => ({
        id: row.id,
        url: row.url,
        status: row.status,
        progress: row.status === 'completed' ? 100 : 0,
        metadata: {
          mediaType: row.media_type,
          quality: row.quality,
          fileSize: row.file_size,
        },
        error: row.error_message,
        fileId: row.downloaded_to,
        created_at: row.started_at,
      });

      set({
        completedDownloads: completed.map(mapDbToTask),
        failedDownloads: failed.map(mapDbToTask),
        historyDownloads: allHistory.map(mapDbToTask),
        historyLoaded: true,
      });
    } catch (err) {
      console.error('Failed to load download history:', err);
      set({ historyLoaded: true });
    }
  },

  addDownload: async (url: string, options?: any) => {
    try {
      const id = await window.electronAPI.download.add(url, options);
      if (!id) return '';
      set(state => ({
        activeDownloads: [...state.activeDownloads, {
          id,
          url,
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString()
        }],
        isDownloading: true
      }));
      return id;
    } catch (err: any) {
      console.error('Failed to add download:', err);
      return '';
    }
  },

  addBulkDownloads: async (urls: string[], options?: any) => {
    try {
      const ids = await window.electronAPI.download.addBulk(urls, options);
      if (!ids || !ids.length) return [];
      const newTasks = urls.map((url, index) => ({
        id: ids[index],
        url,
        status: 'pending' as const,
        progress: 0,
        created_at: new Date().toISOString()
      }));
      set(state => ({
        activeDownloads: [...state.activeDownloads, ...newTasks],
        isDownloading: true
      }));
      return ids;
    } catch (err: any) {
      console.error('Failed to add bulk downloads:', err);
      throw err;
    }
  },

  pauseDownload: async (id: string) => {
    try {
      await window.electronAPI.download.pause(id);
      set(state => ({
        activeDownloads: state.activeDownloads.map(task =>
          task.id === id ? { ...task, status: 'paused' } : task
        )
      }));
    } catch (err: any) {
      console.error('Failed to pause download:', err);
    }
  },

  resumeDownload: async (id: string) => {
    try {
      await window.electronAPI.download.resume(id);
      set(state => ({
        activeDownloads: state.activeDownloads.map(task =>
          task.id === id ? { ...task, status: 'pending' } : task
        )
      }));
    } catch (err: any) {
      console.error('Failed to resume download:', err);
    }
  },

  cancelDownload: async (id: string) => {
    try {
      await window.electronAPI.download.cancel(id);
      set(state => ({
        activeDownloads: state.activeDownloads.filter(task => task.id !== id)
      }));
    } catch (err: any) {
      console.error('Failed to cancel download:', err);
    }
  },

  /**
   * Retry a failed download by re-adding it to the queue.
   */
  retryDownload: async (id: string, url: string, options?: any) => {
    try {
      // Remove from failed list
      set(state => ({
        failedDownloads: state.failedDownloads.filter(t => t.id !== id)
      }));
      // Re-add to queue
      await get().addDownload(url, options);
    } catch (err: any) {
      console.error('Failed to retry download:', err);
    }
  },

  updateProgress: (progress: any) => {
    set(state => {
      const task = state.activeDownloads.find(t => t.id === progress.id);
      if (!task) return state;

      const updatedTask = {
        ...task,
        progress: progress.percent ?? task.progress,
        speed: progress.speed ?? task.speed,
        eta: progress.eta ?? task.eta,
        status: progress.status ?? task.status,
        metadata: progress.metadata ?? task.metadata,
        fileId: progress.fileId ?? task.fileId,
        error: progress.error ?? task.error
      };

      if (updatedTask.status === 'completed') {
        return {
          activeDownloads: state.activeDownloads.filter(t => t.id !== progress.id),
          completedDownloads: [updatedTask, ...state.completedDownloads].slice(0, 200),
          historyDownloads: [updatedTask, ...state.historyDownloads].slice(0, 500),
          isDownloading: state.activeDownloads.length > 1
        };
      }

      if (updatedTask.status === 'failed') {
        return {
          activeDownloads: state.activeDownloads.filter(t => t.id !== progress.id),
          failedDownloads: [updatedTask, ...state.failedDownloads].slice(0, 100),
          historyDownloads: [updatedTask, ...state.historyDownloads].slice(0, 500),
          isDownloading: state.activeDownloads.length > 1
        };
      }

      return {
        activeDownloads: state.activeDownloads.map(t =>
          t.id === progress.id ? updatedTask : t
        )
      };
    });
  },

  clearCompleted: () => {
    set({
      completedDownloads: [],
      failedDownloads: []
    });
  },

  getStats: async () => {
    try {
      return await window.electronAPI.download.getStats();
    } catch {
      return { total: 0, completed: 0, failed: 0, totalSize: 0 };
    }
  }
}));

// Wire up progress listener from main process
if (typeof window !== 'undefined' && window.electronAPI?.download?.onProgress) {
  window.electronAPI.download.onProgress((progress: any) => {
    useDownloadStore.getState().updateProgress(progress);
  });
}
