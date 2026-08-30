/**
 * Instagram media downloader.
 * Supports posts, reels, stories, and profile media.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';

export class InstagramDownloader extends BaseSocialDownloader {
  constructor() {
    super('Instagram');
  }

  canHandle(url: string): boolean {
    return /(?:www\.)?instagram\.com\/.+/i.test(url) ||
           /instagr\.am\/.+/i.test(url);
  }

  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult> {
    const headers = this.buildHeaders(cookies);

    // Normalize URL
    const normalizedUrl = url.split('?')[0].replace(/\/$/, '');

    try {
      // Use oembed API for basic info
      const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(normalizedUrl)}`;
      const oembedData = await this.http.downloadToBuffer(oembedUrl, headers);
      const oembed = JSON.parse(oembedData.toString());

      // Extract from HTML content
      const htmlUrl = `https://www.instagram.com/p/${normalizedUrl.split('/p/')[1]?.split('/')[0] || ''}/?__a=1&__d=dis`;
      const mediaUrls: string[] = [];

      try {
        const apiData = await this.http.downloadToBuffer(htmlUrl, headers);
        const data = JSON.parse(apiData.toString());

        // Extract from graphql response
        const media = data?.graphql?.shortcode_media ||
                      data?.items?.[0];

        if (media) {
          // Carousel posts
          if (media.carousel_media) {
            for (const item of media.carousel_media) {
              if (item.video_versions?.[0]?.url) {
                mediaUrls.push(item.video_versions[0].url);
              } else if (item.image_versions2?.candidates?.[0]?.url) {
                mediaUrls.push(item.image_versions2.candidates[0].url);
              }
            }
          }
          // Single video
          else if (media.video_versions?.[0]?.url) {
            mediaUrls.push(media.video_versions[0].url);
          }
          // Single image
          else if (media.image_versions2?.candidates?.[0]?.url) {
            mediaUrls.push(media.image_versions2.candidates[0].url);
          }
        }
      } catch {
        // Fallback: try to extract from page HTML
        const pageData = await this.http.downloadToBuffer(normalizedUrl, headers);
        const html = pageData.toString();

        // Extract image URLs from meta tags
        const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
        if (ogImageMatch) mediaUrls.push(ogImageMatch[1]);

        const ogVideoMatch = html.match(/property="og:video"\s+content="([^"]+)"/);
        if (ogVideoMatch) mediaUrls.push(ogVideoMatch[1]);
      }

      return {
        urls: mediaUrls,
        title: oembed.title || 'Instagram Post',
        author: oembed.author_name || 'Unknown',
        platform: 'Instagram',
        mediaType: mediaUrls.some(u => u.includes('video')) ? 'video' : 'image',
        metadata: {
          thumbnail: oembed.thumbnail_url,
          width: oembed.thumbnail_width,
          height: oembed.thumbnail_height,
        }
      };
    } catch (err: any) {
      throw new Error(`Failed to extract Instagram media: ${err.message}`);
    }
  }
}
