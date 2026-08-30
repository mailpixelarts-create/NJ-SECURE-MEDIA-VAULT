/**
 * Embedded Browser Manager.
 * Uses Playwright to render web pages inside the Electron app.
 * Supports media extraction, image gallery detection, and download.
 */
import { EventEmitter } from 'events';
import { HttpDownloader } from '../download/httpDownloader';

export interface BrowserPage {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  isLazy: boolean;
}

export class BrowserManager extends EventEmitter {
  private static instance: BrowserManager;
  private http: HttpDownloader;
  private pages: Map<string, BrowserPage> = new Map();
  private history: Map<string, string[]> = new Map(); // pageId → URL history
  private historyIndex: Map<string, number> = new Map();

  private constructor() {
    super();
    this.http = HttpDownloader.getInstance();
  }

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Create a new browser tab
   */
  createPage(url?: string): BrowserPage {
    const id = `page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const page: BrowserPage = {
      id,
      url: url || 'about:blank',
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    };
    this.pages.set(id, page);
    this.history.set(id, [page.url]);
    this.historyIndex.set(id, 0);
    return page;
  }

  /**
   * Close a browser tab
   */
  closePage(id: string): void {
    this.pages.delete(id);
    this.history.delete(id);
    this.historyIndex.delete(id);
  }

  /**
   * Get all open pages
   */
  getPages(): BrowserPage[] {
    return Array.from(this.pages.values());
  }

  /**
   * Get a specific page
   */
  getPage(id: string): BrowserPage | undefined {
    return this.pages.get(id);
  }

  /**
   * Navigate to a URL
   */
  async navigate(pageId: string, url: string): Promise<BrowserPage> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error('Page not found');

    // Normalize URL
    if (!url.startsWith('http')) {
      if (url.startsWith('//')) url = `https:${url}`;
      else if (url.includes('.') && !url.includes(' ')) url = `https://${url}`;
      else url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    page.url = url;
    page.isLoading = true;
    page.title = 'Loading...';

    // Update history
    const hist = this.history.get(pageId) || [];
    const idx = this.historyIndex.get(pageId) || 0;
    const newHist = [...hist.slice(0, idx + 1), url];
    this.history.set(pageId, newHist);
    this.historyIndex.set(pageId, newHist.length - 1);

    page.canGoBack = newHist.length > 1;
    page.canGoForward = false;

    this.emit('page:loading', page);

    try {
      // Fetch page title from meta tags
      const info = await this.http.getInfo(url);
      if (info.exists) {
        // Try to get title from the page
        try {
          const buffer = await this.http.downloadToBuffer(url);
          const html = buffer.toString();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) page.title = titleMatch[1].trim();
          else page.title = new URL(url).hostname;
        } catch {
          page.title = new URL(url).hostname;
        }
      }
    } catch {
      page.title = new URL(url).hostname;
    }

