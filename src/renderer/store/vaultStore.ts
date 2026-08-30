import { create } from 'zustand';

interface FileItem {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  media_type: 'image' | 'video' | 'audio' | 'other';
  extension: string;
  source_url: string;
  downloaded_at: string;
  folder_id: string;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  encrypted: number;
  password_protected: number;
}

interface VaultState {
  files: FileItem[];
  folders: Folder[];
  currentFolder: string | null;
  selectedFiles: string[];
  isLoading: boolean;
  isLocked: boolean;
  error: string | null;

  initializeVault: () => Promise<void>;
  loadFiles: (folderId?: string) => Promise<void>;
  loadFolders: () => Promise<void>;
  createFolder: (name: string, password?: string) => Promise<string>;
  unlockFolder: (folderId: string, password?: string) => Promise<boolean>;
  lockFolder: (folderId: string) => Promise<void>;
  selectFile: (fileId: string) => void;
  deselectFile: (fileId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setCurrentFolder: (folderId: string | null) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  files: [],
  folders: [],
  currentFolder: null,
  selectedFiles: [],
  isLoading: false,
  isLocked: true,
  error: null,

  initializeVault: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().loadFolders(),
        get().loadFiles()
      ]);
      set({ isLoading: false, isLocked: false });
    } catch (err: any) {
      console.error('Vault init failed:', err);
      set({ isLoading: false, error: err.message || 'Failed to initialize vault' });
    }
  },

  loadFiles: async (folderId?: string) => {
    try {
      const files = await window.electronAPI.vault.listFiles(folderId);
      set({ files: files || [] });
    } catch (err: any) {
      console.error('Failed to load files:', err);
      set({ files: [] });
    }
  },

  loadFolders: async () => {
    try {
      const folders = await window.electronAPI.vault.listFolders();
      set({ folders: folders || [] });
    } catch (err: any) {
      console.error('Failed to load folders:', err);
      set({ folders: [] });
    }
  },

  createFolder: async (name: string, password?: string) => {
    try {
      const folderId = await window.electronAPI.vault.createFolder(name, password);
      if (folderId) {
        await get().loadFolders();
      }
      return folderId || '';
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      return '';
    }
  },

  unlockFolder: async (folderId: string, password?: string) => {
    try {
      const success = await window.electronAPI.vault.unlockFolder(folderId, password);
      if (success) {
        await get().loadFiles(folderId);
      }
      return success;
    } catch (err: any) {
      console.error('Failed to unlock folder:', err);
      return false;
    }
  },

  lockFolder: async (folderId: string) => {
    try {
      await window.electronAPI.vault.lockFolder(folderId);
      await get().loadFiles();
    } catch (err: any) {
      console.error('Failed to lock folder:', err);
    }
  },

  selectFile: (fileId: string) => {
    set(state => ({
      selectedFiles: [...state.selectedFiles, fileId]
    }));
  },

  deselectFile: (fileId: string) => {
    set(state => ({
      selectedFiles: state.selectedFiles.filter(id => id !== fileId)
    }));
  },

  selectAll: () => {
    set(state => ({
      selectedFiles: state.files.map(file => file.id)
    }));
  },

  clearSelection: () => {
    set({ selectedFiles: [] });
  },

  setCurrentFolder: (folderId: string | null) => {
    set({ currentFolder: folderId });
    get().loadFiles(folderId || undefined);
  }
}));
