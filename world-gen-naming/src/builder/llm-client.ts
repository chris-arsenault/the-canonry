/**
 * LLM Client (Phase 5)
 *
 * Wrapper around Anthropic API for content generation.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMConfig } from "../types/builder-spec.js";

/**
 * LLM client for content generation
 */
export class LLMClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Anthropic API key not provided. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config."
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model = config.model || "claude-haiku-4-5-20251001";
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature ?? 1.0;
  }

  /**
   * Generate text with system prompt and user message
   */
  async generate(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ text: string; tokensUsed: number }> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n");

    const tokensUsed =
      message.usage.input_tokens + message.usage.output_tokens;

    return { text, tokensUsed };
  }

  /**
   * Generate JSON response
   * Parses the response as JSON and validates it
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    validator?: (data: unknown) => T
  ): Promise<{ data: T; tokensUsed: number }> {
    const { text, tokensUsed } = await this.generate(systemPrompt, userPrompt);

    // Extract JSON from markdown code blocks if present
    let jsonText = text.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonText);
      const data = validator ? validator(parsed) : (parsed as T);
      return { data, tokensUsed };
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${error}\n\nResponse text:\n${text}`
      );
    }
  }

  /**
   * Generate with retries
   */
  async generateWithRetries<T>(
    systemPrompt: string,
    userPrompt: string,
    validator?: (data: unknown) => T,
    maxRetries: number = 3
  ): Promise<{ data: T; tokensUsed: number; attempts: number }> {
    let lastError: Error | null = null;
    let totalTokens = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generateJSON<T>(
          systemPrompt,
          userPrompt,
          validator
        );
        totalTokens += result.tokensUsed;
        return { data: result.data, tokensUsed: totalTokens, attempts: attempt };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const waitMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    throw new Error(
      `Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }
}

/**
 * Create LLM client from config
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}
