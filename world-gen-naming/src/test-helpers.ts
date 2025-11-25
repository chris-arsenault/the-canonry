/**
 * Test helpers for creating properly-typed test data
 */

import type { NamingDomain, PhonologyProfile, StyleRules } from "./types/domain.js";

/**
 * Create a minimal phonology profile with all required defaults
 */
export function createTestPhonology(
  overrides: Partial<PhonologyProfile>
): PhonologyProfile {
  return {
    consonants: ["t", "k"],
    vowels: ["a", "e"],
    syllableTemplates: ["CV"],
    lengthRange: [1, 2],
    favoredClusterBoost: 2.0,
    ...overrides,
  };
}

/**
 * Create a minimal style rules object with all required defaults
 */
export function createTestStyle(overrides: Partial<StyleRules> = {}): StyleRules {
  return {
    apostropheRate: 0,
    hyphenRate: 0,
    capitalization: "title",
    preferredEndingBoost: 2.0,
    rhythmBias: "neutral",
    ...overrides,
  };
}

/**
 * Create a minimal test domain with all required defaults
 */
export function createTestDomain(overrides: Partial<NamingDomain> = {}): NamingDomain {
  return {
    id: "test",
    appliesTo: {
      kind: ["test"],
    },
    phonology: createTestPhonology({}),
    morphology: {
      structure: ["root"],
    },
    style: createTestStyle(),
    ...overrides,
  };
}
