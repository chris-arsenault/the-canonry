/**
 * Markov Chain Name Generator
 *
 * Uses pre-trained character-level Markov chains to generate names
 * that statistically resemble a given language/culture family.
 */

import seedrandom from "seedrandom";

export interface MarkovModel {
  order: number;
  startStates: Record<string, number>; // state -> probability
  transitions: Record<string, Record<string, number>>; // state -> (char -> probability)
}

const START = "^";
const END = "$";

/**
 * Generate a name from a Markov model
 */
export function generateFromMarkov(
  model: MarkovModel,
  options: {
    minLength?: number;
    maxLength?: number;
    seed?: string;
  } = {}
): string {
  const { minLength = 3, maxLength = 12, seed } = options;
  const rng = seed ? seedrandom(seed) : Math.random;

  // Pick start state
  let state = weightedRandom(model.startStates, rng);
  let result = "";

  for (let i = 0; i < maxLength + model.order; i++) {
    const nextProbs = model.transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs, rng);
    if (next === END) {
      if (result.length >= minLength) break;
      // Too short, continue (might get stuck in rare cases)
      continue;
    }

    result += next;
    state = state.slice(1) + next;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Generate multiple unique names from a Markov model
 */
export function generateNamesFromMarkov(
  model: MarkovModel,
  count: number,
  options: {
    minLength?: number;
    maxLength?: number;
    seed?: string;
  } = {}
): string[] {
  const names = new Set<string>();
  const baseSeed = options.seed || String(Date.now());
  let attempts = 0;
  const maxAttempts = count * 10;

  while (names.size < count && attempts < maxAttempts) {
    const name = generateFromMarkov(model, {
      ...options,
      seed: `${baseSeed}-${attempts}`,
    });

    if (name.length >= (options.minLength || 3)) {
      names.add(name);
    }
    attempts++;
  }

  return Array.from(names);
}

/**
 * Weighted random selection
 */
function weightedRandom(
  probs: Record<string, number>,
  rng: () => number = Math.random
): string {
  const r = rng();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  // Fallback (shouldn't happen with normalized probs)
  return Object.keys(probs)[0];
}

/**
 * Available pre-trained models
 */
export type MarkovModelId =
  | "norse"
  | "germanic"
  | "finnish"
  | "arabic"
  | "celtic"
  | "slavic"
  | "latin"
  | "japanese"
  | "african";

/**
 * Model metadata
 */
export const MARKOV_MODELS: Record<
  MarkovModelId,
  {
    name: string;
    description: string;
    examples: string[];
  }
> = {
  norse: {
    name: "Norse",
    description: "Norwegian/Scandinavian names (Viking-era feel)",
    examples: ["Eirik", "Astrid", "Thorvald"],
  },
  germanic: {
    name: "Germanic",
    description: "Swedish/German names (broader Germanic family)",
    examples: ["Wilhelm", "Greta", "Heinrich"],
  },
  finnish: {
    name: "Finnish",
    description: "Finnish names (Uralic language family)",
    examples: ["Väinö", "Aino", "Matti"],
  },
  arabic: {
    name: "Arabic",
    description: "Arabic names (Semitic language family)",
    examples: ["Khalid", "Fatima", "Omar"],
  },
  celtic: {
    name: "Celtic",
    description: "Irish/Welsh/Scottish Gaelic names",
    examples: ["Siobhan", "Rhys", "Aoife"],
  },
  slavic: {
    name: "Slavic",
    description: "Russian/Polish/Czech names",
    examples: ["Dmitri", "Natasha", "Vladimir"],
  },
  latin: {
    name: "Latin/Romance",
    description: "Latin-derived names (Italian, Spanish, French)",
    examples: ["Marcus", "Isabella", "Lorenzo"],
  },
  japanese: {
    name: "Japanese",
    description: "Japanese names in romaji (from ENAMDICT)",
    examples: ["Akiko", "Takeshi", "Haruki"],
  },
  african: {
    name: "African",
    description: "Pan-African names (Swahili, Yoruba, Zulu, Igbo)",
    examples: ["Amara", "Kwame", "Zuri"],
  },
};

/**
 * Load a pre-trained model (to be implemented with actual model loading)
 */
export async function loadMarkovModel(
  modelId: MarkovModelId
): Promise<MarkovModel | null> {
  try {
    // Use fs to load model JSON
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Resolve project root - handle both source (lib/) and compiled (dist/lib/) paths
    const projectRoot = __dirname.includes("/dist/")
      ? path.join(__dirname, "..", "..")
      : path.join(__dirname, "..");

    const modelPath = path.join(
      projectRoot,
      "data",
      "markov",
      "models",
      `${modelId}.json`
    );
    const data = fs.readFileSync(modelPath, "utf-8");
    return JSON.parse(data) as MarkovModel;
  } catch (error) {
    console.warn(`Markov model '${modelId}' not found`);
    return null;
  }
}

/**
 * Model cache for runtime
 */
const modelCache = new Map<MarkovModelId, MarkovModel>();

/**
 * Get a cached model or load it
 */
export async function getMarkovModel(
  modelId: MarkovModelId
): Promise<MarkovModel | null> {
  if (modelCache.has(modelId)) {
    return modelCache.get(modelId)!;
  }

  const model = await loadMarkovModel(modelId);
  if (model) {
    modelCache.set(modelId, model);
  }
  return model;
}
