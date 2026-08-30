/**
 * Template Manager for download settings.
 * Manages templates that define optimal download settings for popular websites.
 */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface DownloadTemplate {
  id: string;
  name: string;
  description: string;
  domain: string;
  urlPattern: string;
  authType: 'none' | 'cookies' | 'username' | 'oauth';
  mediaTypes: ('image' | 'video' | 'audio')[];
  selectors?: {
    images?: string[];
    videos?: string[];
    thumbnails?: string[];
  };
  settings: {
    quality?: string;
    format?: string;
    rateLimit?: string;
    concurrency?: number;
    respectRobots?: boolean;
    waitForSelector?: string;
    scrollToLoad?: boolean;
  };
  isBuiltIn: boolean;
}

export class TemplateManager {
  private static instance: TemplateManager;
  private templates: DownloadTemplate[] = [];
  private templatesPath: string;

  private constructor() {
    this.templatesPath = path.join(app.getPath('userData'), 'templates.json');
    this.loadBuiltInTemplates();
    this.loadCustomTemplates();
  }

  static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  private loadBuiltInTemplates(): void {
    this.templates = [...BUILT_IN_TEMPLATES];
  }

  private loadCustomTemplates(): void {
    try {
      if (fs.existsSync(this.templatesPath)) {
        const data = JSON.parse(fs.readFileSync(this.templatesPath, 'utf-8'));
        this.templates.push(...data.filter((t: DownloadTemplate) => !t.isBuiltIn));
      }
    } catch {}
  }

  private saveCustomTemplates(): void {
    try {
      const custom = this.templates.filter(t => !t.isBuiltIn);
      fs.writeFileSync(this.templatesPath, JSON.stringify(custom, null, 2));
    } catch (err) {
      console.error('Failed to save templates:', err);
    }
  }

  getAll(): DownloadTemplate[] {
    return [...this.templates];
  }

  getById(id: string): DownloadTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  getByDomain(domain: string): DownloadTemplate | undefined {
    return this.templates.find(t =>
      domain.includes(t.domain) || t.domain.includes(domain)
    );
  }

  search(query: string): DownloadTemplate[] {
    const q = query.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q)
    );
  }

  save(template: Omit<DownloadTemplate, 'id' | 'isBuiltIn'>): DownloadTemplate {
    const newTemplate: DownloadTemplate = {
      ...template,
      id: `custom_${Date.now()}`,
      isBuiltIn: false
    };
    this.templates.push(newTemplate);
    this.saveCustomTemplates();
    return newTemplate;
  }

  update(id: string, updates: Partial<DownloadTemplate>): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    if (this.templates[index].isBuiltIn) return false;

    this.templates[index] = { ...this.templates[index], ...updates };
    this.saveCustomTemplates();
    return true;
  }

  delete(id: string): boolean {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) return false;
    if (this.templates[index].isBuiltIn) return false;

    this.templates.splice(index, 1);
    this.saveCustomTemplates();
    return true;
  }

  exportTemplates(): string {
    const custom = this.templates.filter(t => !t.isBuiltIn);
    return JSON.stringify(custom, null, 2);
  }

  importTemplates(json: string): number {
    try {
      const imported = JSON.parse(json) as DownloadTemplate[];
      let count = 0;
      for (const t of imported) {
        if (!this.templates.find(existing => existing.domain === t.domain)) {
          this.templates.push({ ...t, id: `imported_${Date.now()}_${count}`, isBuiltIn: false });
          count++;
        }
      }
      this.saveCustomTemplates();
      return count;
    } catch {
      return 0;
    }
  }
}

const BUILT_IN_TEMPLATES: DownloadTemplate[] = [
  {
    id: 'instagram', name: 'Instagram', description: 'Download photos and reels from Instagram',
    domain: 'instagram.com', urlPattern: 'instagram.com/p/*',
    authType: 'cookies', mediaTypes: ['image', 'video'],
    settings: { quality: 'maximum', format: 'mp4', rateLimit: '2/s', concurrency: 1 },
    isBuiltIn: true
  },
  {
    id: 'twitter', name: 'Twitter/X', description: 'Download media from Twitter posts',
    domain: 'twitter.com', urlPattern: 'twitter.com/*/status/*',
    authType: 'cookies', mediaTypes: ['image', 'video'],
    settings: { quality: 'maximum', rateLimit: '1/s', concurrency: 1 },
    isBuiltIn: true
  },
  {
    id: 'reddit', name: 'Reddit', description: 'Download images and videos from Reddit',
    domain: 'reddit.com', urlPattern: 'reddit.com/r/*',
    authType: 'none', mediaTypes: ['image', 'video'],
    settings: { quality: 'maximum', rateLimit: '1/s', concurrency: 2 },
    isBuiltIn: true
  },
  {
    id: 'tiktok', name: 'TikTok', description: 'Download TikTok videos without watermark',
    domain: 'tiktok.com', urlPattern: 'tiktok.com/@*/video/*',
    authType: 'none', mediaTypes: ['video'],
    settings: { quality: 'maximum', format: 'mp4', rateLimit: '1/s', concurrency: 1 },
    isBuiltIn: true
  },
  {
    id: 'pinterest', name: 'Pinterest', description: 'Download pins and boards from Pinterest',
    domain: 'pinterest.com', urlPattern: 'pinterest.com/pin/*',
    authType: 'cookies', mediaTypes: ['image', 'video'],
    settings: { quality: 'maximum', rateLimit: '2/s', concurrency: 2 },
    isBuiltIn: true
  },
  {
    id: 'youtube', name: 'YouTube', description: 'Download YouTube videos and playlists',
    domain: 'youtube.com', urlPattern: 'youtube.com/watch?v=*',
    authType: 'none', mediaTypes: ['video', 'audio'],
    settings: { quality: '1080p', format: 'mp4', concurrency: 3 },
    isBuiltIn: true
  },
  {
    id: 'tumblr', name: 'Tumblr', description: 'Download media from Tumblr blogs',
    domain: 'tumblr.com', urlPattern: 'tumblr.com/post/*',
    authType: 'none', mediaTypes: ['image', 'video'],
    settings: { quality: 'maximum', rateLimit: '1/s', concurrency: 2 },
    isBuiltIn: true
  },
  {
    id: 'flickr', name: 'Flickr', description: 'Download photos from Flickr albums',
    domain: 'flickr.com', urlPattern: 'flickr.com/photos/*',
    authType: 'none', mediaTypes: ['image'],
    settings: { quality: 'maximum', rateLimit: '1/s', concurrency: 2 },
    isBuiltIn: true
  },
  {
    id: 'deviantart', name: 'DeviantArt', description: 'Download art from DeviantArt',
    domain: 'deviantart.com', urlPattern: 'deviantart.com/art/*',
    authType: 'none', mediaTypes: ['image'],
    settings: { quality: 'maximum', rateLimit: '1/s', concurrency: 2 },
    isBuiltIn: true
  },
  {
    id: 'generic', name: 'Generic Website', description: 'Download all media from any website',
    domain: '*', urlPattern: '*',
    authType: 'none', mediaTypes: ['image', 'video', 'audio'],
    settings: { quality: 'maximum', rateLimit: '3/s', concurrency: 3 },
    isBuiltIn: true
  }
];
