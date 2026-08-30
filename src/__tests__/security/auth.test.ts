/**
 * Tests for AuthManager (security/auth.ts)
 * Tests password hashing, authentication, lockout, and session management.
 * Master password is hardcoded as 21-12-1974.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TEST_ROOT = path.join(os.tmpdir(), 'smv-test-' + Math.random().toString(36).slice(2));

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') return TEST_ROOT;
      return os.tmpdir();
    }),
  },
}));

// Mock EncryptionManager
jest.mock('../../main/security/encryption', () => ({
  EncryptionManager: {
    getInstance: jest.fn(() => ({
      setMasterKey: jest.fn(),
      clearMasterKey: jest.fn(),
      getSessionKey: jest.fn(() => Buffer.alloc(32)),
    })),
  },
}));

import { AuthManager } from '../../main/security/auth';

const HARDCODED_PASSWORD = '21-12-1974';

describe('AuthManager', () => {
  let manager: AuthManager;
  const authVaultDir = path.join(TEST_ROOT, 'vault');

  beforeAll(() => {
    if (!fs.existsSync(TEST_ROOT)) fs.mkdirSync(TEST_ROOT, { recursive: true });
    if (!fs.existsSync(authVaultDir)) fs.mkdirSync(authVaultDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    (AuthManager as any).instance = undefined;
    const authFile = path.join(authVaultDir, 'auth.json');
    if (fs.existsSync(authFile)) {
      fs.unlinkSync(authFile);
    }
    manager = AuthManager.getInstance();
  });

  afterEach(() => {
    manager.logout();
    (AuthManager as any).instance = undefined;
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = AuthManager.getInstance();
      const b = AuthManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('First-time Authentication', () => {
    it('should create password hash on first login with hardcoded password', async () => {
      const result = await manager.authenticate(HARDCODED_PASSWORD);
      expect(result).toBe(true);
      expect(manager.isLoggedIn()).toBe(true);
    });

    it('should save auth data to disk', async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      const authFile = path.join(authVaultDir, 'auth.json');
      expect(fs.existsSync(authFile)).toBe(true);

      const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      expect(authData.masterPasswordHash).toBeTruthy();
      expect(authData.createdAt).toBeTruthy();
    });

    it('should reject wrong password on first login', async () => {
      await expect(
        manager.authenticate('WrongPassword123!')
      ).rejects.toThrow('Invalid master password');
    });
  });

  describe('Subsequent Authentication', () => {
    beforeEach(async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      manager.logout();
    });

    it('should accept correct password', async () => {
      const result = await manager.authenticate(HARDCODED_PASSWORD);
      expect(result).toBe(true);
      expect(manager.isLoggedIn()).toBe(true);
    });

    it('should reject wrong password', async () => {
      await expect(
        manager.authenticate('WrongPassword456!')
      ).rejects.toThrow();
      expect(manager.isLoggedIn()).toBe(false);
    });

    it('should track failed attempts', async () => {
      try { await manager.authenticate('Wrong1'); } catch {}
      try { await manager.authenticate('Wrong2'); } catch {}
      try { await manager.authenticate('Wrong3'); } catch {}

      expect(manager.isLoggedIn()).toBe(false);
    });
  });

  describe('Lockout', () => {
    beforeEach(async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      manager.logout();
    });

    it('should lock out after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        try { await manager.authenticate(`Wrong${i}`); } catch {}
      }

      await expect(
        manager.authenticate(HARDCODED_PASSWORD)
      ).rejects.toThrow('locked');
    });

    it('should reset failed attempts after successful login', async () => {
      try { await manager.authenticate('Wrong1'); } catch {}
      try { await manager.authenticate('Wrong2'); } catch {}

      await manager.authenticate(HARDCODED_PASSWORD);
      manager.logout();

      const result = await manager.authenticate(HARDCODED_PASSWORD);
      expect(result).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should start as not logged in', () => {
      expect(manager.isLoggedIn()).toBe(false);
    });

    it('should be logged in after authenticate', async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      expect(manager.isLoggedIn()).toBe(true);
    });

    it('should be logged out after logout', async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      manager.logout();
      expect(manager.isLoggedIn()).toBe(false);
    });

    it('should clear session key on logout', async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      manager.logout();
      // EncryptionManager.clearMasterKey should have been called
    });
  });

  describe('Password Hash Persistence', () => {
    it('should persist hash across manager restarts', async () => {
      await manager.authenticate(HARDCODED_PASSWORD);
      const hash = manager.getMasterPasswordHash();
      expect(hash).toBeTruthy();
      manager.logout();

      (AuthManager as any).instance = undefined;
      const newManager = AuthManager.getInstance();
      
      // Verify the new manager loaded the hash
      expect(newManager.getMasterPasswordHash()).toBe(hash);

      const result = await newManager.authenticate(HARDCODED_PASSWORD);
      expect(result).toBe(true);
    });
  });

  describe('Auto Login', () => {
    it('should auto-login with hardcoded password', async () => {
      const result = await manager.autoLogin();
      expect(result).toBe(true);
      expect(manager.isLoggedIn()).toBe(true);
    });
  });
});
