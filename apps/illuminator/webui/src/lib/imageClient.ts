/**
 * Image Client re-export
 *
 * Re-exports the browser-compatible image generation client for use in workers.
 */

export { ImageGenerationClient as ImageClient } from "./imageClient.browser";
export { WaveSpeedImageClient } from "./imageClient.wavespeed";
export { BflImageClient } from "./imageClient.bfl";
export type { ImageConfig, ImageRequest, ImageResult } from "./imageClient.browser";
export { isWaveSpeedModel, isBflModel } from "./imageSettings";
