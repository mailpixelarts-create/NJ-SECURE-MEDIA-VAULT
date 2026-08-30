import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

/**
 * UNRESTRICTED yt-dlp wrapper.
 * Zero rate limiting, zero domain blocklists, zero robots.txt parsing.
 * Aggressive flags: --ignore-errors, --no-abort-on-error, --concurrent-fragments 10, --retries infinite.
 * Max quality: bestvideo*+bestaudio/best.
 */
export class YtDlpManager extends EventEmitter {
  private static instance: YtDlpManager;
  private ytdlpPath: string;
  private ffmpegPath: string;
  private ffprobePath: string;

  private constructor() {
    super();
    this.ytdlpPath = this.findBinary('yt-dlp.exe', 'yt-dlp');
    this.ffmpegPath = this.findBinary('ffmpeg.exe', 'ffmpeg');
    this.ffprobePath = this.findBinary('ffprobe.exe', 'ffprobe');
  }

  private findBinary(winName: string, unixName: string): string {
    const name = process.platform === 'win32' ? winName : unixName;

    // In production, check resourcesPath
    if (typeof process.resourcesPath !== 'undefined' && process.resourcesPath) {
      const prodPath = path.join(process.resourcesPath, 'bin', name);
      if (fs.existsSync(prodPath)) return prodPath;
    }

    // In development, check project root bin/
    const devPath = path.join(process.cwd(), 'bin', name);
    if (fs.existsSync(devPath)) return devPath;

    // Check node_modules/.bin
    const nmPath = path.join(process.cwd(), 'node_modules', '.bin', unixName);
    if (fs.existsSync(nmPath)) return nmPath;

    // Check common system locations
    const systemPath = process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'yt-dlp', name)
      : `/usr/local/bin/${name}`;
    if (fs.existsSync(systemPath)) return systemPath;

