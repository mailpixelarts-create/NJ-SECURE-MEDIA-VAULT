import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { EncryptionManager } from './encryption';

/**
 * HARDCODED MASTER PASSWORD: 21-12-1974
 *
 * On first run, this password is automatically set.
 * No compliance code. No restrictions. Vault is absolute.
 */
const HARDCODED_MASTER_PASSWORD = '21-12-1974';

export class AuthManager {
  private static instance: AuthManager;
  private masterPasswordHash: string | null = null;
  private sessionKey: Buffer | null = null;
  private isAuthenticated = false;
  private failedAttempts = 0;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  private lockoutUntil: number = 0;
  private initialized = false;

  private constructor() {
    this.loadAuthSync();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private loadAuthSync() {
    try {
      const vaultPath = this.getVaultPath();
      const authFile = path.join(vaultPath, 'auth.json');
      
      if (fs.existsSync(authFile)) {
        const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
        this.masterPasswordHash = authData.masterPasswordHash;
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load auth data:', error);
      this.initialized = true;
    }
  }

  private getVaultPath(): string {
    return path.join(app.getPath('userData'), 'vault');
  }

  /**
   * Authenticate with the hardcoded master password.
   * On first run, auto-creates the vault with 21-12-1974.
   */
  async authenticate(password: string): Promise<boolean> {
    if (Date.now() < this.lockoutUntil) {
      throw new Error(`Account locked. Try again in ${Math.ceil((this.lockoutUntil - Date.now()) / 60000)} minutes`);
    }

    // FIRST RUN: Auto-create vault with hardcoded password
    if (!this.masterPasswordHash) {
      // Verify the provided password matches the hardcoded one
      if (password !== HARDCODED_MASTER_PASSWORD) {
        throw new Error('Invalid master password');
      }

      this.masterPasswordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
      });
      await this.saveAuthData();
      this.isAuthenticated = true;
      await this.setMasterKeyFromPassword(password);
      return true;
    }

    const isValid = await argon2.verify(this.masterPasswordHash, password);
    
    if (isValid) {
      this.failedAttempts = 0;
      this.isAuthenticated = true;
      await this.setMasterKeyFromPassword(password);
      return true;
    } else {
      this.failedAttempts++;
      
      if (this.failedAttempts >= this.MAX_ATTEMPTS) {
        this.lockoutUntil = Date.now() + this.LOCKOUT_DURATION;
        this.failedAttempts = 0;
        throw new Error('Too many failed attempts. Account locked for 30 minutes');
      }
      
      throw new Error(`Invalid password. ${this.MAX_ATTEMPTS - this.failedAttempts} attempts remaining`);
    }
  }

  /**
   * Auto-login with the hardcoded master password.
   * Called on app startup to bypass lock screen.
   */
  async autoLogin(): Promise<boolean> {
    try {
      return await this.authenticate(HARDCODED_MASTER_PASSWORD);
    } catch {
      return false;
    }
  }

  private async saveAuthData() {
    const vaultPath = this.getVaultPath();
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    
    const authData = {
      masterPasswordHash: this.masterPasswordHash,
      createdAt: Date.now(),
      lastLogin: Date.now()
    };
    
    fs.writeFileSync(
      path.join(vaultPath, 'auth.json'),
      JSON.stringify(authData, null, 2)
    );
  }

  getSessionKey(): Buffer | null {
    return this.sessionKey;
  }

  getMasterPasswordHash(): string | null {
    return this.masterPasswordHash;
  }

  async resetMasterPassword(newHash: string): Promise<void> {
    this.masterPasswordHash = newHash;
    await this.saveAuthData();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  logout() {
    this.isAuthenticated = false;
    this.sessionKey = null;
    EncryptionManager.getInstance().clearMasterKey();
  }

  private async setMasterKeyFromPassword(password: string): Promise<void> {
    try {
      const salt = crypto.createHash('sha256').update('nj-secure-media-vault-salt').digest();
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
      const keyBuf = Buffer.allocUnsafe(key.length);
      key.copy(keyBuf);
      EncryptionManager.getInstance().setMasterKey(keyBuf);
      console.log('Master key set successfully');
    } catch (err: any) {
      console.error('Failed to set master key:', err);
      throw err;
    }
  }
}
