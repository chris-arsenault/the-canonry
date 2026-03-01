/**
 * Markov Model Loader
 *
 * Environment-aware loader with shared caching logic.
 * - Browser: Uses fetch from configurable base URL
 * - Node.js: Uses fs from bundled data directory (loaded dynamically)
 */

import type { MarkovModel, MarkovModelId } from "./markov.js";
import type { Grammar } from "./types/project.js";

// ============================================================================
// Shared State
// ============================================================================

const modelCache = new Map<MarkovModelId, MarkovModel>();
let browserBaseUrl = "/markov-models";

// Lazy-loaded Node.js loader (only loaded in Node environment)
let nodeLoader: { loadModelFromFilesystem: (id: string) => MarkovModel | null } | null = null;

// ============================================================================
// Environment Detection
// ============================================================================

// Check for browser environment safely (works in Node.js without DOM types)
const isBrowser =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as { window?: unknown }).window !== "undefined";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configure the base URL for browser model loading.
 * Call this before generating names in browser environment.
 */
export function setMarkovBaseUrl(baseUrl: string): void {
  browserBaseUrl = baseUrl.replace(/\/$/, "");
}

// ============================================================================
// Model Loading
// ============================================================================

/**
 * Load a model from the network (browser).
 */
async function loadFromBrowser(modelId: string): Promise<MarkovModel | null> {
  const url = `${browserBaseUrl}/${modelId}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Markov model '${modelId}' not found at ${url}`);
      return null;
    }
    return (await response.json()) as MarkovModel;
  } catch (error) {
    console.warn(`Failed to fetch Markov model '${modelId}':`, error);
    return null;
  }
}

/**
 * Load a model from filesystem (Node.js).
 * Dynamically imports the node loader on first use.
 */
async function loadFromNode(modelId: string): Promise<MarkovModel | null> {
  if (!nodeLoader) {
    // Dynamic import - only happens in Node.js
    // Using variable to prevent Vite from analyzing this import
    const modulePath = "./markov-loader-node.js";
    nodeLoader = await import(/* @vite-ignore */ modulePath) as typeof nodeLoader;
  }
  return nodeLoader!.loadModelFromFilesystem(modelId);
}

/**
 * Load a Markov model by ID.
 */
export async function loadMarkovModel(
  modelId: MarkovModelId
): Promise<MarkovModel | null> {
  // Check cache first
  if (modelCache.has(modelId)) {
    return modelCache.get(modelId)!;
  }

  try {
    const model = isBrowser
      ? await loadFromBrowser(modelId)
      : await loadFromNode(modelId);

    if (model) {
      modelCache.set(modelId, model);
    }
    return model;
  } catch (error) {
    console.warn(`Failed to load Markov model '${modelId}':`, error);
    return null;
  }
}

// ============================================================================
// Grammar Scanning
// ============================================================================

/**
 * Extract Markov model IDs referenced in grammars.
 */
export function extractMarkovModelIds(grammars: Grammar[]): MarkovModelId[] {
  const modelIds = new Set<MarkovModelId>();

  for (const grammar of grammars) {
    for (const productions of Object.values(grammar.rules || {})) {
      for (const production of productions) {
        for (const token of production) {
          const match = token.match(/markov:([a-z]+)/);
          if (match) {
            modelIds.add(match[1] as MarkovModelId);
          }
        }
      }
    }
  }

  return Array.from(modelIds);
}

// ============================================================================
// Preloading
// ============================================================================

/**
 * Preload all Markov models referenced in grammars.
 */
export async function preloadModels(
  grammars: Grammar[]
): Promise<Map<string, MarkovModel>> {
  const modelIds = extractMarkovModelIds(grammars);
  const models = new Map<string, MarkovModel>();

  await Promise.all(
    modelIds.map(async (id) => {
      const model = await loadMarkovModel(id);
      if (model) {
        models.set(id, model);
      }
    })
  );

  return models;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Check if a model is cached.
 */
export function isModelCached(modelId: MarkovModelId): boolean {
  return modelCache.has(modelId);
}

/**
 * Clear the model cache.
 */
export function clearModelCache(): void {
  modelCache.clear();
}
