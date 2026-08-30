/**
 * Base class for social media downloaders.
 * Provides common interface for all social platform downloaders.
 */
import { EventEmitter } from 'events';
import { HttpDownloader } from '../httpDownloader';

export interface SocialDownloadResult {
  urls: string[];
  title?: string;
  author?: string;
  platform: string;
  mediaType: 'image' | 'video' | 'audio' | 'mixed';
  metadata?: Record<string, any>;
}

export abstract class BaseSocialDownloader extends EventEmitter {
  protected http: HttpDownloader;
  protected platform: string;

  constructor(platform: string) {
    super();
    this.platform = platform;
    this.http = HttpDownloader.getInstance();
  }

  /**
   * Check if this downloader can handle the URL
   */
  abstract canHandle(url: string): boolean;

  /**
   * Extract media URLs from the given page URL
   */
  abstract extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult>;

  /**
   * Get the platform name
   */
  getPlatform(): string {
    return this.platform;
  }

  /**
   * Create a cookie header from cookie string
   */
  protected parseCookies(cookieStr: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieStr.split(';').forEach(cookie => {
      const [name, ...value] = cookie.trim().split('=');
      if (name) cookies[name.trim()] = value.join('=').trim();
    });
    return cookies;
  }

  /**
   * Build headers with cookies
   */
  protected buildHeaders(cookies?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    if (cookies) {
      const cookieObj = this.parseCookies(cookies);
      const cookieStr = Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      headers['Cookie'] = cookieStr;
    }

    return headers;
  }
}
