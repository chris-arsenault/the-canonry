import crypto from 'crypto';
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

  constructor(config: LLMConfig) {
    this.config = config;
  }

  public isEnabled(): boolean {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    return Boolean(this.config.enabled && apiKey);
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.isEnabled()) {
      return { text: '', cached: false, skipped: true };
    }

    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { text: '', cached: false, skipped: true };
    }

    const cacheKey = this.createCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { text: cached, cached: true };
    }

    const fetchFn: any = (globalThis as any).fetch;
    if (!fetchFn) {
      return { text: '', cached: false, skipped: true };
    }

    const body = {
      model: this.config.model,
      max_tokens: request.maxTokens || this.config.maxTokens || 256,
      temperature: request.temperature ?? this.config.temperature ?? 0.4,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      ...(request.json ? { response_format: { type: 'json_object' } } : {})
    };

    const response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`LLM request failed: ${response.status} ${text}`);
      return { text: '', cached: false, skipped: true };
    }

    const data: any = await response.json();
    const text = data?.content?.[0]?.text || '';

    if (text) {
      this.cache.set(cacheKey, text);
    }

    return { text, cached: false };
  }

  private createCacheKey(request: LLMRequest): string {
    const payload = `${request.systemPrompt}|${request.prompt}|${request.maxTokens}|${request.temperature}|${request.json}`;
    return crypto.createHash('sha1').update(payload).digest('hex');
  }
}
