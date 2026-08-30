/**
 * Social media downloader registry.
 * Provides a unified interface to download from any supported platform.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';
import { InstagramDownloader } from './instagram';
import { TwitterDownloader } from './twitter';
import { RedditDownloader } from './reddit';
import { TikTokDownloader } from './tiktok';
import { PinterestDownloader } from './pinterest';

export { SocialDownloadResult };

export class SocialDownloaderRegistry {
  private static instance: SocialDownloaderRegistry;
  private downloaders: BaseSocialDownloader[];

  private constructor() {
    this.downloaders = [
      new InstagramDownloader(),
      new TwitterDownloader(),
      new RedditDownloader(),
      new TikTokDownloader(),
      new PinterestDownloader(),
    ];
  }

  static getInstance(): SocialDownloaderRegistry {
    if (!SocialDownloaderRegistry.instance) {
      SocialDownloaderRegistry.instance = new SocialDownloaderRegistry();
    }
    return SocialDownloaderRegistry.instance;
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): string[] {
    return this.downloaders.map(d => d.getPlatform());
  }

  /**
   * Find the right downloader for a URL
   */
  findDownloader(url: string): BaseSocialDownloader | null {
    return this.downloaders.find(d => d.canHandle(url)) || null;
  }

  /**
   * Extract media from a URL using the appropriate downloader
   */
  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult | null> {
    const downloader = this.findDownloader(url);
    if (!downloader) return null;
    return downloader.extractMedia(url, cookies);
  }

  /**
   * Check if a URL is supported
   */
  isSupported(url: string): boolean {
    return this.findDownloader(url) !== null;
  }

  /**
   * Register a custom downloader
   */
  register(downloader: BaseSocialDownloader): void {
    this.downloaders.push(downloader);
  }
}
