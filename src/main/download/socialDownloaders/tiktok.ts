/**
 * TikTok media downloader.
 * Supports videos from TikTok posts.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';

export class TikTokDownloader extends BaseSocialDownloader {
  constructor() {
    super('TikTok');
  }

  canHandle(url: string): boolean {
    return /(?:www\.)?tiktok\.com\/.+/i.test(url) ||
           /vm\.tiktok\.com\/.+/i.test(url) ||
           /vt\.tiktok\.com\/.+/i.test(url);
  }

  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult> {
    const headers = this.buildHeaders(cookies);

    try {
      // Follow redirects to get final URL
      const pageData = await this.http.downloadToBuffer(url, headers);
      const html = pageData.toString();

      const mediaUrls: string[] = [];

      // Extract from og:video meta tag
      const ogVideoMatch = html.match(/property="og:video"\s+content="([^"]+)"/);
      if (ogVideoMatch) mediaUrls.push(ogVideoMatch[1]);

      // Extract from script data
      const scriptMatch = html.match(/"playAddr":\s*\[?\{[^}]*"src":\s*"([^"]+)"/);
      if (scriptMatch) {
        mediaUrls.push(scriptMatch[1].replace(/\\u002F/g, '/'));
      }

      // Fallback: extract video URL from JSON
      const videoMatch = html.match(/"downloadAddr":\s*"([^"]+)"/);
      if (videoMatch) {
        mediaUrls.push(videoMatch[1].replace(/\\u002F/g, '/'));
      }

      // Extract author
      const authorMatch = html.match(/"uniqueId":"([^"]+)"/) ||
                          html.match(/"nickname":"([^"]+)"/);
      const author = authorMatch?.[1] || 'Unknown';

      // Extract description
      const descMatch = html.match(/"desc":"([^"]{0,200})"/);
      const title = descMatch?.[1] || 'TikTok Video';

      return {
        urls: mediaUrls,
        title,
        author: `@${author}`,
        platform: 'TikTok',
        mediaType: 'video',
        metadata: {}
      };
    } catch (err: any) {
      throw new Error(`Failed to extract TikTok media: ${err.message}`);
    }
  }
}
