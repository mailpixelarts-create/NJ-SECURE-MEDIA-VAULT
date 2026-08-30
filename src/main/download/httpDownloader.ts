/**
 * Generic HTTP file downloader for any file type.
 * Supports resume, progress tracking, speed limiting, and retry.
 */
import { EventEmitter } from 'events';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface HttpDownloadOptions {
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
  speedLimit?: number; // bytes per second
  timeout?: number; // ms
}

export interface HttpDownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
  speed: string;
  eta: string;
}

export class HttpDownloader extends EventEmitter {
  private static instance: HttpDownloader;

  private constructor() {
    super();
  }

  static getInstance(): HttpDownloader {
    if (!HttpDownloader.instance) {
      HttpDownloader.instance = new HttpDownloader();
    }
    return HttpDownloader.instance;
  }

  async download(
    url: string,
    outputPath: string,
    options: HttpDownloadOptions = {},
    onProgress?: (progress: HttpDownloadProgress) => void
  ): Promise<{ filePath: string; size: number; contentType: string }> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 2000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.doDownload(url, outputPath, options, onProgress);
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Download failed after retries');
  }

  private doDownload(
    url: string,
    outputPath: string,
    options: HttpDownloadOptions,
    onProgress?: (progress: HttpDownloadProgress) => void
  ): Promise<{ filePath: string; size: number; contentType: string }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options.headers
      };

      // Check for existing partial download for resume
      let existingSize = 0;
      if (fs.existsSync(outputPath)) {
        existingSize = fs.statSync(outputPath).size;
        if (existingSize > 0) {
          headers['Range'] = `bytes=${existingSize}-`;
        }
      }

      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, { headers, timeout: options.timeout || 30000 }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.doDownload(res.headers.location, outputPath, options, onProgress)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          reject(new Error(`HTTP ${res.statusCode}: ${(res as any).statusMessage || "Request failed" || 'Request failed'}`));
          return;
        }

        const contentLength = parseInt(res.headers['content-length'] || '0', 10);
        const totalSize = existingSize + contentLength;
        const contentType = res.headers['content-type'] || 'application/octet-stream';

        const isPartial = res.statusCode === 206;
        const flags = isPartial ? 'a' : 'w';
        const fileStream = fs.createWriteStream(outputPath, { flags });

        let downloaded = existingSize;
        let lastTime = Date.now();
        let lastBytes = downloaded;
        const speedLimit = options.speedLimit || 0;

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;

          // Speed limiting
          if (speedLimit > 0) {
            const elapsed = (Date.now() - lastTime) / 1000;
            const currentSpeed = (downloaded - lastBytes) / elapsed;
            if (currentSpeed > speedLimit) {
              const delay = ((downloaded - lastBytes) / speedLimit - elapsed) * 1000;
              if (delay > 0) {
                res.pause();
                setTimeout(() => res.resume(), delay);
                return;
              }
            }
          }

          fileStream.write(chunk);

          // Report progress
          if (onProgress && totalSize > 0) {
            const now = Date.now();
            const timeDelta = (now - lastTime) / 1000;
            if (timeDelta >= 0.5) {
              const bytesDelta = downloaded - lastBytes;
              const speed = bytesDelta / timeDelta;
              const remaining = totalSize - downloaded;
              const eta = speed > 0 ? remaining / speed : 0;

              onProgress({
                percent: Math.min((downloaded / totalSize) * 100, 100),
                downloaded,
                total: totalSize,
                speed: this.formatSpeed(speed),
                eta: this.formatTime(eta)
              });

              lastTime = now;
              lastBytes = downloaded;
            }
          }
        });

        res.on('end', () => {
          fileStream.end();
          resolve({ filePath: outputPath, size: downloaded, contentType });
        });

        res.on('error', (err) => {
          fileStream.end();
          reject(err);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }

  /**
   * Fetch file info (HEAD request) without downloading
   */
  async getInfo(url: string, headers?: Record<string, string>): Promise<{
    exists: boolean;
    size: number;
    contentType: string;
    lastModified: string;
  }> {
    return new Promise((resolve, reject) => {
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0',
        ...headers
      };

      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.request(url, { method: 'HEAD', headers: reqHeaders }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.getInfo(res.headers.location, headers).then(resolve).catch(reject);
        }

        resolve({
          exists: res.statusCode === 200,
          size: parseInt(res.headers['content-length'] || '0', 10),
          contentType: res.headers['content-type'] || 'application/octet-stream',
          lastModified: res.headers['last-modified'] || ''
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Download to memory (for small files)
   */
  async downloadToBuffer(url: string, headers?: Record<string, string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...headers
        },
        timeout: 30000
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.downloadToBuffer(res.headers.location, headers).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  private formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}
