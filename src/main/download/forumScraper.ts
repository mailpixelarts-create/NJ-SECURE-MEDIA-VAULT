/**
 * Forum thread media scraper.
 * Supports vBulletin, phpBB, Discourse, XenForo, and generic forums.
 * Extracts images, videos, and attached files with pagination.
 */
import { EventEmitter } from 'events';
import { HttpDownloader } from './httpDownloader';

export interface ForumPost {
  id: string;
  author: string;
  date: string;
  images: string[];
  videos: string[];
  attachments: string[];
}

export interface ForumScrapeResult {
  url: string;
  forumType: string;
  title: string;
  totalPages: number;
  posts: ForumPost[];
  allMedia: string[];
}

export class ForumScraper extends EventEmitter {
  private static instance: ForumScraper;
  private http: HttpDownloader;

  // Detect forum type from URL patterns
  private readonly FORUM_PATTERNS: Record<string, RegExp> = {
    vBulletin: /showthread\.php|forumdisplay\.php/i,
    phpBB: /viewtopic\.php|viewforum\.php/i,
    Discourse: /\/t\/[^/]+\/\d+/i,
    XenForo: /\/threads\/[^/]+\.\d+|\/forums\/[^/]+\.\d+/i,
    MyBB: /\/thread-/i,
    Discuz: /\/thread-\d+/i,
  };

  private constructor() {
    super();
    this.http = HttpDownloader.getInstance();
  }

  static getInstance(): ForumScraper {
    if (!ForumScraper.instance) {
      ForumScraper.instance = new ForumScraper();
    }
    return ForumScraper.instance;
  }

  /**
   * Detect forum type from URL
   */
  detectForumType(url: string): string {
    for (const [type, pattern] of Object.entries(this.FORUM_PATTERNS)) {
      if (pattern.test(url)) return type;
    }
    return 'Generic';
  }

  /**
   * Scrape all media from a forum thread
   */
  async scrapeThread(
    url: string,
    options: {
      maxPages?: number;
      extractVideos?: boolean;
      extractImages?: boolean;
      cookies?: string;
      customHeaders?: Record<string, string>;
    } = {}
  ): Promise<ForumScrapeResult> {
    const maxPages = options.maxPages || 50;
    const extractImages = options.extractImages !== false;
    const extractVideos = options.extractVideos !== false;
    const forumType = this.detectForumType(url);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.customHeaders
    };

    if (options.cookies) {
      const cookieObj = this.parseCookies(options.cookies);
      headers['Cookie'] = Object.entries(cookieObj).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    const allPosts: ForumPost[] = [];
    const allMedia: string[] = [];
    let title = '';
    let totalPages = 1;

    // Generate page URLs
    const pageUrls = this.generatePageUrls(url, maxPages);

    for (let i = 0; i < pageUrls.length; i++) {
      this.emit('progress', { page: i + 1, totalPages: pageUrls.length });

      try {
        const pageData = await this.http.downloadToBuffer(pageUrls[i], headers);
        const html = pageData.toString();

        // Get title from first page
        if (i === 0) {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          title = titleMatch?.[1]?.trim() || 'Forum Thread';

          // Detect total pages
          totalPages = this.detectTotalPages(html, forumType);
        }

        // Extract posts from page
        const posts = this.extractPosts(html, forumType);
        allPosts.push(...posts);

        // Collect media URLs
        for (const post of posts) {
          if (extractImages) allMedia.push(...post.images);
          if (extractVideos) allMedia.push(...post.videos);
          allMedia.push(...post.attachments);
        }

        // Stop if we've reached the last page
        if (i + 1 >= totalPages) break;
      } catch (err: any) {
        this.emit('error', { page: i + 1, error: err.message });
        break;
      }
    }

    return {
      url,
      forumType,
      title,
      totalPages,
      posts: allPosts,
      allMedia: [...new Set(allMedia)] // Deduplicate
    };
  }

  /**
   * Generate page URLs for multi-page threads
   */
  private generatePageUrls(baseUrl: string, maxPages: number): string[] {
    const urls: string[] = [baseUrl];
    const separator = baseUrl.includes('?') ? '&' : '?';

    for (let page = 2; page <= maxPages; page++) {
      // Common pagination patterns
      urls.push(`${baseUrl}${separator}page=${page}`);
    }

    return urls;
  }

  /**
   * Detect total number of pages from HTML
   */
  private detectTotalPages(html: string, forumType: string): number {
    // Look for pagination links
    const pagePatterns = [
      /page-(\d+)/g,
      /page=(\d+)/g,
      /p=(\d+)/g,
      /\/(\d+)\/?$/g,
    ];

    let maxPage = 1;
    for (const pattern of pagePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const pageNum = parseInt(match[1], 10);
        if (pageNum > maxPage && pageNum < 1000) {
          maxPage = pageNum;
        }
      }
    }

    return maxPage;
  }

  /**
   * Extract posts and their media from HTML
   */
  private extractPosts(html: string, forumType: string): ForumPost[] {
    const posts: ForumPost[] = [];

    // Extract images
    const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images: string[] = [];
    let match;
    while ((match = imageRegex.exec(html)) !== null) {
      const url = match[1];
      if (this.isMediaUrl(url, 'image')) {
        images.push(this.resolveUrl(url, html));
      }
    }

    // Extract videos
    const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const videos: string[] = [];
    while ((match = videoRegex.exec(html)) !== null) {
      videos.push(this.resolveUrl(match[1], html));
    }

    // Extract iframe embeds (YouTube, Vimeo, etc.)
    const iframeRegex = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = iframeRegex.exec(html)) !== null) {
      const src = match[1];
      if (src.includes('youtube.com') || src.includes('vimeo.com') || src.includes('dailymotion.com')) {
        videos.push(src);
      }
    }

    // Extract attachments
    const attachRegex = /href=["']([^"']*(?:attachment|download)[^"']*)["']/gi;
    const attachments: string[] = [];
    while ((match = attachRegex.exec(html)) !== null) {
      attachments.push(this.resolveUrl(match[1], html));
    }

    // Create a single post with all found media (simplified)
    if (images.length > 0 || videos.length > 0 || attachments.length > 0) {
      posts.push({
        id: 'page-1',
        author: 'unknown',
        date: new Date().toISOString(),
        images: [...new Set(images)],
        videos: [...new Set(videos)],
        attachments: [...new Set(attachments)]
      });
    }

    return posts;
  }

  private isMediaUrl(url: string, type: 'image' | 'video'): boolean {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const videoExts = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.flv'];
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';

    if (type === 'image') return imageExts.some(e => ext.endsWith(e));
    if (type === 'video') return videoExts.some(e => ext.endsWith(e));
    return false;
  }

  private resolveUrl(url: string, _html: string): string {
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    // Relative URL - would need base URL to resolve properly
    return url;
  }

  private parseCookies(cookieStr: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieStr.split(';').forEach(cookie => {
      const [name, ...value] = cookie.trim().split('=');
      if (name) cookies[name.trim()] = value.join('=').trim();
    });
    return cookies;
  }
}
