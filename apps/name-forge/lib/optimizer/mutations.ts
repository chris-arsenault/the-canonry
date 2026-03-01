/**
 * Mutation Operators for Genetic Optimization
 *
 * Provides operators for mutating discrete domain properties:
 * - Phoneme add/remove/swap
 * - Template add/remove/modify
 * - Cluster discovery and mutation
 */

import type { NamingDomain } from "../types/domain.js";
import {
  getAvailableConsonants,
  getAvailableVowels,
  getAvailableTemplates,
  getAvailableClusters,
} from "../phoneme-library.js";

/**
 * Random number generator type
 */
type RNG = () => number;

/**
 * Pick random element from array
 */
function pickRandom<T>(arr: T[], rng: RNG): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pick N random elements from array
 */
function pickMultiple<T>(arr: T[], n: number, rng: RNG): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

// ============================================
// PHONEME MUTATIONS
// ============================================

/**
 * Add a random consonant from the library
 */
export function addConsonant(domain: NamingDomain, rng: RNG): NamingDomain {
  const available = getAvailableConsonants(domain.phonology.consonants);
  if (available.length === 0) return domain;

  const newConsonant = pickRandom(available, rng);
  const newConsonants = [...domain.phonology.consonants, newConsonant];
  const newWeights = [...(domain.phonology.consonantWeights || []), 1.0];

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      consonants: newConsonants,
      consonantWeights: newWeights,
    },
  };
}

/**
 * Remove a consonant (preferring low-weight ones)
 */
export function removeConsonant(domain: NamingDomain, rng: RNG): NamingDomain {
  if (domain.phonology.consonants.length <= 3) return domain; // Keep minimum

  const weights = domain.phonology.consonantWeights ||
    domain.phonology.consonants.map(() => 1);

  // Weight removal probability by inverse of current weight
  const inverseWeights = weights.map(w => 1 / (w + 0.1));
  const totalInverse = inverseWeights.reduce((a, b) => a + b, 0);

  let roll = rng() * totalInverse;
  let removeIndex = 0;
  for (let i = 0; i < inverseWeights.length; i++) {
    roll -= inverseWeights[i];
    if (roll <= 0) {
      removeIndex = i;
      break;
    }
  }

  const newConsonants = domain.phonology.consonants.filter((_, i) => i !== removeIndex);
  const newWeights = weights.filter((_, i) => i !== removeIndex);

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      consonants: newConsonants,
      consonantWeights: newWeights,
    },
  };
}

/**
 * Swap a consonant with one from the library
 */
export function swapConsonant(domain: NamingDomain, rng: RNG): NamingDomain {
  const available = getAvailableConsonants(domain.phonology.consonants);
  if (available.length === 0) return domain;

  const swapIndex = Math.floor(rng() * domain.phonology.consonants.length);
  const newConsonant = pickRandom(available, rng);

  const newConsonants = [...domain.phonology.consonants];
  newConsonants[swapIndex] = newConsonant;

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      consonants: newConsonants,
    },
  };
}

/**
 * Add a random vowel from the library
 */
export function addVowel(domain: NamingDomain, rng: RNG): NamingDomain {
  const available = getAvailableVowels(domain.phonology.vowels);
  if (available.length === 0) return domain;

  const newVowel = pickRandom(available, rng);
  const newVowels = [...domain.phonology.vowels, newVowel];
  const newWeights = [...(domain.phonology.vowelWeights || []), 1.0];

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      vowels: newVowels,
      vowelWeights: newWeights,
    },
  };
}

/**
 * Remove a vowel (preferring low-weight ones)
 */
export function removeVowel(domain: NamingDomain, rng: RNG): NamingDomain {
  if (domain.phonology.vowels.length <= 2) return domain; // Keep minimum

  const weights = domain.phonology.vowelWeights ||
    domain.phonology.vowels.map(() => 1);

  const inverseWeights = weights.map(w => 1 / (w + 0.1));
  const totalInverse = inverseWeights.reduce((a, b) => a + b, 0);

  let roll = rng() * totalInverse;
  let removeIndex = 0;
  for (let i = 0; i < inverseWeights.length; i++) {
    roll -= inverseWeights[i];
    if (roll <= 0) {
      removeIndex = i;
      break;
    }
  }

  const newVowels = domain.phonology.vowels.filter((_, i) => i !== removeIndex);
  const newWeights = weights.filter((_, i) => i !== removeIndex);

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      vowels: newVowels,
      vowelWeights: newWeights,
    },
  };
}

/**
 * Swap a vowel with one from the library
 */
export function swapVowel(domain: NamingDomain, rng: RNG): NamingDomain {
  const available = getAvailableVowels(domain.phonology.vowels);
  if (available.length === 0) return domain;

  const swapIndex = Math.floor(rng() * domain.phonology.vowels.length);
  const newVowel = pickRandom(available, rng);

  const newVowels = [...domain.phonology.vowels];
  newVowels[swapIndex] = newVowel;

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      vowels: newVowels,
    },
  };
}

