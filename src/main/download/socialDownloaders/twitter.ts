/**
 * Twitter/X media downloader.
 * Supports tweets with images and videos.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';

export class TwitterDownloader extends BaseSocialDownloader {
  constructor() {
    super('Twitter');
  }

  canHandle(url: string): boolean {
    return /(?:www\.)?(?:twitter\.com|x\.com)\/.+/i.test(url);
  }

  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult> {
    const headers = this.buildHeaders(cookies);
    const mediaUrls: string[] = [];

    try {
      // Get the tweet page
      const pageData = await this.http.downloadToBuffer(url, headers);
      const html = pageData.toString();

      // Extract tweet ID from URL
      const tweetIdMatch = url.match(/status(?:\/|%2F)(\d+)/);
      const tweetId = tweetIdMatch?.[1];

      // Extract from meta tags
      const ogVideoMatch = html.match(/property="og:video"\s+content="([^"]+)"/);
      if (ogVideoMatch) mediaUrls.push(ogVideoMatch[1]);

      const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
      if (ogImageMatch) mediaUrls.push(ogImageMatch[1]);

      // Extract from embedded JSON
      const jsonDataMatch = html.match(/"mediaDetails":\s*(\[.*?\])/s);
      if (jsonDataMatch) {
        try {
          const mediaDetails = JSON.parse(jsonDataMatch[1]);
          for (const media of mediaDetails) {
            if (media.type === 'video' || media.type === 'animated_gif') {
              const variants = media.video_info?.variants || [];
              const mp4 = variants
                .filter((v: any) => v.content_type === 'video/mp4')
                .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
              if (mp4.length > 0) mediaUrls.push(mp4[0].url);
            } else if (media.type === 'photo') {
              mediaUrls.push(media.media_url_https);
            }
          }
        } catch {}
      }

      // Extract author
      const authorMatch = html.match(/"screen_name":"([^"]+)"/);
      const author = authorMatch?.[1] || 'Unknown';

      // Extract text
      const textMatch = html.match(/"full_text":"([^"]{0,200})"/);
      const title = textMatch?.[1] || 'Twitter Post';

      return {
        urls: mediaUrls,
        title,
        author: `@${author}`,
        platform: 'Twitter',
        mediaType: mediaUrls.some(u => u.includes('video') || u.includes('tweet_video')) ? 'video' : 'image',
        metadata: { tweetId }
      };
    } catch (err: any) {
      throw new Error(`Failed to extract Twitter media: ${err.message}`);
    }
  }
}
