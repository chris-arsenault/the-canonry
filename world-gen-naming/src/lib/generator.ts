import type {
  NamingDomain,
  GenerationRequest,
  GenerationResult,
} from "../types/domain.js";
import { createRNG } from "../utils/rng.js";
import { selectDomain, explainDomainSelection } from "./domain-selector.js";
import { generateWordWithDebug } from "./phonology.js";
import { applyMorphologyBest, canApplyMorphology } from "./morphology.js";
import { applyStyle } from "./style.js";

/**
 * Main name generation function
 * Orchestrates the full pipeline: domain selection → phonology → morphology → style
 */
export function generateName(
  domains: NamingDomain[],
  request: GenerationRequest
): GenerationResult | null {
  // Create RNG
  const rng = createRNG(request.seed);

  // Select domain
  const tags = request.tags ?? [];
  const domain = selectDomain(
    domains,
    request.kind,
    request.subKind,
    tags
  );

  if (!domain) {
    console.warn(
      `No domain found for kind=${request.kind}, subKind=${request.subKind}, tags=${tags.join(",")}`
    );
    return null;
  }

  // Step 1: Generate phonological base
  const { word, syllables, templates } = generateWordWithDebug(
    rng,
    domain.phonology
  );

  // Step 2: Apply morphology (if configured)
  let morphedName = word;
  let morphologyStructure = "root";
  let morphologyParts: string[] = [`root:${word}`];

  if (canApplyMorphology(domain.morphology)) {
    const morphed = applyMorphologyBest(rng, word, domain.morphology);
    morphedName = morphed.result;
    morphologyStructure = morphed.structure;
    morphologyParts = morphed.parts;
  }

  // Step 3: Apply style transforms
  const { result: finalName, transforms } = applyStyle(
    rng,
    morphedName,
    domain.style,
    syllables
  );

  return {
    name: finalName,
    domainId: domain.id,
    debug: {
      syllables,
      structure: morphologyStructure,
      phonology: `${templates.join("-")} → ${word}`,
      morphology: morphologyParts.join(" + "),
      style: transforms.join(", "),
    },
  };
}

/**
 * Generate multiple names
 */
export function generateNames(
  domains: NamingDomain[],
  request: GenerationRequest
): GenerationResult[] {
  const results: GenerationResult[] = [];
  const count = request.count ?? 1;

  for (let i = 0; i < count; i++) {
    // Create a unique seed for each name if seed was provided
    const seed = request.seed ? `${request.seed}-${i}` : undefined;
    const result = generateName(domains, { ...request, seed, count: 1 });

    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Generate names with deduplication
 * Keeps generating until we have the requested count of unique names
 */
export function generateUniqueNames(
  domains: NamingDomain[],
  request: GenerationRequest,
  maxAttempts: number = 1000
): GenerationResult[] {
  const results: GenerationResult[] = [];
  const seen = new Set<string>();
  const count = request.count ?? 1;
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;

    // Generate with a unique seed based on attempt
    const seed = request.seed ? `${request.seed}-${attempts}` : undefined;
    const result = generateName(domains, { ...request, seed, count: 1 });

    if (result && !seen.has(result.name)) {
      seen.add(result.name);
      results.push(result);
    }
  }

  if (results.length < count) {
    console.warn(
      `Could only generate ${results.length}/${count} unique names after ${maxAttempts} attempts`
    );
  }

  return results;
}

/**
 * Explain why a particular domain was selected for an entity
 */
export function explainGeneration(
  domains: NamingDomain[],
  kind: string,
  subKind?: string,
  tags: string[] = []
): string {
  return explainDomainSelection(domains, kind, subKind, tags);
}

/**
 * Test domain generation - generate samples and return statistics
 */
export function testDomain(
  domain: NamingDomain,
  sampleCount: number = 100,
  seed?: string
): {
  samples: string[];
  uniqueCount: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
} {
  const rng = createRNG(seed);
  const samples: string[] = [];
  const uniqueSamples = new Set<string>();

  for (let i = 0; i < sampleCount; i++) {
    const { word, syllables } = generateWordWithDebug(rng, domain.phonology);

    let name = word;
    if (canApplyMorphology(domain.morphology)) {
      const morphed = applyMorphologyBest(rng, word, domain.morphology);
      name = morphed.result;
    }

    const { result } = applyStyle(rng, name, domain.style, syllables);
    samples.push(result);
    uniqueSamples.add(result);
  }

  const lengths = samples.map((s) => s.length);
  const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);

  return {
    samples,
    uniqueCount: uniqueSamples.size,
    avgLength,
    minLength,
    maxLength,
  };
}
