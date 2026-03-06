/**
 * Word Embeddings Loader
 *
 * Loads and queries pre-computed word embeddings for semantic similarity.
 * Uses a curated vocabulary focused on world-building terminology.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Embedding vocabulary structure.
 */
interface EmbeddingVocabulary {
  dimensions: number;
  words: Record<string, number[]>;
}

/**
 * Loaded embeddings (lazy initialization).
 */
let embeddings: EmbeddingVocabulary | null = null;
let embeddingsLoaded = false;

/**
 * Path to the embeddings data file.
 */
const EMBEDDINGS_PATH = join(__dirname, 'data', 'vectors.json');

/**
 * Load embeddings from file.
 */
function loadEmbeddings(): void {
  if (embeddingsLoaded) return;

  embeddingsLoaded = true;

  if (!existsSync(EMBEDDINGS_PATH)) {
    console.warn(`Embeddings file not found at ${EMBEDDINGS_PATH}. Using keyword matching only.`);
    return;
  }

  try {
    const data = readFileSync(EMBEDDINGS_PATH, 'utf-8');
    embeddings = JSON.parse(data) as EmbeddingVocabulary;
    console.log(`Loaded ${Object.keys(embeddings.words).length} word embeddings (${embeddings.dimensions}D)`);
  } catch (error) {
    console.warn('Failed to load embeddings:', error);
    embeddings = null;
  }
}

/**
 * Check if embeddings are available.
 */
export function hasEmbeddings(): boolean {
  loadEmbeddings();
  return embeddings !== null;
}

/**
 * Get the embedding vector for a word.
 */
export function getEmbedding(word: string): number[] | null {
  loadEmbeddings();
  if (!embeddings) return null;

  const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
  return embeddings.words[normalized] ?? null;
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Get similarity between two words (0-1).
 */
export function getEmbeddingSimilarity(word1: string, word2: string): number | null {
  const v1 = getEmbedding(word1);
  const v2 = getEmbedding(word2);

  if (!v1 || !v2) return null;

  // Cosine similarity returns -1 to 1, normalize to 0-1
  const sim = cosineSimilarity(v1, v2);
  return (sim + 1) / 2;
}

/**
 * Find the most similar word in vocabulary.
 */
export function findMostSimilar(word: string, topK: number = 5): Array<{ word: string; similarity: number }> {
  loadEmbeddings();
  if (!embeddings) return [];

  const targetVec = getEmbedding(word);
  if (!targetVec) return [];

  const similarities: Array<{ word: string; similarity: number }> = [];

  for (const [w, vec] of Object.entries(embeddings.words)) {
    if (w === word.toLowerCase()) continue;

    const sim = cosineSimilarity(targetVec, vec);
    similarities.push({ word: w, similarity: (sim + 1) / 2 });
  }

  return [...similarities]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Calculate centroid of multiple words.
 */
export function calculateCentroid(words: string[]): number[] | null {
  loadEmbeddings();
  if (!embeddings) return null;

  const vectors: number[][] = [];
  for (const word of words) {
    const vec = getEmbedding(word);
    if (vec) vectors.push(vec);
  }

  if (vectors.length === 0) return null;

  const dimensions = embeddings.dimensions;
  const centroid: number[] = new Array<number>(dimensions).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

/**
 * Get similarity between a word and a centroid.
 */
export function similarityToCentroid(word: string, centroid: number[]): number | null {
  const vec = getEmbedding(word);
  if (!vec) return null;

  const sim = cosineSimilarity(vec, centroid);
  return (sim + 1) / 2;
}

/**
 * Get vocabulary statistics.
 */
export function getVocabularyStats(): {
  loaded: boolean;
  wordCount: number;
  dimensions: number;
} {
  loadEmbeddings();
  return {
    loaded: embeddings !== null,
    wordCount: embeddings ? Object.keys(embeddings.words).length : 0,
    dimensions: embeddings?.dimensions ?? 0
  };
}
