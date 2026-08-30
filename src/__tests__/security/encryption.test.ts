/**
 * Tests for EncryptionManager (security/encryption.ts)
 * Tests AES-256-GCM encryption/decryption, key management, and buffer operations.
 */
import * as crypto from 'crypto';

// Mock sodium-native
jest.mock('sodium-native', () => ({
  __esModule: true,
  default: {
    malloc: jest.fn((size: number) => Buffer.alloc(size)),
    sodium_memzero: jest.fn(),
    sodium_bin2hex: jest.fn(() => '00000000'),
  },
}));

// Must import after mocking
import { EncryptionManager } from '../../main/security/encryption';

describe('EncryptionManager', () => {
  let manager: EncryptionManager;
  const testKey = crypto.randomBytes(32);

  beforeEach(() => {
    // Reset singleton
    (EncryptionManager as any).instance = undefined;
    manager = EncryptionManager.getInstance();
    manager.setMasterKey(testKey);
  });

  afterEach(() => {
    manager.clearMasterKey();
    (EncryptionManager as any).instance = undefined;
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = EncryptionManager.getInstance();
      const b = EncryptionManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('Master Key Management', () => {
    it('should set master key from Buffer', () => {
      const key = crypto.randomBytes(32);
      manager.setMasterKey(key);
      expect(manager.getSessionKey()).toBeTruthy();
    });

    it('should set master key from Uint8Array', () => {
      const key = new Uint8Array(32);
      key[0] = 42;
      manager.setMasterKey(Buffer.from(key));
      expect(manager.getSessionKey()).toBeTruthy();
    });

    it('should clear master key', () => {
      manager.setMasterKey(crypto.randomBytes(32));
      expect(manager.getSessionKey()).toBeTruthy();
      manager.clearMasterKey();
      expect(manager.getSessionKey()).toBeNull();
    });

    it('should overwrite existing key', () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);
      manager.setMasterKey(key1);
      manager.setMasterKey(key2);
      const sessionKey = manager.getSessionKey();
      expect(sessionKey).toBeTruthy();
      expect(sessionKey!.equals(key2)).toBe(true);
    });
  });

  describe('Buffer Encryption/Decryption', () => {
    it('should encrypt and decrypt a buffer', async () => {
      const original = Buffer.from('Hello, Secure World!');
      const { encrypted, iv, authTag } = await manager.encryptBuffer(original);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(iv).toHaveLength(12);
      expect(authTag).toHaveLength(16);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = await manager.decryptBuffer(encrypted, iv, authTag);
      expect(decrypted.equals(original)).toBe(true);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', async () => {
      const data = Buffer.from('Same data');
      const enc1 = await manager.encryptBuffer(data);
      const enc2 = await manager.encryptBuffer(data);

      // IVs should be different (random)
      expect(enc1.iv.equals(enc2.iv)).toBe(false);
      // Encrypted data should be different
      expect(enc1.encrypted.equals(enc2.encrypted)).toBe(false);
    });

    it('should fail decryption with wrong key', async () => {
      const data = Buffer.from('Secret data');
      const { encrypted, iv, authTag } = await manager.encryptBuffer(data);

      // Create a manager with a different key
      (EncryptionManager as any).instance = undefined;
      const otherManager = EncryptionManager.getInstance();
      otherManager.setMasterKey(crypto.randomBytes(32));

      await expect(
        otherManager.decryptBuffer(encrypted, iv, authTag)
      ).rejects.toThrow();

      otherManager.clearMasterKey();
      (EncryptionManager as any).instance = undefined;
    });

    it('should fail decryption with wrong IV', async () => {
      const data = Buffer.from('Secret data');
      const { encrypted, iv, authTag } = await manager.encryptBuffer(data);

      const wrongIv = crypto.randomBytes(12);
      await expect(
        manager.decryptBuffer(encrypted, wrongIv, authTag)
      ).rejects.toThrow();
    });

    it('should fail decryption with wrong auth tag', async () => {
      const data = Buffer.from('Secret data');
      const { encrypted, iv, authTag } = await manager.encryptBuffer(data);

      const wrongTag = crypto.randomBytes(16);
      await expect(
        manager.decryptBuffer(encrypted, iv, wrongTag)
      ).rejects.toThrow();
    });

    it('should handle empty buffer', async () => {
      const original = Buffer.alloc(0);
      const { encrypted, iv, authTag } = await manager.encryptBuffer(original);
      const decrypted = await manager.decryptBuffer(encrypted, iv, authTag);
      expect(decrypted.equals(original)).toBe(true);
    });

    it('should handle large buffer (1MB)', async () => {
      const original = crypto.randomBytes(1024 * 1024);
      const { encrypted, iv, authTag } = await manager.encryptBuffer(original);
      const decrypted = await manager.decryptBuffer(encrypted, iv, authTag);
      expect(decrypted.equals(original)).toBe(true);
    });

    it('should throw when master key is not set', async () => {
      manager.clearMasterKey();
      await expect(
        manager.encryptBuffer(Buffer.from('test'))
      ).rejects.toThrow('Master key not set');
    });
  });

  describe('Key Derivation', () => {
    it('should derive key from password', async () => {
      const salt = crypto.randomBytes(32);
      const key1 = await manager.deriveKeyFromPassword('password123', salt);
      expect(key1).toBeInstanceOf(Buffer);
      expect(key1.length).toBe(32);
    });

    it('should produce same key for same password+salt', async () => {
      const salt = crypto.randomBytes(32);
      const key1 = await manager.deriveKeyFromPassword('mypassword', salt);
      const key2 = await manager.deriveKeyFromPassword('mypassword', salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should produce different keys for different passwords', async () => {
      const salt = crypto.randomBytes(32);
      const key1 = await manager.deriveKeyFromPassword('password1', salt);
      const key2 = await manager.deriveKeyFromPassword('password2', salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('should produce different keys for different salts', async () => {
      const key1 = await manager.deriveKeyFromPassword('password', crypto.randomBytes(32));
      const key2 = await manager.deriveKeyFromPassword('password', crypto.randomBytes(32));
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Folder Key Generation', () => {
    it('should generate random 32-byte keys', () => {
      const key1 = manager.generateFolderKey();
      const key2 = manager.generateFolderKey();
      expect(key1).toHaveLength(32);
      expect(key2).toHaveLength(32);
      expect(key1.equals(key2)).toBe(false);
    });
  });
});
