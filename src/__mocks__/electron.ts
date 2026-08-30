// Mock Electron for Jest tests
const path = require('path');
const os = require('os');

const mockUserData = path.join(os.tmpdir(), 'vault-test-userdata');

module.exports = {
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserData;
      return mockUserData;
    },
    getName: () => 'Secure Media Vault',
    getVersion: () => '1.0.0',
    isReady: () => true,
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      on: jest.fn(),
      send: jest.fn(),
      openDevTools: jest.fn(),
    },
    close: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  protocol: {
    handle: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
};
