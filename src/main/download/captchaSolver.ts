/**
 * CAPTCHA Solver — Integration with 2captcha / Anti-Captcha APIs.
 *
 * This module provides a unified interface for solving CAPTCHAs
 * encountered during automated downloads (reCAPTCHA, hCaptcha, image CAPTCHAs).
 *
 * To enable: Set CAPTCHA_API_KEY environment variable or configure in Settings.
 */

export interface CaptchaSolution {
  solution: string;
  solveTime: number;
  provider: string;
}

export interface CaptchaSolverConfig {
  provider: '2captcha' | 'anticaptcha' | 'capmonster';
  apiKey: string;
  timeout?: number; // ms, default 120000
}

export class CaptchaSolver {
  private static instance: CaptchaSolver;
  private config: CaptchaSolverConfig | null = null;

  private constructor() {
    // Try to load config from environment or settings
    const apiKey = process.env.CAPTCHA_API_KEY || '';
    if (apiKey) {
      this.config = {
        provider: (process.env.CAPTCHA_PROVIDER as any) || '2captcha',
        apiKey,
        timeout: 120000
      };
    }
  }

  static getInstance(): CaptchaSolver {
    if (!CaptchaSolver.instance) {
      CaptchaSolver.instance = new CaptchaSolver();
    }
    return CaptchaSolver.instance;
  }

  /**
   * Configure the CAPTCHA solver with API credentials.
   */
  configure(config: CaptchaSolverConfig): void {
    this.config = config;
  }

  /**
   * Check if a CAPTCHA solver is configured.
   */
  isConfigured(): boolean {
    return !!this.config?.apiKey;
  }

  /**
   * Solve a reCAPTCHA v2 challenge.
   * @param siteKey - The reCAPTCHA site key from the page
   * @param pageUrl - The URL of the page with the CAPTCHA
   */
  async solveRecaptcha(siteKey: string, pageUrl: string): Promise<CaptchaSolution> {
    if (!this.config) {
      throw new Error('CAPTCHA solver not configured. Set CAPTCHA_API_KEY environment variable.');
    }

    const startTime = Date.now();

    // 2captcha API integration
    if (this.config.provider === '2captcha') {
      return this.solveVia2Captcha('recaptcha', { sitekey: siteKey, pageurl: pageUrl }, startTime);
    }

    // Anti-Captcha API integration
    if (this.config.provider === 'anticaptcha') {
      return this.solveViaAntiCaptcha('RecaptchaV2TaskProxyless', {
        websiteURL: pageUrl,
        websiteKey: siteKey
      }, startTime);
    }

    throw new Error(`Unsupported provider: ${this.config.provider}`);
  }

  /**
   * Solve an image CAPTCHA from a base64 image.
   */
  async solveImageCaptcha(base64Image: string): Promise<CaptchaSolution> {
    if (!this.config) {
      throw new Error('CAPTCHA solver not configured. Set CAPTCHA_API_KEY environment variable.');
    }

    const startTime = Date.now();

    if (this.config.provider === '2captcha') {
      return this.solveVia2Captcha('base64', { body: base64Image }, startTime);
    }

    throw new Error(`Image CAPTCHA not supported for provider: ${this.config.provider}`);
  }

  private async solveVia2Captcha(
    type: string,
    params: Record<string, string>,
    startTime: number
  ): Promise<CaptchaSolution> {
    // 2captcha API implementation
    // POST https://2captcha.com/in.php
    // GET https://2captcha.com/res.php

    const axios = require('axios');
    const baseUrl = 'https://2captcha.com';

    // Submit CAPTCHA
    const submitResponse = await axios.post(`${baseUrl}/in.php`, {
      key: this.config!.apiKey,
      method: type === 'recaptcha' ? 'userrecaptcha' : 'base64',
      ...params,
      json: 1
    });

    if (submitResponse.data.status !== 1) {
      throw new Error(`2captcha submit failed: ${submitResponse.data.request}`);
    }

    const taskId = submitResponse.data.request;

    // Poll for result
    const timeout = this.config!.timeout || 120000;
    const pollInterval = 5000;
    const maxAttempts = Math.ceil(timeout / pollInterval);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const resultResponse = await axios.get(`${baseUrl}/res.php`, {
        params: {
          key: this.config!.apiKey,
          action: 'get',
          id: taskId,
          json: 1
        }
      });

      if (resultResponse.data.status === 1) {
        return {
          solution: resultResponse.data.request,
          solveTime: Date.now() - startTime,
          provider: '2captcha'
        };
      }

      if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2captcha failed: ${resultResponse.data.request}`);
      }
    }

    throw new Error('2captcha timeout — CAPTCHA not solved within time limit');
  }

  private async solveViaAntiCaptcha(
    taskType: string,
    taskData: Record<string, string>,
    startTime: number
  ): Promise<CaptchaSolution> {
    const axios = require('axios');
    const baseUrl = 'https://api.anti-captcha.com';

    // Create task
    const createResponse = await axios.post(`${baseUrl}/createTask`, {
      clientKey: this.config!.apiKey,
      task: {
        type: taskType,
        ...taskData
      }
    });

    if (createResponse.data.errorId !== 0) {
      throw new Error(`Anti-Captcha error: ${createResponse.data.errorDescription}`);
    }

    const taskId = createResponse.data.taskId;

    // Poll for result
    const timeout = this.config!.timeout || 120000;
    const pollInterval = 5000;
    const maxAttempts = Math.ceil(timeout / pollInterval);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const resultResponse = await axios.post(`${baseUrl}/getTaskResult`, {
        clientKey: this.config!.apiKey,
        taskId
      });

      if (resultResponse.data.status === 'ready') {
        return {
          solution: resultResponse.data.solution.gRecaptchaResponse,
          solveTime: Date.now() - startTime,
          provider: 'anticaptcha'
        };
      }

      if (resultResponse.data.errorId !== 0) {
        throw new Error(`Anti-Captcha error: ${resultResponse.data.errorDescription}`);
      }
    }

    throw new Error('Anti-Captcha timeout — CAPTCHA not solved within time limit');
  }
}
