/**
 * Tests for RecoveryManager (security/recovery.ts)
 * Tests BIP39 recovery phrase generation and recovery flow.
 */
import * as bip39 from 'bip39';

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: () => require('os').tmpdir(),
  },
}));

// Mock AuthManager
jest.mock('../../main/security/auth', () => ({
  AuthManager: {
    getInstance: jest.fn(() => ({
      getMasterPasswordHash: jest.fn(() => '$argon2id$v=19$m=65536,t=3,p=4$test$hash'),
      resetMasterPassword: jest.fn(),
    })),
  },
}));

// Mock EncryptionManager
jest.mock('../../main/security/encryption', () => ({
  EncryptionManager: {
    getInstance: jest.fn(() => ({
      encryptBuffer: jest.fn(async (data: Buffer) => ({
        encrypted: data,
        iv: require('crypto').randomBytes(12),
        authTag: require('crypto').randomBytes(16),
      })),
    })),
  },
}));

import { RecoveryManager } from '../../main/security/recovery';

describe('RecoveryManager', () => {
  let manager: RecoveryManager;

  beforeEach(() => {
    (RecoveryManager as any).instance = undefined;
    manager = RecoveryManager.getInstance();
  });

  afterEach(() => {
    (RecoveryManager as any).instance = undefined;
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = RecoveryManager.getInstance();
      const b = RecoveryManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('generateRecoveryPhrase', () => {
    it('should generate a 24-word mnemonic', async () => {
      const phrase = await manager.generateRecoveryPhrase();
      const words = phrase.split(' ');
      expect(words.length).toBe(24);
    });

    it('should generate valid BIP39 mnemonic', async () => {
      const phrase = await manager.generateRecoveryPhrase();
      const isValid = bip39.validateMnemonic(phrase);
      expect(isValid).toBe(true);
    });

    it('should generate unique phrases each time', async () => {
      const phrase1 = await manager.generateRecoveryPhrase();
      const phrase2 = await manager.generateRecoveryPhrase();
      expect(phrase1).not.toBe(phrase2);
    });

    it('should save backup file', async () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const vaultPath = path.join(os.tmpdir(), 'vault');

      if (!fs.existsSync(vaultPath)) {
        fs.mkdirSync(vaultPath, { recursive: true });
      }

      await manager.generateRecoveryPhrase();

      const backupPath = path.join(vaultPath, 'recovery_backup.enc');
      expect(fs.existsSync(backupPath)).toBe(true);

      // Cleanup
      try { fs.rmSync(vaultPath, { recursive: true, force: true }); } catch {}
    });
  });

  describe('recoverWithPhrase', () => {
    it('should reject invalid mnemonic', async () => {
      const result = await manager.recoverWithPhrase('invalid phrase that is not bip39');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should reject empty phrase', async () => {
      const result = await manager.recoverWithPhrase('');
      expect(result.success).toBe(false);
    });
  });

  describe('Mnemonic Properties', () => {
    it('should have words from BIP39 wordlist', async () => {
      const phrase = await manager.generateRecoveryPhrase();
      const words = phrase.split(' ');

      // Check first few words are in BIP39 wordlist
      const wordlist = bip39.wordlists.english;
      words.forEach(word => {
        expect(wordlist).toContain(word);
      });
    });

    it('should have all lowercase words', async () => {
      const phrase = await manager.generateRecoveryPhrase();
      const words = phrase.split(' ');
      words.forEach(word => {
        expect(word).toBe(word.toLowerCase());
      });
    });

    it('should have no duplicate words', async () => {
      const phrase = await manager.generateRecoveryPhrase();
      const words = phrase.split(' ');
      const uniqueWords = new Set(words);
      expect(uniqueWords.size).toBe(words.length);
    });
  });
});
