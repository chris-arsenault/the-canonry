import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig } from '../types/engine';

export interface LLMRequest {
  systemPrompt: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}

export interface LLMResult {
  text: string;
  cached: boolean;
  skipped?: boolean;
}

export class LLMClient {
  private cache = new Map<string, string>();
  private config: LLMConfig;
  private client?: Anthropic;

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: (config.model || '').trim(),
      apiKey: (config.apiKey || process.env.ANTHROPIC_API_KEY || '').trim()
    };
    const apiKey = this.config.apiKey;
    if (this.config.enabled && apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public isEnabled(): boolean {
    return Boolean(this.client);
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.client) {
      return { text: '', cached: false, skipped: true };
    }

    const cacheKey = this.createCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { text: cached, cached: true };
    }

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: request.maxTokens || this.config.maxTokens || 256,
        temperature: request.temperature ?? this.config.temperature ?? 0.4,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }]
      });

      let text = '';
      for (const part of response.content) {
        if (part.type === 'text') {
          text += part.text;
        }
      }

      if (text) {
        this.cache.set(cacheKey, text);
      }

      return { text, cached: false };
    } catch (error: any) {
      console.warn('LLM request failed:', error?.message || error);
      return { text: '', cached: false, skipped: true };
    }
  }

  private createCacheKey(request: LLMRequest): string {
    const payload = `${request.systemPrompt}|${request.prompt}|${request.maxTokens}|${request.temperature}|${request.json}`;
    return crypto.createHash('sha1').update(payload).digest('hex');
  }
}
