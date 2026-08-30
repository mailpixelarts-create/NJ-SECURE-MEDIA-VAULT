import { pipeline, env } from '@xenova/transformers';
import * as path from 'path';
import * as fs from 'fs';

// Configure transformers to use local cache and avoid external downloads once cached
env.localModelPath = path.join(process.cwd(), 'models');
env.allowRemoteModels = true; // Allow first-time download

export class AITagger {
  private static instance: AITagger;
  private classifier: any = null;

  private constructor() {}

  static getInstance(): AITagger {
    if (!AITagger.instance) {
      AITagger.instance = new AITagger();
    }
    return AITagger.instance;
  }

  async initialize() {
    if (!this.classifier) {
      // Using a small efficient model for image classification
      this.classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224');
    }
  }

  async tagImage(filePath: string): Promise<string[]> {
    await this.initialize();

    try {
      // For transformers to process an image in Node, it expects a file URL or path
      // Note: we would read the decrypted buffer if the file is encrypted.
      // Assuming filePath is unencrypted or we use the vault:// protocol if handled.
      // But for simplicity, we classify an unencrypted temporary file or buffer
      
      const fileUrl = `file://${path.resolve(filePath)}`;
      const results = await this.classifier(fileUrl);
      
      // returns array of { label, score }
      return results
        .filter((r: any) => r.score > 0.1) // Only reasonably confident tags
        .map((r: any) => r.label);
    } catch (error) {
      console.error('Failed to tag image:', error);
      return [];
    }
  }
}
