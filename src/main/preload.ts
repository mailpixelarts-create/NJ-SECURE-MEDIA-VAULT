import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (password: string) => ipcRenderer.invoke('auth:login', password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    isLoggedIn: () => ipcRenderer.invoke('auth:isLoggedIn'),
  },
  vault: {
    createFolder: (name: string, password?: string) =>
      ipcRenderer.invoke('vault:createFolder', name, password),
    unlockFolder: (folderId: string, password?: string) =>
      ipcRenderer.invoke('vault:unlockFolder', folderId, password),
    lockFolder: (folderId: string) => ipcRenderer.invoke('vault:lockFolder', folderId),
    listFiles: (folderId?: string, mediaType?: string) =>
      ipcRenderer.invoke('vault:listFiles', folderId, mediaType),
    listFolders: () => ipcRenderer.invoke('vault:listFolders'),
    getFile: (fileId: string) => ipcRenderer.invoke('vault:getFile', fileId),
    getThumbnail: (fileId: string) => ipcRenderer.invoke('vault:getThumbnail', fileId),
    getStream: (fileId: string) => ipcRenderer.invoke('vault:getStream', fileId),
  },
  download: {
    add: (url: string, options: any) => ipcRenderer.invoke('download:add', url, options),
    addBulk: (urls: string[], options: any) =>
      ipcRenderer.invoke('download:addBulk', urls, options),
    pause: (id: string) => ipcRenderer.invoke('download:pause', id),
    resume: (id: string) => ipcRenderer.invoke('download:resume', id),
    cancel: (id: string) => ipcRenderer.invoke('download:cancel', id),
    getActive: () => ipcRenderer.invoke('download:getActive'),
    getHistory: (options?: { limit?: number; status?: string }) =>
      ipcRenderer.invoke('download:getHistory', options),
    getStats: () => ipcRenderer.invoke('download:getStats'),
    analyze: (urls: string[]) => ipcRenderer.invoke('download:analyze', urls),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download:progress', (_event, progress) => callback(progress));
    },
  },
  metadata: {
    scan: (filePath: string) => ipcRenderer.invoke('metadata:scan', filePath),
    scrub: (fileId: string) => ipcRenderer.invoke('metadata:scrub', fileId),
    bulkScrub: (fileIds: string[]) => ipcRenderer.invoke('metadata:bulkScrub', fileIds),
    tagImage: (filePath: string) => ipcRenderer.invoke('metadata:tagImage', filePath),
  },
  delete: {
    secure: (filePath: string, passes: number) =>
      ipcRenderer.invoke('delete:secure', filePath, passes),
    secureFolder: (folderPath: string, passes: number) =>
      ipcRenderer.invoke('delete:secureFolder', folderPath, passes),
  },
  recovery: {
    generatePhrase: () => ipcRenderer.invoke('recovery:generatePhrase'),
    recover: (phrase: string) => ipcRenderer.invoke('recovery:recover', phrase),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
  onAutoLocked: (callback: () => void) => {
    ipcRenderer.on('auto-locked', () => callback());
  },
  http: {
    download: (url: string, outputPath: string, options: any) =>
      ipcRenderer.invoke('http:download', url, outputPath, options),
    getInfo: (url: string) => ipcRenderer.invoke('http:getInfo', url),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('http:progress', (_event, progress) => callback(progress));
    },
  },
  fusker: {
    expand: (url: string) => ipcRenderer.invoke('fusker:expand', url),
    expandAll: (urls: string[]) => ipcRenderer.invoke('fusker:expandAll', urls),
    hasPattern: (url: string) => ipcRenderer.invoke('fusker:hasPattern', url),
    estimateCount: (url: string) => ipcRenderer.invoke('fusker:estimateCount', url),
  },
  social: {
    extractMedia: (url: string, cookies?: string) =>
      ipcRenderer.invoke('social:extractMedia', url, cookies),
    isSupported: (url: string) => ipcRenderer.invoke('social:isSupported', url),
    getPlatforms: () => ipcRenderer.invoke('social:getPlatforms'),
  },
  forum: {
    scrape: (url: string, options: any) => ipcRenderer.invoke('forum:scrape', url, options),
    detectType: (url: string) => ipcRenderer.invoke('forum:detectType', url),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('forum:progress', (_event, progress) => callback(progress));
    },
  },
  templates: {
    getAll: () => ipcRenderer.invoke('templates:getAll'),
    getById: (id: string) => ipcRenderer.invoke('templates:getById', id),
    search: (query: string) => ipcRenderer.invoke('templates:search', query),
    save: (template: any) => ipcRenderer.invoke('templates:save', template),
    delete: (id: string) => ipcRenderer.invoke('templates:delete', id),
    export: () => ipcRenderer.invoke('templates:export'),
    import: (json: string) => ipcRenderer.invoke('templates:import', json),
  },
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    getById: (id: string) => ipcRenderer.invoke('projects:getById', id),
    search: (query: string) => ipcRenderer.invoke('projects:search', query),
    create: (data: any) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('projects:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    addUrls: (id: string, urls: string[]) => ipcRenderer.invoke('projects:addUrls', id, urls),
    removeUrl: (id: string, url: string) => ipcRenderer.invoke('projects:removeUrl', id, url),
    export: (id: string) => ipcRenderer.invoke('projects:export', id),
    import: (json: string) => ipcRenderer.invoke('projects:import', json),
  },
  browser: {
    createPage: (url?: string) => ipcRenderer.invoke('browser:createPage', url),
    closePage: (id: string) => ipcRenderer.invoke('browser:closePage', id),
    getPages: () => ipcRenderer.invoke('browser:getPages'),
    navigate: (pageId: string, url: string) => ipcRenderer.invoke('browser:navigate', pageId, url),
    goBack: (pageId: string) => ipcRenderer.invoke('browser:goBack', pageId),
    goForward: (pageId: string) => ipcRenderer.invoke('browser:goForward', pageId),
    extractImages: (url: string) => ipcRenderer.invoke('browser:extractImages', url),
    detectGallery: (url: string) => ipcRenderer.invoke('browser:detectGallery', url),
    getThumbnail: (url: string) => ipcRenderer.invoke('browser:getThumbnail', url),
  },
  captcha: {
    isConfigured: () => ipcRenderer.invoke('captcha:isConfigured'),
    configure: (config: any) => ipcRenderer.invoke('captcha:configure', config),
    solveRecaptcha: (siteKey: string, pageUrl: string) => ipcRenderer.invoke('captcha:solveRecaptcha', siteKey, pageUrl),
    solveImage: (base64Image: string) => ipcRenderer.invoke('captcha:solveImage', base64Image),
  },
});
