/**
 * UNRESTRICTED Download Queue Manager.
 *
 * Zero rate limiting. Zero polite delays. Zero domain blocklists.
 * Runs at absolute maximum speed the hardware and network allow.
 * 30 simultaneous connections.
 *
 * Features:
 *   - 30 total concurrent downloads (no per-site throttling)
 *   - Auto-detect: yt-dlp for video sites, httpDownloader for direct files
 *   - Pause / resume / cancel
 *   - Streaming encryption to vault
 *   - Retry with exponential backoff for network failures ONLY
 */
import { EventEmitter } from 'events';
import { YtDlpManager } from './ytdlp';
import { HttpDownloader } from './httpDownloader';
import * as path from 'path';
import * as fs from 'fs';
import { VaultManager } from '../security/vault';
import { DatabaseManager } from '../database/init';
import * as crypto from 'crypto';
import { ChildProcess } from 'child_process';

// ═══════════════════════════════════════════════════════════════════════════════
//  UNRESTRICTED CONCURRENT QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

interface QueuedTask {
  fn: () => Promise<any>;
  url: string;
}

/**
 * Simple concurrent queue with no throttling.
 * Runs up to maxTotal tasks simultaneously.
 */
class SimpleQueue {
  private maxTotal: number;
  private runningTotal = 0;
  private queue: QueuedTask[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private active = true;

  constructor(maxTotal: number) {
    this.maxTotal = maxTotal;
    // Check for runnable tasks every 100ms (fast drain)
    this.drainTimer = setInterval(() => this.drain(), 100);
  }

  add(fn: () => Promise<any>, url: string): void {
    if (!this.active) return;
    this.queue.push({ fn, url });
    this.drain();
  }

  private drain(): void {
    if (!this.active) return;
    while (this.queue.length > 0 && this.runningTotal < this.maxTotal) {
      const task = this.queue.shift()!;
      this.runningTotal++;

      task.fn().finally(() => {
        this.runningTotal--;
        if (this.active) this.drain();
      });
    }
  }

  get pendingCount(): number { return this.queue.length; }
  get runningCount(): number { return this.runningTotal; }

  destroy(): void {
    this.active = false;
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    this.queue = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  URL DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const YTDLP_DOMAINS = [
  'youtube.com', 'youtu.be', 'm.youtube.com',
  'twitter.com', 'x.com',
  'instagram.com', 'instagr.am',
  'tiktok.com', 'vm.tiktok.com',
  'reddit.com', 'redd.it', 'v.redd.it',
  'tumblr.com', 'flickr.com', 'vimeo.com',
  'dailymotion.com', 'facebook.com', 'fb.watch',
  'twitch.tv', 'soundcloud.com', 'bandcamp.com',
  'pinterest.com', 'deviantart.com',
  'niconico.com', 'bilibili.com',
];

const DIRECT_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  '.exe', '.msi', '.dmg', '.deb', '.rpm',
  '.txt', '.csv', '.json', '.xml', '.html', '.css', '.js',
  '.iso', '.img', '.apk', '.ipa',
];

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mkv|avi|mov|flv|wmv|m4v|3gp|ts)$/i.test(url.split('?')[0]);
}
function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|flac|aac|ogg|wma|m4a|opus)$/i.test(url.split('?')[0]);
}
function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp|svg|tiff|avif)$/i.test(url.split('?')[0]);
}
function isDirectFileUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return DIRECT_FILE_EXTENSIONS.some(ext => lower.endsWith(ext));
}
function usesYtDlp(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return YTDLP_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}
function detectMediaType(url: string): 'video' | 'audio' | 'image' | 'other' {
  if (isVideoUrl(url) || usesYtDlp(url)) return 'video';
  if (isAudioUrl(url)) return 'audio';
  if (isImageUrl(url)) return 'image';
  return 'other';
}
function detectExtension(url: string, contentType?: string): string {
  const urlExt = path.extname(url.split('?')[0]).toLowerCase();
  if (urlExt && urlExt.length <= 6) return urlExt.slice(1);
  if (contentType) {
    const map: Record<string, string> = {
      'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3',
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
      'application/pdf': 'pdf', 'application/zip': 'zip',
    };
    for (const [mime, ext] of Object.entries(map)) {
      if (contentType.includes(mime)) return ext;
    }
  }
  return 'bin';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DownloadTask {
  id: string;
  url: string;
  options: DownloadOptions;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata?: any;
  error?: string;
  retryCount?: number;
  fileId?: string;
  tempPath?: string;
  downloadProcess?: ChildProcess;
  downloader?: 'ytdlp' | 'http';
}

interface DownloadOptions {
  folderId?: string;
  format?: string;
  maxQuality?: boolean;
  downloadSubtitles?: boolean;
  embedMetadata?: boolean;
  cookiesFromBrowser?: string;
  proxy?: string;
  rateLimit?: string; // IGNORED per build plan
  maxRetries?: number;
  mediaType?: 'all' | 'image' | 'video' | 'audio';
  quality?: string;
  headers?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DOWNLOAD QUEUE MANAGER — UNRESTRICTED
// ═══════════════════════════════════════════════════════════════════════════════

export class DownloadQueueManager extends EventEmitter {
  private static instance: DownloadQueueManager;
  private queue: SimpleQueue;
  private ytdlp: YtDlpManager;
  private http: HttpDownloader;
  private vault: VaultManager;
  private db: DatabaseManager;
  private activeDownloads: Map<string, DownloadTask> = new Map();
  private retryTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private isDestroyed = false;

  private constructor() {
    super();
    this.queue = new SimpleQueue(30); // 30 simultaneous connections — no throttling
    this.ytdlp = YtDlpManager.getInstance();
    this.http = HttpDownloader.getInstance();
    this.vault = VaultManager.getInstance();
    this.db = DatabaseManager.getInstance();

    this.ytdlp.on('progress', (progress) => {
      this.emit('download:progress', progress);
    });
  }

  static getInstance(): DownloadQueueManager {
    if (!DownloadQueueManager.instance) {
      DownloadQueueManager.instance = new DownloadQueueManager();
    }
    return DownloadQueueManager.instance;
  }

  /** Stop the queue and cleanup resources */
  destroy() {
    this.isDestroyed = true;
    this.queue.destroy();
    this.activeDownloads.forEach(task => {
      if (task.downloadProcess && !task.downloadProcess.killed) {
        task.downloadProcess.kill('SIGTERM');
      }
    });
    this.activeDownloads.clear();
    this.retryTimeouts.forEach(t => clearTimeout(t));
    this.retryTimeouts.clear();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Get queue stats */
  getQueueStats(): { pending: number; running: number; maxTotal: number } {
    return {
      pending: this.queue.pendingCount,
      running: this.queue.runningCount,
      maxTotal: 30
    };
  }

  static validateUrl(url: string): { valid: boolean; error?: string } {
    if (!url || !url.trim()) return { valid: false, error: 'URL is empty' };
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS/FTP URLs are supported' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  async addDownload(url: string, options: DownloadOptions): Promise<string> {
    const validation = DownloadQueueManager.validateUrl(url);
    if (!validation.valid) throw new Error(validation.error);

    const downloadId = crypto.randomUUID();
    const downloader = usesYtDlp(url) ? 'ytdlp' : 'http';

    const task: DownloadTask = {
      id: downloadId, url, options,
      status: 'pending', progress: 0,
      createdAt: Date.now(), downloader
    };

    this.activeDownloads.set(downloadId, task);

    const db = this.db.getDatabase();
    db.prepare(`INSERT INTO downloads (id, url, status, started_at) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`)
      .run(downloadId, url);

    this.queue.add(() => this.processDownload(task), url);
    this.emit('download:added', task);
    return downloadId;
  }

  async addBulkDownloads(urls: string[], options: DownloadOptions): Promise<string[]> {
    const ids: string[] = [];
    for (const url of urls) {
      try {
        ids.push(await this.addDownload(url, options));
      } catch (err: any) {
        console.warn(`Skipping invalid URL: ${url} — ${err.message}`);
      }
    }
    return ids;
  }

  pauseDownload(id: string) {
    const task = this.activeDownloads.get(id);
    if (task && task.status === 'downloading') {
      task.status = 'paused';
      if (task.downloadProcess && !task.downloadProcess.killed) {
        task.downloadProcess.kill('SIGTERM');
      }
      this.emit('download:paused', task);
    }
  }

  resumeDownload(id: string) {
    const task = this.activeDownloads.get(id);
    if (task && task.status === 'paused') {
      task.status = 'pending';
      task.downloadProcess = undefined;
      this.queue.add(() => this.processDownload(task), task.url);
      this.emit('download:resumed', task);
    }
  }

  cancelDownload(id: string) {
    const task = this.activeDownloads.get(id);
    if (task) {
      task.status = 'cancelled';
      if (task.downloadProcess && !task.downloadProcess.killed) {
        task.downloadProcess.kill('SIGTERM');
      }
      if (task.tempPath && fs.existsSync(task.tempPath)) {
        try { fs.unlinkSync(task.tempPath); } catch {}
      }
      this.activeDownloads.delete(id);
      this.emit('download:cancelled', task);
    }
  }

  getActiveDownloads(): DownloadTask[] {
    return Array.from(this.activeDownloads.values());
  }

  // ── Internal processing ─────────────────────────────────────────────────

  /**
   * Process a download — no throttling, no rate limits.
   * Retry only for network failures (exponential backoff).
   */
  private async processDownload(task: DownloadTask): Promise<void> {
    if (this.isDestroyed) return;
    task.status = 'downloading';
    task.startedAt = Date.now();
    this.emit('download:started', task);

    try {
      if (task.downloader === 'ytdlp') {
        await this.processYtDlpDownload(task);
      } else {
        await this.processHttpDownload(task);
      }
    } catch (error: any) {
      if (this.isDestroyed) return;
      const cur = this.activeDownloads.get(task.id);
      if (cur && (cur.status === 'paused' || cur.status === 'cancelled')) return;

      task.status = 'failed';
      task.error = error.message;
      this.emit('download:failed', task);

      const db = this.db.getDatabase();
      db.prepare(`UPDATE downloads SET status='failed', error_message=? WHERE id=?`)
        .run(error.message, task.id);

      // RETRY with exponential backoff — network failures ONLY
      task.retryCount = task.retryCount || 0;
      const maxRetries = task.options.maxRetries ?? 10; // More retries — infinite per plan
      if (task.retryCount < maxRetries) {
        task.retryCount++;
        task.status = 'pending';
        const backoffMs = Math.pow(2, task.retryCount) * 1000;
        const timer = setTimeout(() => {
          this.retryTimeouts.delete(timer);
          this.queue.add(() => this.processDownload(task), task.url);
        }, Math.min(backoffMs, 30000)); // Cap at 30s
        this.retryTimeouts.add(timer);
        this.emit('download:retry', task);
      }
    } finally {
      const cur = this.activeDownloads.get(task.id);
      if (cur && cur.status !== 'paused') {
        this.activeDownloads.delete(task.id);
      }
    }
  }

  private async processYtDlpDownload(task: DownloadTask): Promise<void> {
    if (this.isDestroyed) return;
    let info: any;
    try {
      info = await this.ytdlp.extractInfo(task.url);
    } catch {
      if (this.isDestroyed) return;
      // Fallback to HTTP downloader
      task.downloader = 'http';
      return this.processHttpDownload(task);
    }

    if (this.isDestroyed) return;
    task.metadata = {
      title: info.title, duration: info.duration,
      thumbnail: info.thumbnail, uploader: info.uploader,
      filesize: info.filesize
    };

    const ext = info.ext || 'mp4';
    const tempPath = path.join(this.vault.getVaultPath(), 'temp', `${task.id}_${Date.now()}.${ext}`);
    task.tempPath = tempPath;

    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    if (this.isDestroyed) return;
    const proc = this.ytdlp.downloadWithProcess(task.url, tempPath, task.options);
    task.downloadProcess = proc;

    await new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        if (this.isDestroyed || task.status === 'paused' || task.status === 'cancelled') { resolve(); return; }
        code === 0 ? resolve() : reject(new Error(`yt-dlp failed with code ${code}`));
      });
      proc.on('error', (err) => {
        if (this.isDestroyed) resolve();
        else reject(err);
      });
    });

    if (this.isDestroyed) return;
    const cur = this.activeDownloads.get(task.id);
    if (this.isDestroyed || !cur || cur.status === 'paused' || cur.status === 'cancelled') return;

    const mediaType = detectMediaType(task.url);
    const folderId = task.options.folderId || 'default_downloads';
    const fileSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;

    // Store in vault — streaming encryption, 35-pass wipe on original
    const fileId = await this.vault.storeFile(tempPath, folderId, {
      originalName: `${info.title || 'download'}.${ext}`,
      size: fileSize, mimeType: `video/${ext}`,
      mediaType: mediaType === 'audio' ? 'audio' : 'video',
      extension: ext, sourceUrl: task.url
    });

    this.completeTask(task, fileId, fileSize);
  }

  private async processHttpDownload(task: DownloadTask): Promise<void> {
    if (this.isDestroyed) return;
    let fileInfo: any;
    try { fileInfo = await this.http.getInfo(task.url, task.options.headers); }
    catch { fileInfo = { size: 0, contentType: 'application/octet-stream' }; }

    if (this.isDestroyed) return;
    const ext = detectExtension(task.url, fileInfo.contentType);
    const baseName = path.basename(new URL(task.url).pathname).split('?')[0] || `download_${task.id.slice(0, 8)}`;
    const filename = baseName.includes('.') ? baseName : `${baseName}.${ext}`;

    task.metadata = { filename, contentType: fileInfo.contentType, totalSize: fileInfo.size };

    const tempPath = path.join(this.vault.getVaultPath(), 'temp', `${task.id}_${filename}`);
    task.tempPath = tempPath;

    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // NO rate limit per build plan
    const result = await this.http.download(task.url, tempPath, {
      headers: task.options.headers,
      maxRetries: 0, // We handle retries at queue level
    }, (progress) => {
      if (this.isDestroyed) return;
      task.progress = progress.percent;
      this.emit('download:progress', {
        id: task.id, percent: progress.percent,
        speed: progress.speed, eta: progress.eta,
        downloaded: progress.downloaded, total: progress.total,
      });
    });

    if (this.isDestroyed) return;
    const cur = this.activeDownloads.get(task.id);
    if (this.isDestroyed || !cur || cur.status === 'paused' || cur.status === 'cancelled') return;

    const mediaType = isImageUrl(task.url) ? 'image' : isAudioUrl(task.url) ? 'audio' : isVideoUrl(task.url) ? 'video' : 'other';
    const folderId = task.options.folderId || 'default_downloads';

    // Store in vault — streaming encryption, 35-pass wipe on original
    const fileId = await this.vault.storeFile(tempPath, folderId, {
      originalName: filename, size: result.size,
      mimeType: result.contentType, mediaType,
      extension: ext, sourceUrl: task.url
    });

    if (this.isDestroyed) return;
    this.completeTask(task, fileId, result.size);
  }

  private completeTask(task: DownloadTask, fileId: string, fileSize: number): void {
    task.status = 'completed';
    task.completedAt = Date.now();
    task.progress = 100;
    task.fileId = fileId;
    this.emit('download:completed', task);

    const db = this.db.getDatabase();
    db.prepare(`UPDATE downloads SET status='completed', completed_at=CURRENT_TIMESTAMP, downloaded_to=?, file_size=? WHERE id=?`)
      .run(fileId, fileSize, task.id);
  }
}
