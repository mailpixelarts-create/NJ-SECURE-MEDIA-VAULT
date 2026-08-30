import * as bip39 from 'bip39';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AuthManager } from './auth';
import { EncryptionManager } from './encryption';

export class RecoveryManager {
  private static instance: RecoveryManager;
  private authManager: AuthManager;
  private encryptionManager: EncryptionManager;

  private constructor() {
    this.authManager = AuthManager.getInstance();
    this.encryptionManager = EncryptionManager.getInstance();
  }

  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  private getVaultPath(): string {
    return path.join(app.getPath('userData'), 'vault');
  }

  private getBackupPath(): string {
    return path.join(this.getVaultPath(), 'recovery_backup.enc');
  }

  async generateRecoveryPhrase(): Promise<string> {
    const mnemonic = bip39.generateMnemonic(256);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const recoveryKey = crypto.createHash('sha256').update(seed).digest();

    const masterPasswordHash = this.authManager.getMasterPasswordHash();
    if (!masterPasswordHash) {
      throw new Error('Cannot generate recovery phrase: no master password set');
    }

    const { encrypted, iv, authTag } = await this.encryptWithKey(
      Buffer.from(masterPasswordHash),
      recoveryKey
    );

    const backupData = {
      encryptedMasterPasswordHash: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      createdAt: Date.now(),
      version: 1
    };

    const vaultPath = this.getVaultPath();
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }

    fs.writeFileSync(this.getBackupPath(), JSON.stringify(backupData, null, 2));

    return mnemonic;
  }

  async recoverWithPhrase(mnemonic: string): Promise<{
    success: boolean;
    newPhrase?: string;
    message: string;
  }> {
    if (!bip39.validateMnemonic(mnemonic)) {
      return { success: false, message: 'Invalid recovery phrase' };
    }

    try {
      const backupPath = this.getBackupPath();
      if (!fs.existsSync(backupPath)) {
        return { success: false, message: 'No recovery backup found' };
      }

      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const recoveryKey = crypto.createHash('sha256').update(seed).digest();

      const decryptedHash = await this.decryptWithKey(
        Buffer.from(backupData.encryptedMasterPasswordHash, 'base64'),
        Buffer.from(backupData.iv, 'base64'),
        Buffer.from(backupData.authTag, 'base64'),
        recoveryKey
      );

      const recoveredHash = decryptedHash.toString();
      const currentHash = this.authManager.getMasterPasswordHash();

      if (currentHash && recoveredHash !== currentHash) {
        return { success: false, message: 'Recovery phrase does not match' };
      }

      await this.authManager.resetMasterPassword(recoveredHash);

      const newPhrase = await this.generateRecoveryPhrase();

      return {
        success: true,
        newPhrase,
        message: 'Recovery successful. New phrase generated.'
      };
    } catch (error: any) {
      return { success: false, message: `Recovery failed: ${error.message}` };
    }
  }

  private async encryptWithKey(
    data: Buffer,
    key: Buffer
  ): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer }> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { encrypted, iv, authTag };
  }

  private async decryptWithKey(
    encryptedData: Buffer,
    iv: Buffer,
    authTag: Buffer,
    key: Buffer
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }
}