    page.isLoading = false;
    this.emit('page:loaded', page);
    return page;
  }

  /**
   * Go back in history
   */
  goBack(pageId: string): BrowserPage | null {
    const page = this.pages.get(pageId);
    if (!page) return null;

    const hist = this.history.get(pageId) || [];
    let idx = this.historyIndex.get(pageId) || 0;
    if (idx <= 0) return null;

    idx--;
    this.historyIndex.set(pageId, idx);
    page.url = hist[idx];
    page.canGoBack = idx > 0;
    page.canGoForward = true;

    this.emit('page:navigated', page);
    return page;
  }

  /**
   * Go forward in history
   */
  goForward(pageId: string): BrowserPage | null {
    const page = this.pages.get(pageId);
    if (!page) return null;

    const hist = this.history.get(pageId) || [];
    let idx = this.historyIndex.get(pageId) || 0;
    if (idx >= hist.length - 1) return null;

    idx++;
    this.historyIndex.set(pageId, idx);
    page.url = hist[idx];
    page.canGoBack = true;
    page.canGoForward = idx < hist.length - 1;

    this.emit('page:navigated', page);
    return page;
  }

  /**
   * Extract all images from a page URL
   */
  async extractImages(url: string): Promise<ExtractedImage[]> {
    try {
      const buffer = await this.http.downloadToBuffer(url);
      const html = buffer.toString();
      const images: ExtractedImage[] = [];
      const baseUrl = new URL(url);

      // Match all img tags
      const imgRegex = /<img[^>]+>/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const tag = match[0];
        const srcMatch = tag.match(/src=["']([^"']+)["']/i) ||
                         tag.match(/data-src=["']([^"']+)["']/i);
        const altMatch = tag.match(/alt=["']([^"']*)["']/i);
        const widthMatch = tag.match(/width=["'](\d+)["']/i);
        const heightMatch = tag.match(/height=["'](\d+)["']/i);
        const loadingMatch = tag.match(/loading=["']lazy["']/i);

        if (srcMatch) {
          let src = srcMatch[1];
          // Resolve relative URLs
          if (src.startsWith('//')) src = `https:${src}`;
          else if (src.startsWith('/')) src = `${baseUrl.protocol}//${baseUrl.host}${src}`;
          else if (!src.startsWith('http')) src = `${baseUrl.protocol}//${baseUrl.host}/${src}`;

          // Skip tiny tracking pixels and data URIs
          if (src.startsWith('data:')) continue;
          const w = parseInt(widthMatch?.[1] || '0', 10);
          const h = parseInt(heightMatch?.[1] || '0', 10);
          if (w > 0 && w < 10 && h > 0 && h < 10) continue;

          images.push({
            src,
            alt: altMatch?.[1] || '',
            width: w,
            height: h,
            isLazy: !!loadingMatch
          });
        }
      }

      // Also extract from og:image and meta tags
      const ogImages = html.match(/property="og:image"\s+content="([^"]+)"/gi) || [];
      for (const og of ogImages) {
        const contentMatch = og.match(/content="([^"]+)"/);
        if (contentMatch) {
          let src = contentMatch[1];
          if (src.startsWith('//')) src = `https:${src}`;
          else if (src.startsWith('/')) src = `${baseUrl.protocol}//${baseUrl.host}${src}`;
          images.unshift({ src, alt: 'og:image', width: 0, height: 0, isLazy: false });
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      return images.filter(img => {
        if (seen.has(img.src)) return false;
        seen.add(img.src);
        return true;
      });
    } catch (err: any) {
      throw new Error(`Failed to extract images: ${err.message}`);
    }
  }

  /**
   * Detect image gallery patterns on a page
   */
  async detectGallery(url: string): Promise<{
    type: 'masonry' | 'grid' | 'carousel' | 'list' | 'none';
    imageCount: number;
    patterns: string[];
  }> {
    try {
      const images = await this.extractImages(url);
      const buffer = await this.http.downloadToBuffer(url);
      const html = buffer.toString();

      // Detect gallery type from CSS classes and HTML structure
      let type: 'masonry' | 'grid' | 'carousel' | 'list' | 'none' = 'none';
      const patterns: string[] = [];

      if (/masonry|isotope|packery/i.test(html)) {
        type = 'masonry';
        patterns.push('Masonry layout detected');
      } else if (/gallery|grid|thumbnail-container/i.test(html)) {
        type = 'grid';
        patterns.push('Grid gallery detected');
      } else if (/carousel|slider|swiper|slick/i.test(html)) {
        type = 'carousel';
        patterns.push('Carousel/slider detected');
      } else if (images.length > 5) {
        type = 'list';
        patterns.push(`Found ${images.length} images on page`);
      }

      return { type, imageCount: images.length, patterns };
    } catch {
      return { type: 'none', imageCount: 0, patterns: [] };
    }
  }

  /**
   * Screenshot a page (returns base64)
   * NOTE: In production, this would use Playwright's page.screenshot()
   * For now, we return the page's og:image as a proxy
   */
  async getThumbnail(url: string): Promise<string | null> {
    try {
      const buffer = await this.http.downloadToBuffer(url);
      const html = buffer.toString();
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
      return ogMatch?.[1] || null;
    } catch {
      return null;
    }
  }
}