// ============================================
// TEMPLATE MUTATIONS
// ============================================

/**
 * Add a syllable template from the library
 */
export function addTemplate(domain: NamingDomain, rng: RNG): NamingDomain {
  const available = getAvailableTemplates(domain.phonology.syllableTemplates);
  if (available.length === 0) return domain;

  const newTemplate = pickRandom(available, rng);
  const newTemplates = [...domain.phonology.syllableTemplates, newTemplate];
  const newWeights = [...(domain.phonology.templateWeights || []), 1.0];

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      syllableTemplates: newTemplates,
      templateWeights: newWeights,
    },
  };
}

/**
 * Remove a template (preferring low-weight ones)
 */
export function removeTemplate(domain: NamingDomain, rng: RNG): NamingDomain {
  if (domain.phonology.syllableTemplates.length <= 1) return domain;

  const weights = domain.phonology.templateWeights ||
    domain.phonology.syllableTemplates.map(() => 1);

  const inverseWeights = weights.map(w => 1 / (w + 0.1));
  const totalInverse = inverseWeights.reduce((a, b) => a + b, 0);

  let roll = rng() * totalInverse;
  let removeIndex = 0;
  for (let i = 0; i < inverseWeights.length; i++) {
    roll -= inverseWeights[i];
    if (roll <= 0) {
      removeIndex = i;
      break;
    }
  }

  const newTemplates = domain.phonology.syllableTemplates.filter((_, i) => i !== removeIndex);
  const newWeights = weights.filter((_, i) => i !== removeIndex);

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      syllableTemplates: newTemplates,
      templateWeights: newWeights,
    },
  };
}

/**
 * Modify a template by adding or removing a position
 */
export function modifyTemplate(domain: NamingDomain, rng: RNG): NamingDomain {
  const templateIndex = Math.floor(rng() * domain.phonology.syllableTemplates.length);
  const template = domain.phonology.syllableTemplates[templateIndex];

  let newTemplate: string;

  if (rng() < 0.5 && template.length > 1) {
    // Remove a position
    const removePos = Math.floor(rng() * template.length);
    newTemplate = template.slice(0, removePos) + template.slice(removePos + 1);
  } else if (template.length < 5) {
    // Add a position
    const insertPos = Math.floor(rng() * (template.length + 1));
    const insertChar = rng() < 0.5 ? 'C' : 'V';
    newTemplate = template.slice(0, insertPos) + insertChar + template.slice(insertPos);
  } else {
    return domain;
  }

  // Validate template (must have at least one V)
  if (!newTemplate.includes('V')) return domain;

  const newTemplates = [...domain.phonology.syllableTemplates];
  newTemplates[templateIndex] = newTemplate;

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      syllableTemplates: newTemplates,
    },
  };
}

// ============================================
// CLUSTER MUTATIONS
// ============================================

/**
 * Add a consonant cluster
 */
export function addCluster(domain: NamingDomain, rng: RNG): NamingDomain {
  const currentClusters = domain.phonology.favoredClusters || [];
  const available = getAvailableClusters(currentClusters);
  if (available.length === 0) return domain;

  const newCluster = pickRandom(available, rng);

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      favoredClusters: [...currentClusters, newCluster],
    },
  };
}

/**
 * Remove a consonant cluster
 */
export function removeCluster(domain: NamingDomain, rng: RNG): NamingDomain {
  const clusters = domain.phonology.favoredClusters || [];
  if (clusters.length === 0) return domain;

  const removeIndex = Math.floor(rng() * clusters.length);
  const newClusters = clusters.filter((_, i) => i !== removeIndex);

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      favoredClusters: newClusters,
    },
  };
}

/**
 * Create a new cluster by combining existing consonants
 */
export function synthesizeCluster(domain: NamingDomain, rng: RNG): NamingDomain {
  const consonants = domain.phonology.consonants;
  if (consonants.length < 2) return domain;

  // Pick 2-3 consonants
  const clusterLength = rng() < 0.7 ? 2 : 3;
  const selected = pickMultiple(consonants, clusterLength, rng);
  const newCluster = selected.join('');

  const currentClusters = domain.phonology.favoredClusters || [];
  if (currentClusters.includes(newCluster)) return domain;

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      favoredClusters: [...currentClusters, newCluster],
    },
  };
}

// ============================================
// STYLE MUTATIONS
// ============================================

/**
 * Mutate apostrophe rate
 */
export function mutateApostropheRate(domain: NamingDomain, rng: RNG): NamingDomain {
  const current = domain.style.apostropheRate ?? 0;
  const delta = (rng() - 0.5) * 0.2; // +/- 10%
  const newRate = Math.max(0, Math.min(1, current + delta));

  return {
    ...domain,
    style: {
      ...domain.style,
      apostropheRate: newRate,
    },
  };
}

/**
 * Mutate hyphen rate
 */
