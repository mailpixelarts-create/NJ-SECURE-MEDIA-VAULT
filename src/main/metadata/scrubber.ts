import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exiftool } from 'exiftool-vendored';
import { DatabaseManager } from '../database/init';
import { VaultManager } from '../security/vault';

export class MetadataScrubber {
  private static instance: MetadataScrubber;
  private db: DatabaseManager;
  private vault: VaultManager;

  private constructor() {
    this.db = DatabaseManager.getInstance();
    this.vault = VaultManager.getInstance();
  }

  static getInstance(): MetadataScrubber {
    if (!MetadataScrubber.instance) {
      MetadataScrubber.instance = new MetadataScrubber();
    }
    return MetadataScrubber.instance;
  }

  async scanMetadata(filePath: string): Promise<MetadataReport> {
    const rawMetadata = await exiftool.read(filePath);
    const metadata = rawMetadata as any;
    
    const report: MetadataReport = {
      fileName: path.basename(filePath),
      fileSize: metadata.FileSize,
      fileType: metadata.FileType,
      mimeType: metadata.MimeType,
      
      gps: metadata.GPS ? {
        latitude: metadata.GPS.GPSLatitude,
        longitude: metadata.GPS.GPSLongitude,
        altitude: metadata.GPS.GPSAltitude,
        raw: metadata.GPS
      } : null,
      
      camera: metadata.EXIF ? {
        make: metadata.EXIF.Make,
        model: metadata.EXIF.Model,
        serialNumber: metadata.EXIF.SerialNumber,
        lens: metadata.EXIF.LensModel
      } : null,
      
      author: {
        name: metadata.Artist || metadata.IPTC?.Byline,
        copyright: metadata.Copyright || metadata.IPTC?.Copyright
      },
      
      dates: {
        created: metadata.DateTimeOriginal || metadata.CreateDate,
        modified: metadata.ModifyDate,
        digitized: metadata.CreateDate
      },
      
      software: {
        creationSoftware: metadata.Software,
        editingSoftware: metadata.XMP?.CreatorTool,
        history: metadata.XMP?.History
      },
      
      technical: {
        resolution: `${metadata.ImageWidth}x${metadata.ImageHeight}`,
        colorProfile: metadata.ICCProfile?.ProfileDescription,
        compression: metadata.Compression,
        quality: metadata.JFIF?.JFIFVersion
      }
    };
    
    return report;
  }

  async scrubMetadata(
    filePath: string,
    options: ScrubOptions
  ): Promise<ScrubResult> {
    // Scan original metadata
    const originalMetadata = await this.scanMetadata(filePath);
    
    // Create backup if requested
    let backupPath: string | null = null;
    if (options.createBackup) {
      backupPath = await this.createMetadataBackup(filePath, originalMetadata);
    }
    
    // Build removal tags
    const removalTags = this.buildRemovalTags(options.removeList);
    
    // Execute scrubbing
    await exiftool.write(filePath, {} as any, [...removalTags, '-overwrite_original']);
    
    // Verify removal
    const remainingMetadata = await this.scanMetadata(filePath);
    const verification = this.verifyRemoval(originalMetadata, remainingMetadata);
    
    // Log operation
    await this.logScrubOperation(filePath, verification, backupPath);
    
    return {
      success: verification.complete,
      removedTags: verification.removed,
      remainingTags: verification.remaining,
      backupPath,
      sizeReduction: (originalMetadata.fileSize ?? 0) - (remainingMetadata.fileSize ?? 0)
    };
  }

  private buildRemovalTags(removeList: string[]): string[] {
    const tagMap: Record<string, string[]> = {
      gps: ['-GPS*', '-XMP-exif:GPS*'],
      cameraInfo: ['-EXIF:Make', '-EXIF:Model', '-EXIF:SerialNumber'],
      cameraSettings: ['-EXIF:ISO', '-EXIF:FNumber', '-EXIF:ExposureTime'],
      author: ['-IPTC:Byline', '-XMP-dc:Creator', '-EXIF:Artist'],
      dates: ['-EXIF:DateTimeOriginal', '-EXIF:CreateDate', '-EXIF:ModifyDate'],
      software: ['-EXIF:Software', '-XMP:CreatorTool'],
      copyright: ['-IPTC:Copyright', '-XMP-dc:Rights'],
      thumbnail: ['-IFD1:*'],
      colorProfile: ['-ICC_Profile:*'],
      all: ['-all=']
    };
    
    return removeList.flatMap(item => tagMap[item] || []);
  }

