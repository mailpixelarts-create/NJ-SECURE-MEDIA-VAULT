/**
 * Pinterest media downloader.
 * Supports pins with images and videos.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';

export class PinterestDownloader extends BaseSocialDownloader {
  constructor() {
    super('Pinterest');
  }

  canHandle(url: string): boolean {
    return /(?:www\.)?pinterest\.(com|ca|co\.uk|de|fr|jp)\/.+/i.test(url) ||
           /pin\.it\/.+/i.test(url);
  }

  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult> {
    const headers = this.buildHeaders(cookies);

    try {
      const pageData = await this.http.downloadToBuffer(url, headers);
      const html = pageData.toString();

      const mediaUrls: string[] = [];

      // Extract from og:image
      const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
      if (ogImageMatch) mediaUrls.push(ogImageMatch[1]);

      // Extract from og:video
      const ogVideoMatch = html.match(/property="og:video"\s+content="([^"]+)"/);
      if (ogVideoMatch) mediaUrls.push(ogVideoMatch[1]);

      // Extract from JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          if (ld.image) {
            const images = Array.isArray(ld.image) ? ld.image : [ld.image];
            mediaUrls.push(...images.map((img: any) => typeof img === 'string' ? img : img.url));
          }
        } catch {}
      }

      // Extract high-res image from Pinterest's data
      const highResMatch = html.match(/"orig":\s*\{\s*"url":\s*"([^"]+)"/);
      if (highResMatch) {
        mediaUrls.unshift(highResMatch[1]); // Add to front as preferred
      }

      // Extract author
      const authorMatch = html.match(/"owner":\s*\{[^}]*"name":\s*"([^"]+)"/);
      const author = authorMatch?.[1] || 'Unknown';

      // Extract title
      const titleMatch = html.match(/"title":\s*"([^"]{0,200})"/) ||
                         html.match(/property="og:title"\s+content="([^"]+)"/);
      const title = titleMatch?.[1] || 'Pinterest Pin';

      // Deduplicate
      const uniqueUrls = [...new Set(mediaUrls)];

      return {
        urls: uniqueUrls,
        title,
        author,
        platform: 'Pinterest',
        mediaType: mediaUrls.some(u => u.includes('video')) ? 'video' : 'image',
        metadata: {}
      };
    } catch (err: any) {
      throw new Error(`Failed to extract Pinterest media: ${err.message}`);
    }
  }
}
