import { app, BrowserWindow, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPCHandlers } from './ipc';
import { DatabaseManager } from './database/init';
import { EncryptionManager } from './security/encryption';
import { AuthManager } from './security/auth';
import { VaultManager } from './security/vault';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Required for <webview> in EmbeddedBrowser
    },
    icon: path.join(__dirname, '../../resources/icons/app.ico')
  });

  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:8080');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  // Only open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-lock timer: lock after 5 minutes of inactivity
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      AuthManager.getInstance().logout();
      VaultManager.getInstance().lockAllFolders();
      console.log('Auto-lock: vault locked due to inactivity');
      if (mainWindow) {
        mainWindow.webContents.send('auto-locked');
      }
    }, IDLE_TIMEOUT);
  };

  mainWindow.webContents.on('before-input-event', resetIdleTimer);
  mainWindow.on('focus', resetIdleTimer);
  resetIdleTimer();
}

app.whenReady().then(async () => {
  // Initialize Database
  DatabaseManager.getInstance();

  // Auto-login with hardcoded master password: 21-12-1974
  try {
    const auth = AuthManager.getInstance();
    await auth.autoLogin();
    console.log('Auto-login successful with master password');
  } catch (err) {
    console.log('Auto-login will require manual authentication');
  }

  // Register IPC Handlers
  new IPCHandlers();

  // ── FORWARD DOWNLOAD EVENTS TO RENDERER ────────────────────────────
  // The DownloadQueueManager emits events in the main process.
  // We must forward them to the renderer via webContents.send().
  const { DownloadQueueManager } = require('./download/queue');
  const queue = DownloadQueueManager.getInstance();

  queue.on('download:progress', (progress: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', {
        id: progress.id,
        percent: progress.percent,
        speed: progress.speed,
        eta: progress.eta,
        downloaded: progress.downloaded,
        total: progress.total,
      });
    }
  });

  queue.on('download:completed', (task: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', {
        id: task.id,
        percent: 100,
        status: 'completed',
        fileId: task.fileId,
        metadata: task.metadata,
      });
    }
  });

  queue.on('download:failed', (task: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', {
        id: task.id,
        status: 'failed',
        error: task.error,
      });
    }
  });

  queue.on('download:cancelled', (task: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', {
        id: task.id,
        status: 'cancelled',
      });
    }
  });

  // Register Custom In-Memory Streaming Protocol
  // vault://fileId/stream  →  decrypts on the fly, returns plaintext buffer
  // vault://fileId/thumb   →  returns decrypted thumbnail
  protocol.handle('vault', async (req) => {
    try {
      const url = req.url.replace('vault://', '');
      const parts = url.split('/');
      const fileId = parts[0];
      const mode = parts[1] || 'stream'; // 'thumbnail' or 'stream'

      const db = DatabaseManager.getInstance().getDatabase();
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
      if (!file) {
        return new Response('File not found', { status: 404 });
      }

      const encryptionManager = EncryptionManager.getInstance();
      if (!encryptionManager.getSessionKey()) {
        return new Response('Vault locked', { status: 401 });
      }

      let filePath = file.file_path;

      if (mode === 'thumbnail') {
        const thumbPath = filePath.replace(/\.[^.]+$/, '_thumb.jpg');
        if (fs.existsSync(thumbPath)) {
          filePath = thumbPath;
        }
      }

      if (!fs.existsSync(filePath)) {
        return new Response('File missing', { status: 404 });
      }

      // ── STREAMING DECRYPTION ─────────────────────────────────────
      const fileBuffer = fs.readFileSync(filePath);
      const iv = fileBuffer.slice(0, 12);
      const authTag = fileBuffer.slice(-16);
      const encryptedData = fileBuffer.slice(12, -16);

      const decryptedBuffer = await encryptionManager.decryptBuffer(encryptedData, iv, authTag);

      // Determine content type from original file extension
      let contentType = 'application/octet-stream';
      if (file.original_name?.endsWith('.mp4')) contentType = 'video/mp4';
      if (file.original_name?.endsWith('.jpg') || file.original_name?.endsWith('.jpeg')) contentType = 'image/jpeg';
      if (file.original_name?.endsWith('.png')) contentType = 'image/png';
      if (file.original_name?.endsWith('.gif')) contentType = 'image/gif';
      if (file.original_name?.endsWith('.webp')) contentType = 'image/webp';
      if (file.original_name?.endsWith('.webm')) contentType = 'video/webm';
      if (file.original_name?.endsWith('.mkv')) contentType = 'video/x-matroska';
      if (file.original_name?.endsWith('.mp3')) contentType = 'audio/mpeg';
      if (file.original_name?.endsWith('.wav')) contentType = 'audio/wav';

      return new Response(decryptedBuffer as any, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store', // Never cache decrypted data
        }
      });
    } catch (error) {
      console.error('Vault protocol error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On quit: encrypt database before exit
app.on('before-quit', async () => {
  try {
    const db = DatabaseManager.getInstance();
    await db.encryptDatabase();
    console.log('Database encrypted on exit');
  } catch (err) {
    console.error('Failed to encrypt database on exit:', err);
  }
});