    // Fallback: return name and hope it's in PATH
    return name;
  }

  static getInstance(): YtDlpManager {
    if (!YtDlpManager.instance) {
      YtDlpManager.instance = new YtDlpManager();
    }
    return YtDlpManager.instance;
  }

  isAvailable(): boolean {
    return fs.existsSync(this.ytdlpPath) || this.ytdlpPath === 'yt-dlp' || this.ytdlpPath === 'yt-dlp.exe';
  }

  getFfmpegPath(): string {
    return this.ffmpegPath;
  }

  getFfprobePath(): string {
    return this.ffprobePath;
  }

  /**
   * Extract info with aggressive flags — ignore errors, no playlist abort.
   */
  async extractInfo(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = [
        url,
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--ignore-errors',
        '--no-abort-on-error',
      ];

      const proc = spawn(this.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { errorOutput += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            resolve(JSON.parse(output.trim().split('\n')[0]));
          } catch {
            reject(new Error('Failed to parse video info JSON'));
          }
        } else if (output.trim()) {
          // Even with non-zero exit, try to parse what we got
          try {
            resolve(JSON.parse(output.trim().split('\n')[0]));
          } catch {
            reject(new Error(errorOutput || 'Failed to extract info'));
          }
        } else {
          reject(new Error(errorOutput || 'Failed to extract info'));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`yt-dlp binary not found at: ${this.ytdlpPath}. Install yt-dlp and place it in bin/`));
      });

      // Kill after 60 seconds to prevent hangs
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGTERM');
      }, 60000);
    });
  }

  async getVideoInfo(url: string): Promise<any> {
    return this.extractInfo(url);
  }

  /**
   * Download with UNRESTRICTED flags:
   *   --ignore-errors          Don't abort on errors
   *   --no-abort-on-error      Continue on download errors
   *   --concurrent-fragments 10  Download 10 fragments simultaneously (HLS/DASH)
   *   --retries infinite       Infinite retries for transient errors
   *   --socket-timeout 30      30s socket timeout
   *   --extractor-retries 5    Retry extractor 5 times
   *   -f bestvideo*+bestaudio/best  Always max quality
   *   --no-rate-limit          No rate limiting
   */
  async download(
    url: string,
    outputPath: string,
    options: DownloadOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.buildDownloadArgs(url, outputPath, options);

      const proc = spawn(this.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (data) => {
        const progress = this.parseProgress(data.toString());
        if (progress) this.emit('progress', progress);
      });

      proc.stderr.on('data', (data) => {
        this.emit('log', data.toString());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp failed with exit code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`yt-dlp binary not found at: ${this.ytdlpPath}. Install yt-dlp and place it in bin/`));
      });
    });
  }

  /**
   * Download returning the child process for real-time control.
   */
  downloadWithProcess(
    url: string,
    outputPath: string,
    options: DownloadOptions = {}
  ): ChildProcess {
    const args = this.buildDownloadArgs(url, outputPath, options);
    const childProcess = spawn(this.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    childProcess.stdout.on('data', (data) => {
      const progress = this.parseProgress(data.toString());
      if (progress) this.emit('progress', progress);
    });

    childProcess.stderr.on('data', (data) => {
      this.emit('log', data.toString());
    });

    childProcess.on('error', (err) => {
      this.emit('error', new Error(`yt-dlp binary not found at: ${this.ytdlpPath}. Install yt-dlp and place it in bin/`));
    });

    return childProcess;
  }

  /**
   * Build the UNRESTRICTED argument list.
   * No rate limiting, no robots.txt, no domain blocklists.
   * Maximum speed the hardware and network allow.
   */
  private buildDownloadArgs(
    url: string,
    outputPath: string,
    options: DownloadOptions
  ): string[] {
    const args = [
      url,

      // ── MAX QUALITY ────────────────────────────────────────────────
      '-f', options.format || 'bestvideo*+bestaudio/best',
      '--merge-output-format', options.mergeFormat || 'mp4',

      // ── OUTPUT ─────────────────────────────────────────────────────
      '-o', outputPath,
      '--newline',
      '--no-playlist',

      // ── AGGRESSIVE FLAGS ───────────────────────────────────────────
      '--ignore-errors',            // Don't abort on errors
      '--no-abort-on-error',        // Continue downloading even if some formats fail
      '--concurrent-fragments', '10', // Download 10 HLS/DASH fragments at once
      '--retries', 'infinite',      // Infinite retries for network errors
      '--socket-timeout', '30',     // 30s socket timeout
      '--extractor-retries', '5',   // Retry extractor 5 times
      '--no-rate-limit',            // NO rate limiting whatsoever
      '--fragment-retries', 'infinite', // Infinite fragment retries

      // ── FFMPEG ─────────────────────────────────────────────────────
      '--ffmpeg-location', path.dirname(this.ffmpegPath),
    ];

    if (options.maxQuality) {
      args.push('--format-sort', 'res,fps,codec:h264');
    }

    if (options.downloadSubtitles) {
      args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'all');
    }

    if (options.embedMetadata) {
      args.push('--embed-metadata', '--embed-thumbnail');
    }

    if (options.cookiesFromBrowser) {
      args.push('--cookies-from-browser', options.cookiesFromBrowser);
    }

    if (options.proxy) {
      args.push('--proxy', options.proxy);
    }

    // Rate limit: apply if user configured it in Settings
    if (options.rateLimit) {
      args.push('--limit-rate', options.rateLimit);
    }

    return args;
  }

  private parseProgress(data: string): DownloadProgress | null {
    const match = data.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)/);
    if (match) {
      return {
        percent: parseFloat(match[1]),
        totalSize: match[2],
        speed: match[3],
        eta: this.extractEta(data)
      };
    }

    // Also parse fragment-based progress for HLS/DASH
    const fragMatch = data.match(/\[download\]\s+Downloading fragment\s+(\d+)/);
    if (fragMatch) {
      return {
        percent: 0,
        totalSize: 'unknown',
        speed: 'downloading fragments...',
        eta: null
      };
    }

    return null;
  }

  private extractEta(data: string): string | null {
    const match = data.match(/ETA\s+(\d+:\d+)/);
    return match ? match[1] : null;
  }
}

interface DownloadOptions {
  format?: string;
  mergeFormat?: string;
  maxQuality?: boolean;
  downloadSubtitles?: boolean;
  embedMetadata?: boolean;
  cookiesFromBrowser?: string;
  proxy?: string;
  rateLimit?: string; // Ignored per build plan
}

interface DownloadProgress {
  percent: number;
  totalSize: string;
  speed: string;
  eta: string | null;
}
