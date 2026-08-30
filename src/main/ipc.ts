import { ipcMain } from 'electron';
import { AuthManager } from './security/auth';
import { VaultManager } from './security/vault';
import { SecureDeleteManager } from './security/secureDelete';
import { DownloadQueueManager } from './download/queue';
import { MetadataScrubber } from './metadata/scrubber';
import { AITagger } from './metadata/ai-tagger';
import { RecoveryManager } from './security/recovery';
import { DatabaseManager } from './database/init';
import { HttpDownloader } from './download/httpDownloader';
import { FuskerExpander } from './download/fusker';
import { SocialDownloaderRegistry } from './download/socialDownloaders';
import { ForumScraper } from './download/forumScraper';
import { TemplateManager } from './templates/templateManager';
import { ProjectManager } from './projects/projectManager';
import { BrowserManager } from './browser/browserManager';
import { CaptchaSolver } from './download/captchaSolver';

export class IPCHandlers {
  private authManager: AuthManager;
  private vaultManager: VaultManager;
  private secureDeleteManager: SecureDeleteManager;
  private downloadQueueManager: DownloadQueueManager;
  private metadataScrubber: MetadataScrubber;
  private aiTagger: AITagger;
  private recoveryManager: RecoveryManager;

  constructor() {
    this.authManager = AuthManager.getInstance();
    this.vaultManager = VaultManager.getInstance();
    this.secureDeleteManager = SecureDeleteManager.getInstance();
    this.downloadQueueManager = DownloadQueueManager.getInstance();
    this.metadataScrubber = MetadataScrubber.getInstance();
    this.aiTagger = AITagger.getInstance();
    this.recoveryManager = RecoveryManager.getInstance();

    this.registerHandlers();
  }

