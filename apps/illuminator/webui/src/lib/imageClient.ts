/**
 * Image Client re-export
 *
 * Re-exports the browser-compatible image generation client for use in workers.
 */

export { ImageGenerationClient as ImageClient } from './llmClient.browser';
export type { ImageConfig, ImageRequest, ImageResult } from './llmClient.browser';