  private async createMetadataBackup(
    filePath: string,
    metadata: MetadataReport
  ): Promise<string> {
    const backupDir = path.join(
      this.vault.getVaultPath(),
      'metadata_backups'
    );
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupId = crypto.randomUUID();
    const backupPath = path.join(backupDir, `${backupId}.json`);
    
    // Encrypt backup
    const backupData = JSON.stringify({
      fileName: path.basename(filePath),
      metadata,
      timestamp: Date.now()
    });
    
    // Store encrypted
    const encryptionManager = require('../security/encryption').EncryptionManager.getInstance();
    const { encrypted, iv, authTag } = await encryptionManager.encryptBuffer(
      Buffer.from(backupData)
    );
    
    const encryptedBackup = Buffer.concat([iv, authTag, encrypted]);
    fs.writeFileSync(backupPath, encryptedBackup);
    
    return backupPath;
  }

  private verifyRemoval(
    original: MetadataReport,
    remaining: MetadataReport
  ): { complete: boolean; removed: string[]; remaining: string[] } {
    const removed: string[] = [];
    const remainingTags: string[] = [];
    
    // Check each metadata category
    if (original.gps && !remaining.gps) removed.push('GPS');
    if (original.camera?.serialNumber && !remaining.camera?.serialNumber) {
      removed.push('Camera Serial');
    }
    if (original.author?.name && !remaining.author?.name) {
      removed.push('Author');
    }
    if (original.dates?.created && !remaining.dates?.created) {
      removed.push('Dates');
    }
    if (original.software?.editingSoftware && !remaining.software?.editingSoftware) {
      removed.push('Software');
    }
    
    // Check remaining
    if (remaining.gps) remainingTags.push('GPS');
    if (remaining.camera?.serialNumber) remainingTags.push('Camera Serial');
    if (remaining.author?.name) remainingTags.push('Author');
    if (remaining.dates?.created) remainingTags.push('Dates');
    if (remaining.software?.editingSoftware) remainingTags.push('Software');
    
    return {
      complete: remainingTags.length === 0,
      removed,
      remaining: remainingTags
    };
  }

  private async logScrubOperation(
    filePath: string,
    verification: any,
    backupPath: string | null
  ) {
    const db = this.db.getDatabase();
    
    const fileRecord = db.prepare('SELECT id FROM files WHERE file_path = ?').get(filePath) as any;
    
    db.prepare(`
      INSERT INTO scrub_history (
        file_id, metadata_removed, backup_location
      ) VALUES (?, ?, ?)
    `).run(
      fileRecord?.id ?? null,
      JSON.stringify(verification.removed),
      backupPath
    );
  }

  async bulkScrub(
    filePaths: string[],
    options: ScrubOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<ScrubResult[]> {
    const results: ScrubResult[] = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      const result = await this.scrubMetadata(filePaths[i], options);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, filePaths.length);
      }
    }
    
    return results;
  }
}

interface MetadataReport {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  gps: any | null;
  camera: any | null;
  author: {
    name: string | null;
    copyright: string | null;
  };
  dates: {
    created: string | null;
    modified: string | null;
    digitized: string | null;
  };
  software: {
    creationSoftware: string | null;
    editingSoftware: string | null;
    history: any | null;
  };
  technical: {
    resolution: string | null;
    colorProfile: string | null;
    compression: string | null;
    quality: string | null;
  };
}

interface ScrubOptions {
  removeList: string[];
  createBackup: boolean;
  backupEncrypted: boolean;
}

interface ScrubResult {
  success: boolean;
  removedTags: string[];
  remainingTags: string[];
  backupPath: string | null;
  sizeReduction: number;
}
