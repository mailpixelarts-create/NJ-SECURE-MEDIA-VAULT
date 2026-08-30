export interface ElectronAPI {
  auth: {
    login: (password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    isLoggedIn: () => Promise<boolean>;
  };
  vault: {
    createFolder: (name: string, password?: string) => Promise<string>;
    unlockFolder: (folderId: string, password?: string) => Promise<boolean>;
    lockFolder: (folderId: string) => Promise<void>;
    listFiles: (folderId?: string, mediaType?: string) => Promise<any[]>;
    listFolders: () => Promise<any[]>;
    getFile: (fileId: string) => Promise<any>;
    getThumbnail: (fileId: string) => Promise<any>;
    getStream: (fileId: string) => Promise<string>;
  };
  download: {
    add: (url: string, options: any) => Promise<string>;
    addBulk: (urls: string[], options: any) => Promise<string[]>;
    pause: (id: string) => Promise<void>;
    resume: (id: string) => Promise<void>;
    cancel: (id: string) => Promise<void>;
    getActive: () => Promise<any[]>;
    getHistory: (options?: { limit?: number; status?: string }) => Promise<any[]>;
    getStats: () => Promise<{ total: number; completed: number; failed: number; totalSize: number }>;
    analyze: (urls: string[]) => Promise<any>;
    onProgress: (callback: (progress: any) => void) => void;
  };
  metadata: {
    scan: (filePath: string) => Promise<any>;
    scrub: (fileId: string) => Promise<any>;
    bulkScrub: (fileIds: string[]) => Promise<any[]>;
    tagImage: (filePath: string) => Promise<string[]>;
  };
  delete: {
    secure: (filePath: string, passes: number) => Promise<void>;
    secureFolder: (folderPath: string, passes: number) => Promise<void>;
  };
  recovery: {
    generatePhrase: () => Promise<string>;
    recover: (phrase: string) => Promise<any>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  onAutoLocked: (callback: () => void) => void;
  http: {
    download: (url: string, outputPath: string, options: any) => Promise<any>;
    getInfo: (url: string) => Promise<any>;
    onProgress: (callback: (progress: any) => void) => void;
  };
  fusker: {
    expand: (url: string) => Promise<string[]>;
    expandAll: (urls: string[]) => Promise<string[]>;
    hasPattern: (url: string) => Promise<boolean>;
    estimateCount: (url: string) => Promise<number>;
  };
  social: {
    extractMedia: (url: string, cookies?: string) => Promise<any>;
    isSupported: (url: string) => Promise<boolean>;
    getPlatforms: () => Promise<string[]>;
  };
  forum: {
    scrape: (url: string, options: any) => Promise<any>;
    detectType: (url: string) => Promise<string>;
    onProgress: (callback: (progress: any) => void) => void;
  };
  templates: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    search: (query: string) => Promise<any[]>;
    save: (template: any) => Promise<any>;
    delete: (id: string) => Promise<boolean>;
    export: () => Promise<string>;
    import: (json: string) => Promise<number>;
  };
  projects: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    search: (query: string) => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<boolean>;
    delete: (id: string) => Promise<boolean>;
    addUrls: (id: string, urls: string[]) => Promise<boolean>;
    removeUrl: (id: string, url: string) => Promise<boolean>;
    export: (id: string) => Promise<string>;
    import: (json: string) => Promise<any>;
  };
  browser: {
    createPage: (url?: string) => Promise<any>;
    closePage: (id: string) => Promise<void>;
    getPages: () => Promise<any[]>;
    navigate: (pageId: string, url: string) => Promise<any>;
    goBack: (pageId: string) => Promise<any>;
    goForward: (pageId: string) => Promise<any>;
    extractImages: (url: string) => Promise<any[]>;
    detectGallery: (url: string) => Promise<any>;
    getThumbnail: (url: string) => Promise<string | null>;
  };
  captcha: {
    isConfigured: () => Promise<boolean>;
    configure: (config: { provider: string; apiKey: string; timeout?: number }) => Promise<boolean>;
    solveRecaptcha: (siteKey: string, pageUrl: string) => Promise<{ solution: string; solveTime: number; provider: string } | null>;
    solveImage: (base64Image: string) => Promise<{ solution: string; solveTime: number; provider: string } | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
