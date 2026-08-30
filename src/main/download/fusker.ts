/**
 * Fusker link expander.
 * Expands URL patterns like:
 *   http://site.com/img[001-100].jpg
 *   http://site.com/photo{1..50}.png
 *   http://site.com/page=1-100&img.jpg
 */

export interface FuskerPattern {
  prefix: string;
  start: number;
  end: number;
  padding: number;
  suffix: string;
  separator: string;
}

export class FuskerExpander {
  /**
   * Check if a URL contains a fusker pattern
   */
  static hasPattern(url: string): boolean {
    return /\[[\d]+-[\d]+\]|\{[\d]+\.\.[\d]+\}/.test(url);
  }

  /**
   * Parse a URL pattern into a FuskerPattern
   */
  static parsePattern(url: string): FuskerPattern | null {
    // Match [start-end] pattern
    const bracketMatch = url.match(/(.*?)\[(\d+)-(\d+)\](.*)/);
    if (bracketMatch) {
      const start = parseInt(bracketMatch[2], 10);
      const end = parseInt(bracketMatch[3], 10);
      return {
        prefix: bracketMatch[1],
        start,
        end,
        padding: bracketMatch[2].length,
        suffix: bracketMatch[4],
        separator: 'bracket'
      };
    }

    // Match {start..end} pattern
    const braceMatch = url.match(/(.*?)\{(\d+)\.\.(\d+)\}(.*)/);
    if (braceMatch) {
      const start = parseInt(braceMatch[2], 10);
      const end = parseInt(braceMatch[3], 10);
      return {
        prefix: braceMatch[1],
        start,
        end,
        padding: braceMatch[2].length,
        suffix: braceMatch[4],
        separator: 'brace'
      };
    }

    return null;
  }

  /**
   * Expand a URL pattern into individual URLs
   */
  static expand(url: string): string[] {
    const pattern = this.parsePattern(url);
    if (!pattern) return [url];

    const urls: string[] = [];
    for (let i = pattern.start; i <= pattern.end; i++) {
      const num = String(i).padStart(pattern.padding, '0');
      urls.push(`${pattern.prefix}${num}${pattern.suffix}`);
    }
    return urls;
  }

  /**
   * Expand multiple URLs, handling mixed patterns
   */
  static expandAll(urls: string[]): string[] {
    const expanded: string[] = [];
    for (const url of urls) {
      expanded.push(...this.expand(url));
    }
    return expanded;
  }

  /**
   * Generate a URL pattern from a list of URLs (auto-detect pattern)
   */
  static detectPattern(urls: string[]): FuskerPattern | null {
    if (urls.length < 2) return null;

    // Find common prefix/suffix
    let prefix = urls[0];
    for (const url of urls) {
      let i = 0;
      while (i < prefix.length && i < url.length && prefix[i] === url[i]) {
        i++;
      }
      prefix = prefix.substring(0, i);
    }

    let suffix = urls[0];
    for (const url of urls) {
      let i = 0;
      while (
        i < suffix.length &&
        i < url.length &&
        suffix[suffix.length - 1 - i] === url[url.length - 1 - i]
      ) {
        i++;
      }
      suffix = suffix.substring(suffix.length - i);
    }

    // Extract numbers from the varying part
    const numbers: number[] = [];
    for (const url of urls) {
      const middle = url.substring(prefix.length, url.length - suffix.length);
      const num = parseInt(middle, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }

    if (numbers.length < 2) return null;

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const padding = String(numbers[0]).length;

    return {
      prefix,
      start: min,
      end: max,
      padding,
      suffix,
      separator: 'bracket'
    };
  }

  /**
   * Format a pattern back to a URL string
   */
  static formatPattern(pattern: FuskerPattern): string {
    return `${pattern.prefix}[${String(pattern.start).padStart(pattern.padding, '0')}-${String(pattern.end).padStart(pattern.padding, '0')}]${pattern.suffix}`;
  }

  /**
   * Estimate total count from pattern
   */
  static estimateCount(url: string): number {
    const pattern = this.parsePattern(url);
    if (!pattern) return 1;
    return pattern.end - pattern.start + 1;
  }
}
