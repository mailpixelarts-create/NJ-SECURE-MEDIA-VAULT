import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { EventEmitter } from 'events';

// Add stealth plugin to bypass Cloudflare/CAPTCHAs
chromium.use(stealth());

/**
 * UNRESTRICTED STEALTH SCRAPER.
 *
 * Zero politeness middleware. Zero rate limiting. Zero depth limits.
 * Concurrency set to max (30 simultaneous connections).
 * Recursive crawling without depth limits unless manually specified.
 */
export class StealthScraper extends EventEmitter {
  private static instance: StealthScraper;
  private maxConcurrency = 30;

  private constructor() {
    super();
  }

  static getInstance(): StealthScraper {
    if (!StealthScraper.instance) {
      StealthScraper.instance = new StealthScraper();
    }
    return StealthScraper.instance;
  }

  /**
   * Set max concurrent browser contexts (default 30).
   */
  setMaxConcurrency(n: number): void {
    this.maxConcurrency = Math.max(1, Math.min(n, 50));
  }

  /**
   * Scrape ALL images from a page — no throttling, no polite delay.
   * Extracts: <img src>, <img data-src>, <img data-original>,
   *           <source srcset>, CSS background-image, meta og:image.
   */
  async scrapeImages(url: string, proxy?: string): Promise<string[]> {
    const browser = await this.launchBrowser(proxy);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // No waitUntil: 'networkidle' — just domcontentloaded for speed
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Scroll to bottom to trigger lazy-loaded images
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 50); // Fast scroll — no polite delay
        });
      });

      // Extract ALL possible image sources
      const images = await page.evaluate(() => {
        const srcs: string[] = [];

        // <img> tags — src, data-src, data-original, data-lazy-src
        document.querySelectorAll('img').forEach(img => {
          for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-zoom-src']) {
            const val = img.getAttribute(attr);
            if (val && val.startsWith('http')) srcs.push(val);
          }
          // srcset — grab all URLs
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            srcset.split(',').forEach(part => {
              const url = part.trim().split(/\s+/)[0];
              if (url && url.startsWith('http')) srcs.push(url);
            });
          }
        });

        // <source srcset>
        document.querySelectorAll('source').forEach(source => {
          const srcset = source.getAttribute('srcset');
          if (srcset) {
            srcset.split(',').forEach(part => {
              const url = part.trim().split(/\s+/)[0];
              if (url && url.startsWith('http')) srcs.push(url);
            });
          }
        });          // <a> tags linking to images
          Array.from(document.querySelectorAll('a[href]')).forEach(a => {
            const href = a.getAttribute('href') || '';
            if (/\.(jpe?g|png|gif|webp|bmp|tiff|avif|svg|ico)(\?|$)/i.test(href) && href.startsWith('http')) {
              srcs.push(href);
            }
          });          // <div> and <span> background-image CSS
          Array.from(document.querySelectorAll('[style]')).forEach(el => {
            const style = el.getAttribute('style') || '';
            const bgMatch = style.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
            if (bgMatch) srcs.push(bgMatch[1]);
          });          // <meta property="og:image">
          Array.from(document.querySelectorAll('meta[property="og:image"]')).forEach(meta => {
            const content = meta.getAttribute('content');
            if (content && content.startsWith('http')) srcs.push(content);
          });

          // <link rel="image_src">
          Array.from(document.querySelectorAll('link[rel="image_src"]')).forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('http')) srcs.push(href);
          });

        return srcs;
      });

      await browser.close();
      return [...new Set(images)]; // Deduplicate
    } catch (error) {
      await browser.close();
      console.error('Scraping failed:', error);
      return [];
    }
  }

  /**
   * Recursively scrape images from a page AND all linked pages.
   * No depth limit unless maxDepth is specified.
   * Uses maxConcurrency parallel browser contexts.
   */
  async scrapeGallery(
    url: string,
    options: { proxy?: string; maxDepth?: number; maxPages?: number } = {}
  ): Promise<string[]> {
    const { proxy, maxDepth, maxPages = 1000 } = options;
    const visited = new Set<string>();
    const allImages = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url, depth: 0 }];

    while (queue.length > 0 && visited.size < maxPages) {
      // Process up to maxConcurrency pages simultaneously
      const batch = queue.splice(0, this.maxConcurrency);

      const results = await Promise.allSettled(
        batch.map(async ({ url: pageUrl, depth }) => {
          if (visited.has(pageUrl)) return [];
          if (maxDepth !== undefined && depth > maxDepth) return [];

          visited.add(pageUrl);
          const images = await this.scrapeImages(pageUrl, proxy);

          // Find linked pages on the same domain for recursive crawling
          try {
            const domain = new URL(pageUrl).hostname;
            const linkedPages = await this.extractLinks(pageUrl, proxy);

            for (const linked of linkedPages) {
              try {
                if (new URL(linked).hostname === domain && !visited.has(linked)) {
                  queue.push({ url: linked, depth: depth + 1 });
                }
              } catch {}
            }
          } catch {}

          return images;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          result.value.forEach(img => allImages.add(img));
        }
      }
    }

    return [...allImages];
  }

  /**
   * Extract all links from a page for recursive crawling.
   */
  async extractLinks(url: string, proxy?: string): Promise<string[]> {
    const browser = await this.launchBrowser(proxy);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter((href): href is string => !!href && href.startsWith('http'));
      });

      await browser.close();
      return [...new Set(links)];
    } catch {
      await browser.close();
      return [];
    }
  }

  /**
   * Scrape forum thread — extract all media from every post.
   * Supports vBulletin, phpBB, XenForo, Discourse, generic.
   */
  async scrapeForum(
    url: string,
    options: { proxy?: string; maxPages?: number } = {}
  ): Promise<{ images: string[]; videos: string[]; attachments: string[] }> {
    const { proxy, maxPages = 100 } = options;
    const images = new Set<string>();
    const videos = new Set<string>();
    const attachments = new Set<string>();
    const visited = new Set<string>();
    let currentUrl: string | null = url;
    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      if (visited.has(currentUrl)) break;
      visited.add(currentUrl);
      pageCount++;

      const browser = await this.launchBrowser(proxy);
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

        const media = await page.evaluate(() => {
          const imgs: string[] = [];
          const vids: string[] = [];
          const atts: string[] = [];

          // All images (avatars, post images, thumbnails)
          document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src');
            if (src && src.startsWith('http') && !src.includes('avatar') && !src.includes('icon')) {
              imgs.push(src);
            }
          });

          // Video sources
          document.querySelectorAll('video source, video[src]').forEach(el => {
            const src = el.getAttribute('src');
            if (src && src.startsWith('http')) vids.push(src);
          });

          // Iframe embeds (YouTube, etc.)
          document.querySelectorAll('iframe[src]').forEach(el => {
            const src = el.getAttribute('src');
            if (src && (src.includes('youtube') || src.includes('vimeo') || src.includes('dailymotion'))) {
              vids.push(src);
            }
          });

          // Attachment links
          document.querySelectorAll('a[href*="attachment"], a[href*="download"]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && href.startsWith('http')) atts.push(href);
          });

          return { imgs, vids, atts };
        });

        media.imgs.forEach(img => images.add(img));
        media.vids.forEach(vid => videos.add(vid));
        media.atts.forEach(att => attachments.add(att));

        // Find "Next Page" link
        currentUrl = await page.evaluate(() => {
          const nextLinks = Array.from(document.querySelectorAll(
            'a[class*="next"], a[rel="next"], .pagination a:last-child, a:has(> .next)'
          ));
          for (const link of nextLinks) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('http')) return href;
          }
          return null;
        });
      } catch (error) {
        console.error(`Forum scrape error on ${currentUrl}:`, error);
      } finally {
        await browser.close();
      }
    }

    return {
      images: [...new Set(images)],
      videos: [...new Set(videos)],
      attachments: [...new Set(attachments)]
    };
  }

  /**
   * Launch a stealth browser — no launch delays.
   */
  private async launchBrowser(proxy?: string) {
    const options: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        `--max-concurrent-font-loading=30`,
      ]
    };

    if (proxy) {
      options.proxy = { server: proxy };
    }

    return chromium.launch(options);
  }
}