  private registerHandlers() {
    // === CAPTCHA Solver ===
    ipcMain.handle('captcha:isConfigured', () => {
      return CaptchaSolver.getInstance().isConfigured();
    });

    ipcMain.handle('captcha:configure', (event, config: any) => {
      CaptchaSolver.getInstance().configure(config);
      return true;
    });

    ipcMain.handle('captcha:solveRecaptcha', async (event, siteKey: string, pageUrl: string) => {
      try {
        return await CaptchaSolver.getInstance().solveRecaptcha(siteKey, pageUrl);
      } catch (err: any) {
        console.error('captcha:solveRecaptcha error:', err);
        return null;
      }
    });

    ipcMain.handle('captcha:solveImage', async (event, base64Image: string) => {
      try {
        return await CaptchaSolver.getInstance().solveImageCaptcha(base64Image);
      } catch (err: any) {
        console.error('captcha:solveImage error:', err);
        return null;
      }
    });
    ipcMain.handle('auth:login', async (event, password: string) => {
      try {
        return await this.authManager.authenticate(password);
      } catch (err: any) {
        console.error('auth:login error:', err);
        return false;
      }
    });

    ipcMain.handle('auth:logout', () => {
      try {
        this.authManager.logout();
        this.vaultManager.lockAllFolders();
      } catch (err: any) {
        console.error('auth:logout error:', err);
      }
    });

    ipcMain.handle('auth:isLoggedIn', () => {
      try {
        return this.authManager.isLoggedIn();
      } catch {
        return false;
      }
    });

    ipcMain.handle('vault:createFolder', async (event, name: string, password?: string) => {
      try {
        return await this.vaultManager.createEncryptedFolder(name, password);
      } catch (err: any) {
        console.error('vault:createFolder error:', err);
        return null;
      }
    });

    ipcMain.handle('vault:unlockFolder', async (event, folderId: string, password?: string) => {
      try {
        return await this.vaultManager.unlockFolder(folderId, password);
      } catch (err: any) {
        console.error('vault:unlockFolder error:', err);
        return false;
      }
    });

    ipcMain.handle('vault:lockFolder', (event, folderId: string) => {
      try {
        this.vaultManager.lockFolder(folderId);
      } catch (err: any) {
        console.error('vault:lockFolder error:', err);
      }
    });

    ipcMain.handle('vault:listFiles', async (event, folderId?: string, mediaType?: string) => {
      try {
        return await this.vaultManager.listFiles(folderId, mediaType as any);
      } catch (err: any) {
        console.error('vault:listFiles error:', err);
        return [];
      }
    });

    ipcMain.handle('vault:listFolders', async () => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        return db.prepare('SELECT * FROM folders').all();
      } catch (err: any) {
        console.error('vault:listFolders error:', err);
        return [];
      }
    });

    ipcMain.handle('vault:getFile', async (event, fileId: string) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
        if (!file) return null;
        const fs = require('fs');
        if (!fs.existsSync(file.file_path)) return null;
        return fs.readFileSync(file.file_path);
      } catch (err: any) {
        console.error('vault:getFile error:', err);
        return null;
      }
    });

    ipcMain.handle('vault:getThumbnail', async (event, fileId: string) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
        if (!file) return null;
        const thumbnailPath = file.file_path.replace(/\.[^.]+$/, '_thumb.jpg');
        const fs = require('fs');
        if (fs.existsSync(thumbnailPath)) {
          return fs.readFileSync(thumbnailPath);
        }
        return null;
      } catch (err: any) {
        return null;
      }
    });

    ipcMain.handle('vault:getStream', async (event, fileId: string) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
        if (!file) return null;
        return file.file_path;
      } catch (err: any) {
        return null;
      }
    });

    ipcMain.handle('download:add', async (event, url: string, options: any) => {
      try {
        // Apply speed limit from settings if not specified in options
        if (!options.rateLimit) {
          const db = DatabaseManager.getInstance().getDatabase();
          const dlSettings = db.prepare("SELECT value FROM settings WHERE key = 'download'").get() as any;
          if (dlSettings) {
            const parsed = JSON.parse(dlSettings.value);
            if (parsed.speedLimit && parsed.speedLimit !== 'unlimited') {
              const speedMap: Record<string, string> = {
                '1mb': '1M', '5mb': '5M', '10mb': '10M', '50mb': '50M'
              };
              options.rateLimit = speedMap[parsed.speedLimit] || undefined;
            }
          }
        }
        return await this.downloadQueueManager.addDownload(url, options);
      } catch (err: any) {
        console.error('download:add error:', err);
        return null;
      }
    });

    ipcMain.handle('download:addBulk', async (event, urls: string[], options: any) => {
      try {
        return await this.downloadQueueManager.addBulkDownloads(urls, options);
      } catch (err: any) {
        console.error('download:addBulk error:', err);
        return [];
      }
    });

    ipcMain.handle('download:pause', (event, downloadId: string) => {
      try {
        this.downloadQueueManager.pauseDownload(downloadId);
      } catch (err: any) {
        console.error('download:pause error:', err);
      }
    });

    ipcMain.handle('download:resume', (event, downloadId: string) => {
      try {
        this.downloadQueueManager.resumeDownload(downloadId);
      } catch (err: any) {
        console.error('download:resume error:', err);
      }
    });

    ipcMain.handle('download:cancel', (event, downloadId: string) => {
      try {
        this.downloadQueueManager.cancelDownload(downloadId);
      } catch (err: any) {
        console.error('download:cancel error:', err);
      }
    });

    ipcMain.handle('download:getActive', () => {
      try {
        return this.downloadQueueManager.getActiveDownloads();
      } catch (err: any) {
        return [];
      }
    });

    ipcMain.handle('download:getHistory', (event, options?: { limit?: number; status?: string }) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        let query = 'SELECT * FROM downloads';
        const params: any[] = [];

        if (options?.status) {
          query += ' WHERE status = ?';
          params.push(options.status);
        }

        query += ' ORDER BY started_at DESC';

        if (options?.limit) {
          query += ' LIMIT ?';
          params.push(options.limit);
        }

        return db.prepare(query).all(...params);
      } catch (err: any) {
        console.error('download:getHistory error:', err);
        return [];
      }
    });

    ipcMain.handle('download:getStats', () => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const total = db.prepare('SELECT COUNT(*) as count FROM downloads').get() as any;
        const completed = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'completed'").get() as any;
        const failed = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'failed'").get() as any;
        const totalSize = db.prepare("SELECT COALESCE(SUM(file_size), 0) as total FROM downloads WHERE status = 'completed'").get() as any;
        return {
          total: total?.count || 0,
          completed: completed?.count || 0,
          failed: failed?.count || 0,
          totalSize: totalSize?.total || 0
        };
      } catch (err: any) {
        console.error('download:getStats error:', err);
        return { total: 0, completed: 0, failed: 0, totalSize: 0 };
      }
    });

    ipcMain.handle('download:analyze', async (event, urls: string[]) => {
      try {
        const { YtDlpManager } = require('./download/ytdlp');
        const ytdlp = YtDlpManager.getInstance();

        let images = 0;
        let videos = 0;
        let totalSize = 0;
        const imageSizes: string[] = [];
        const videoQualities: string[] = [];

        for (const url of urls) {
          try {
            const info = await ytdlp.getVideoInfo(url);
            if (info) {
              videos++;
              if (info.format_note) videoQualities.push(info.format_note);
              if (info.filesize) totalSize += info.filesize;
            }
          } catch {
            images++;
          }
        }

        return {
          images,
          videos,
          totalSize: formatBytes(totalSize),
          imageSizes: imageSizes.length ? imageSizes : ['Original'],
          videoQualities: videoQualities.length ? videoQualities : ['Maximum']
        };
      } catch (err: any) {
        return { images: 0, videos: 0, totalSize: '0 B', imageSizes: [], videoQualities: [] };
      }
    });

    ipcMain.handle('metadata:scan', async (event, filePath: string) => {
      try {
        return await this.metadataScrubber.scanMetadata(filePath);
      } catch (err: any) {
        console.error('metadata:scan error:', err);
        return null;
      }
    });

    ipcMain.handle('metadata:scrub', async (event, fileId: string) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any;
        if (!file) throw new Error('File not found');
        return await this.metadataScrubber.scrubMetadata(file.file_path, {
          removeList: ['gps', 'camera', 'author', 'dates', 'software'],
          createBackup: false,
          backupEncrypted: true
        });
      } catch (err: any) {
        console.error('metadata:scrub error:', err);
        return null;
      }
    });

    ipcMain.handle('metadata:bulkScrub', async (event, fileIds: string[]) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const filePaths = fileIds.map(id => {
          const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
          return file?.file_path;
        }).filter(Boolean);
        return await this.metadataScrubber.bulkScrub(filePaths, {
          removeList: ['gps', 'camera', 'author', 'dates', 'software'],
          createBackup: false,
          backupEncrypted: true
        });
      } catch (err: any) {
        console.error('metadata:bulkScrub error:', err);
        return [];
      }
    });

    ipcMain.handle('metadata:tagImage', async (event, filePath: string) => {
      try {
        return await this.aiTagger.tagImage(filePath);
      } catch (err: any) {
        console.error('metadata:tagImage error:', err);
        return [];
      }
    });

    ipcMain.handle('delete:secure', async (event, filePath: string, passes: number) => {
      try {
        return await this.secureDeleteManager.secureDeleteFile(filePath, passes);
      } catch (err: any) {
        console.error('delete:secure error:', err);
      }
    });

    ipcMain.handle('delete:secureFolder', async (event, folderPath: string, passes: number) => {
      try {
        return await this.secureDeleteManager.secureDeleteFolder(folderPath, passes);
      } catch (err: any) {
        console.error('delete:secureFolder error:', err);
      }
    });

    ipcMain.handle('recovery:generatePhrase', async () => {
      try {
        return await this.recoveryManager.generateRecoveryPhrase();
      } catch (err: any) {
        console.error('recovery:generatePhrase error:', err);
        return '';
      }
    });

    ipcMain.handle('recovery:recover', async (event, phrase: string) => {
      try {
        return await this.recoveryManager.recoverWithPhrase(phrase);
      } catch (err: any) {
        console.error('recovery:recover error:', err);
        return false;
      }
    });

    ipcMain.handle('settings:get', (event, key: string) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
        return result ? JSON.parse(result.value) : null;
      } catch (err: any) {
        return null;
      }
    });

    ipcMain.handle('settings:set', (event, key: string, value: any) => {
      try {
        const db = DatabaseManager.getInstance().getDatabase();
        db.prepare(`
          INSERT OR REPLACE INTO settings (key, value)
          VALUES (?, ?)
        `).run(key, JSON.stringify(value));
      } catch (err: any) {
        console.error('settings:set error:', err);
      }
    });

    // === HTTP Downloader ===
    ipcMain.handle('http:download', async (event, url: string, outputPath: string, options: any) => {
      try {
        const http = HttpDownloader.getInstance();
        return await http.download(url, outputPath, options, (progress) => {
          event.sender.send('http:progress', progress);
        });
      } catch (err: any) {
        console.error('http:download error:', err);
        return null;
      }
    });

    ipcMain.handle('http:getInfo', async (event, url: string) => {
      try {
        const http = HttpDownloader.getInstance();
        return await http.getInfo(url);
      } catch (err: any) {
        return null;
      }
    });

    // === Fusker Expander ===
    ipcMain.handle('fusker:expand', async (event, url: string) => {
      try {
        return FuskerExpander.expand(url);
      } catch (err: any) {
        return [url];
      }
    });

    ipcMain.handle('fusker:expandAll', async (event, urls: string[]) => {
      try {
        return FuskerExpander.expandAll(urls);
      } catch (err: any) {
        return urls;
      }
    });

    ipcMain.handle('fusker:hasPattern', async (event, url: string) => {
      return FuskerExpander.hasPattern(url);
    });

    ipcMain.handle('fusker:estimateCount', async (event, url: string) => {
      return FuskerExpander.estimateCount(url);
    });

    // === Social Downloaders ===
    ipcMain.handle('social:extractMedia', async (event, url: string, cookies?: string) => {
      try {
        const registry = SocialDownloaderRegistry.getInstance();
        return await registry.extractMedia(url, cookies);
      } catch (err: any) {
        console.error('social:extractMedia error:', err);
        return null;
      }
    });

    ipcMain.handle('social:isSupported', async (event, url: string) => {
      const registry = SocialDownloaderRegistry.getInstance();
      return registry.isSupported(url);
    });

    ipcMain.handle('social:getPlatforms', async () => {
      const registry = SocialDownloaderRegistry.getInstance();
      return registry.getSupportedPlatforms();
    });

    // === Forum Scraper ===
    ipcMain.handle('forum:scrape', async (event, url: string, options: any) => {
      try {
        const scraper = ForumScraper.getInstance();
        scraper.on('progress', (progress) => {
          event.sender.send('forum:progress', progress);
        });
        return await scraper.scrapeThread(url, options);
      } catch (err: any) {
        console.error('forum:scrape error:', err);
        return null;
      }
    });

    ipcMain.handle('forum:detectType', async (event, url: string) => {
      const scraper = ForumScraper.getInstance();
      return scraper.detectForumType(url);
    });

    // === Templates ===
    ipcMain.handle('templates:getAll', async () => {
      return TemplateManager.getInstance().getAll();
    });

    ipcMain.handle('templates:getById', async (event, id: string) => {
      return TemplateManager.getInstance().getById(id);
    });

    ipcMain.handle('templates:search', async (event, query: string) => {
      return TemplateManager.getInstance().search(query);
    });

    ipcMain.handle('templates:save', async (event, template: any) => {
      return TemplateManager.getInstance().save(template);
    });

    ipcMain.handle('templates:delete', async (event, id: string) => {
      return TemplateManager.getInstance().delete(id);
    });

    ipcMain.handle('templates:export', async () => {
      return TemplateManager.getInstance().exportTemplates();
    });

    ipcMain.handle('templates:import', async (event, json: string) => {
      return TemplateManager.getInstance().importTemplates(json);
    });

    // === Projects ===
    ipcMain.handle('projects:getAll', async () => {
      return ProjectManager.getInstance().getAll();
    });

    ipcMain.handle('projects:getById', async (event, id: string) => {
      return ProjectManager.getInstance().getById(id);
    });

    ipcMain.handle('projects:search', async (event, query: string) => {
      return ProjectManager.getInstance().search(query);
    });

    ipcMain.handle('projects:create', async (event, data: any) => {
      return ProjectManager.getInstance().create(data);
    });

    ipcMain.handle('projects:update', async (event, id: string, updates: any) => {
      return ProjectManager.getInstance().update(id, updates);
    });

    ipcMain.handle('projects:delete', async (event, id: string) => {
      return ProjectManager.getInstance().delete(id);
    });

    ipcMain.handle('projects:addUrls', async (event, id: string, urls: string[]) => {
      return ProjectManager.getInstance().addUrls(id, urls);
    });

    ipcMain.handle('projects:removeUrl', async (event, id: string, url: string) => {
      return ProjectManager.getInstance().removeUrl(id, url);
    });

    ipcMain.handle('projects:export', async (event, id: string) => {
      return ProjectManager.getInstance().exportProject(id);
    });

    ipcMain.handle('projects:import', async (event, json: string) => {
      return ProjectManager.getInstance().importProject(json);
    });

    // === Browser Manager ===
    ipcMain.handle('browser:createPage', async (event, url?: string) => {
      return BrowserManager.getInstance().createPage(url);
    });

    ipcMain.handle('browser:closePage', async (event, id: string) => {
      BrowserManager.getInstance().closePage(id);
    });

    ipcMain.handle('browser:getPages', async () => {
      return BrowserManager.getInstance().getPages();
    });

    ipcMain.handle('browser:navigate', async (event, pageId: string, url: string) => {
      return BrowserManager.getInstance().navigate(pageId, url);
    });

    ipcMain.handle('browser:goBack', async (event, pageId: string) => {
      return BrowserManager.getInstance().goBack(pageId);
    });

    ipcMain.handle('browser:goForward', async (event, pageId: string) => {
      return BrowserManager.getInstance().goForward(pageId);
    });

    ipcMain.handle('browser:extractImages', async (event, url: string) => {
      return BrowserManager.getInstance().extractImages(url);
    });

    ipcMain.handle('browser:detectGallery', async (event, url: string) => {
      return BrowserManager.getInstance().detectGallery(url);
    });

    ipcMain.handle('browser:getThumbnail', async (event, url: string) => {
      return BrowserManager.getInstance().getThumbnail(url);
    });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
