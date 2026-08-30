/**
 * Reddit media downloader.
 * Supports posts with images, galleries, and videos.
 */
import { BaseSocialDownloader, SocialDownloadResult } from './base';

export class RedditDownloader extends BaseSocialDownloader {
  constructor() {
    super('Reddit');
  }

  canHandle(url: string): boolean {
    return /(?:www\.)?reddit\.com\/.+/i.test(url) ||
           /redd\.it\/.+/i.test(url);
  }

  async extractMedia(url: string, cookies?: string): Promise<SocialDownloadResult> {
    const headers = this.buildHeaders(cookies);
    headers['Accept'] = 'application/json';

    try {
      // Convert to JSON API URL
      let apiUrl = url;
      if (!url.endsWith('.json')) {
        apiUrl = url.replace(/\/$/, '') + '.json';
      }

      const data = await this.http.downloadToBuffer(apiUrl, headers);
      const json = JSON.parse(data.toString());

      const post = json[0]?.data?.children?.[0]?.data;
      if (!post) throw new Error('Could not parse Reddit post');

      const mediaUrls: string[] = [];

      // Gallery posts
      if (post.is_gallery && post.media_metadata) {
        for (const [id, media] of Object.entries(post.media_metadata) as any[]) {
          if (media.s?.u) {
            mediaUrls.push(media.s.u.replace(/&amp;/g, '&'));
          } else if (media.video_fallback_url) {
            mediaUrls.push(media.video_fallback_url);
          }
        }
      }
      // Single image
      else if (post.preview?.images?.[0]?.source?.url) {
        mediaUrls.push(post.preview.images[0].source.url.replace(/&amp;/g, '&'));
      }
      // Video
      else if (post.is_video && post.media?.reddit_video?.fallback_url) {
        mediaUrls.push(post.media.reddit_video.fallback_url);
      }
      // External URL (imgur, etc.)
      else if (post.url && !post.url.includes('reddit.com')) {
        mediaUrls.push(post.url);
      }

      return {
        urls: mediaUrls,
        title: post.title || 'Reddit Post',
        author: post.author || 'Unknown',
        platform: 'Reddit',
        mediaType: post.is_video ? 'video' : 'image',
        metadata: {
          subreddit: post.subreddit,
          score: post.score,
          numComments: post.num_comments,
          permalink: post.permalink,
        }
      };
    } catch (err: any) {
      throw new Error(`Failed to extract Reddit media: ${err.message}`);
    }
  }
}
