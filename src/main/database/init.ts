import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { app } from 'electron';

/**
 * Database Manager with AES-256-GCM encryption wrapper.
 * The database file itself is encrypted at rest.
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database;
  private dbPath: string;
  private encDbPath: string;
  private dbKey: Buffer | null = null;

  private constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'vault.db');
    this.encDbPath = path.join(app.getPath('userData'), 'vault.db.enc');
    
    // Decrypt database if it exists encrypted
    this.decryptDatabaseIfEncrypted();
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Set the encryption key for the database.
   * Call this after the master key is set.
   */
  setDatabaseEncryptionKey(key: Buffer): void {
    this.dbKey = key;
  }

  /**
   * If vault.db.enc exists, decrypt it to vault.db.
   */
  private decryptDatabaseIfEncrypted(): void {
    if (!fs.existsSync(this.encDbPath)) return;
    if (!this.dbKey) {
      // Key not set yet — will decrypt after auth
      return;
    }

    try {
      const encrypted = fs.readFileSync(this.encDbPath);
      const iv = encrypted.slice(0, 12);
      const authTag = encrypted.slice(-16);
      const data = encrypted.slice(12, -16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.dbKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

      fs.writeFileSync(this.dbPath, decrypted);
      console.log('Database decrypted successfully');
    } catch (err) {
      console.error('Failed to decrypt database:', err);
    }
  }

  /**
   * Encrypt the database file to vault.db.enc.
   * Called during graceful shutdown or explicit lock.
   */
  async encryptDatabase(): Promise<void> {
    if (!this.dbKey) return;

    try {
      this.db.close();
      
      const dbData = fs.readFileSync(this.dbPath);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.dbKey, iv);
      const encrypted = Buffer.concat([cipher.update(dbData), cipher.final()]);
      const authTag = cipher.getAuthTag();

      fs.writeFileSync(this.encDbPath, Buffer.concat([iv, authTag, encrypted]));
      
      // Remove plaintext database
      fs.unlinkSync(this.dbPath);
      
      // Reopen encrypted
      this.decryptDatabaseIfEncrypted();
      this.db = new Database(this.dbPath);
      
      console.log('Database encrypted successfully');
    } catch (err) {
      console.error('Failed to encrypt database:', err);
    }
  }

  private initializeSchema() {
    this.db.exec(`
      -- Files table
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        media_type TEXT CHECK(media_type IN ('image', 'video', 'audio', 'other')),
        extension TEXT,
        source_url TEXT,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        encrypted INTEGER DEFAULT 1,
        encryption_key_id TEXT,
        checksum TEXT,
        metadata_status TEXT DEFAULT 'unknown',
        folder_id TEXT,
        FOREIGN KEY (folder_id) REFERENCES folders(id)
      );

      -- Folders table
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        encrypted INTEGER DEFAULT 1,
        password_protected INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id)
      );

      -- Download history
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        media_type TEXT,
        quality TEXT,
        file_size INTEGER,
        status TEXT CHECK(status IN ('pending', 'downloading', 'completed', 'failed', 'cancelled')),
        error_message TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        downloaded_to TEXT,
        metadata_scrubbed INTEGER DEFAULT 0
      );

      -- Security events
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        description TEXT,
        severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Metadata scrub history
      CREATE TABLE IF NOT EXISTS scrub_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT,
        metadata_removed TEXT,
        backup_location TEXT,
        scrubbed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id)
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- File tags junction
      CREATE TABLE IF NOT EXISTS file_tags (
        file_id TEXT,
        tag_id TEXT,
        PRIMARY KEY (file_id, tag_id),
        FOREIGN KEY (file_id) REFERENCES files(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Templates
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT NOT NULL,
        builtin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        urls TEXT DEFAULT '[]',
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_files_media_type ON files(media_type);
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);
      CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
    `);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}