export function mutateHyphenRate(domain: NamingDomain, rng: RNG): NamingDomain {
  const current = domain.style.hyphenRate ?? 0;
  const delta = (rng() - 0.5) * 0.2;
  const newRate = Math.max(0, Math.min(1, current + delta));

  return {
    ...domain,
    style: {
      ...domain.style,
      hyphenRate: newRate,
    },
  };
}

/**
 * Mutate length range
 */
export function mutateLengthRange(domain: NamingDomain, rng: RNG): NamingDomain {
  const [minLen, maxLen] = domain.phonology.lengthRange;

  // Mutate one bound by +/- 1-2
  const mutateMin = rng() < 0.5;
  const delta = Math.floor(rng() * 3) - 1; // -1, 0, or +1

  let newMin = minLen;
  let newMax = maxLen;

  if (mutateMin) {
    newMin = Math.max(2, minLen + delta);
    if (newMin > newMax) newMax = newMin;
  } else {
    newMax = Math.max(newMin, maxLen + delta);
    newMax = Math.min(20, newMax);
  }

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      lengthRange: [newMin, newMax] as [number, number],
    },
  };
}

// ============================================
// COMPOUND MUTATIONS
// ============================================

/**
 * All available mutation functions
 */
export const MUTATIONS = {
  // Phoneme mutations
  addConsonant,
  removeConsonant,
  swapConsonant,
  addVowel,
  removeVowel,
  swapVowel,

  // Template mutations
  addTemplate,
  removeTemplate,
  modifyTemplate,

  // Cluster mutations
  addCluster,
  removeCluster,
  synthesizeCluster,

  // Style mutations
  mutateApostropheRate,
  mutateHyphenRate,
  mutateLengthRange,
};

export type MutationType = keyof typeof MUTATIONS;

/**
 * Apply a random mutation
 */
export function applyRandomMutation(domain: NamingDomain, rng: RNG): NamingDomain {
  const mutationNames = Object.keys(MUTATIONS) as MutationType[];
  const mutation = pickRandom(mutationNames, rng);
  return MUTATIONS[mutation](domain, rng);
}

/**
 * Apply multiple random mutations
 */
export function applyMultipleMutations(
  domain: NamingDomain,
  count: number,
  rng: RNG
): NamingDomain {
  let result = domain;
  for (let i = 0; i < count; i++) {
    result = applyRandomMutation(result, rng);
  }
  return result;
}

/**
 * Mutation weights for different optimization goals
 */
export const MUTATION_WEIGHTS = {
  // For capacity optimization (more phonemes = more combinations)
  capacity: {
    addConsonant: 3,
    removeConsonant: 0.5,
    swapConsonant: 1,
    addVowel: 3,
    removeVowel: 0.5,
    swapVowel: 1,
    addTemplate: 2,
    removeTemplate: 0.5,
    modifyTemplate: 1,
    addCluster: 2,
    removeCluster: 0.5,
    synthesizeCluster: 1,
    mutateApostropheRate: 0.5,
    mutateHyphenRate: 0.5,
    mutateLengthRange: 1,
  },

  // For separation optimization (more distinct phonemes)
  separation: {
    addConsonant: 1,
    removeConsonant: 1,
    swapConsonant: 3, // Swapping helps find unique sounds
    addVowel: 1,
    removeVowel: 1,
    swapVowel: 3,
    addTemplate: 1,
    removeTemplate: 1,
    modifyTemplate: 2,
    addCluster: 2,
    removeCluster: 1,
    synthesizeCluster: 2,
    mutateApostropheRate: 0.5,
    mutateHyphenRate: 0.5,
    mutateLengthRange: 1,
  },

  // For pronounceability (simpler structures)
  pronounceability: {
    addConsonant: 0.5,
    removeConsonant: 2, // Fewer consonants often easier
    swapConsonant: 1,
    addVowel: 1.5,
    removeVowel: 0.5,
    swapVowel: 1,
    addTemplate: 0.5,
    removeTemplate: 2, // Simpler templates
    modifyTemplate: 1,
    addCluster: 0.5,
    removeCluster: 2, // Fewer clusters
    synthesizeCluster: 0.5,
    mutateApostropheRate: 1,
    mutateHyphenRate: 1,
    mutateLengthRange: 1,
  },
};

/**
 * Apply weighted random mutation based on goal
 */
export function applyWeightedMutation(
  domain: NamingDomain,
  goal: keyof typeof MUTATION_WEIGHTS,
  rng: RNG
): NamingDomain {
  const weights = MUTATION_WEIGHTS[goal];
  const mutationNames = Object.keys(weights) as MutationType[];

  const totalWeight = mutationNames.reduce((sum, name) => sum + weights[name], 0);
  let roll = rng() * totalWeight;

  for (const name of mutationNames) {
    roll -= weights[name];
    if (roll <= 0) {
      return MUTATIONS[name](domain, rng);
    }
  }

  // Fallback
  return applyRandomMutation(domain, rng);
}
