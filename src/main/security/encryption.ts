import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Transform } from 'stream';
import * as sodium from 'sodium-native';

export class EncryptionManager {
  private static instance: EncryptionManager;
  private masterKey: Buffer | null = null;

  private constructor() {}

  static getInstance(): EncryptionManager {
    if (!EncryptionManager.instance) {
      EncryptionManager.instance = new EncryptionManager();
    }
    return EncryptionManager.instance;
  }

  setMasterKey(key: Buffer) {
    try {
      const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key);
      this.masterKey = Buffer.allocUnsafe(keyBuf.length);
      keyBuf.copy(this.masterKey);
    } catch (err) {
      console.warn('sodium-native RAM wiping unavailable, falling back to regular buffer. Memory may not be securely wiped.', err);
      this.masterKey = Buffer.isBuffer(key) ? Buffer.from(key) : Buffer.from(key);
    }
  }
  
  clearMasterKey() {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
  }

  getSessionKey(): Buffer | null {
    return this.masterKey;
  }

  async encryptFile(filePath: string, outputPath?: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    const input = fs.createReadStream(filePath);
    const outputPathFinal = outputPath || `${filePath}.enc`;
    const output = fs.createWriteStream(outputPathFinal);
    
    // Write IV at the beginning
    output.write(iv);
    
    return new Promise((resolve, reject) => {
      input
        .pipe(cipher)
        .pipe(output)
        .on('finish', () => {
          const authTag = cipher.getAuthTag();
          // Append auth tag
          fs.appendFileSync(outputPathFinal, authTag);
          resolve(outputPathFinal);
        })
        .on('error', reject);
    });
  }

  async decryptFile(filePath: string, outputPath?: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const fileBuffer = fs.readFileSync(filePath);
    const iv = fileBuffer.slice(0, 12);
    const authTag = fileBuffer.slice(-16);
    const encryptedData = fileBuffer.slice(12, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    const outputPathFinal = outputPath || filePath.replace('.enc', '');
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPathFinal);
      
      const decryptedStream = decipher;
      decryptedStream.on('error', reject);
      
      output.on('finish', () => resolve(outputPathFinal));
      
      // Write decrypted data
      output.write(decryptedStream.update(encryptedData));
      output.write(decryptedStream.final());
      output.end();
    });
  }

  async encryptBuffer(data: Buffer): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer }> {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return { encrypted, iv, authTag };
  }

  async decryptBuffer(
    encryptedData: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Master key not set');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  generateFolderKey(): Buffer {
    return crypto.randomBytes(32);
  }

  deriveKeyFromPassword(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 1000000, 32, 'sha512', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }
}