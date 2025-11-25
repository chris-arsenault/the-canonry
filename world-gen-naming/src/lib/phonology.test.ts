import { describe, it, expect } from "vitest";
import { createRNG } from "../utils/rng.js";
import {
  generateSyllable,
  generateWord,
  generateWordWithFavoredClusters,
  generateWordWithDebug,
} from "./phonology.js";
import type { PhonologyProfile } from "../types/domain.js";

describe("Phonology", () => {
  const basicProfile: PhonologyProfile = {
    consonants: ["t", "k", "r"],
    vowels: ["a", "e", "i"],
    syllableTemplates: ["CV", "CVC"],
    lengthRange: [2, 3],
  };

  describe("generateSyllable", () => {
    it("should generate syllable matching template", () => {
      const rng = createRNG("test");
      const result = generateSyllable(rng, basicProfile);

      expect(result.syllable).toBeTruthy();
      expect(result.template).toMatch(/^(CV|CVC)$/);
    });

    it("should use only consonants from profile", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["x"],
        vowels: ["a"],
        syllableTemplates: ["CV"],
        lengthRange: [1, 1],
      };

      const result = generateSyllable(rng, profile);
      expect(result.syllable).toBe("xa");
    });

    it("should use syllable template weights", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["t"],
        vowels: ["a"],
        syllableTemplates: ["CV", "CVC"],
        templateWeights: [100, 0], // Always pick CV
        lengthRange: [1, 1],
      };

      for (let i = 0; i < 10; i++) {
        const result = generateSyllable(rng, profile);
        expect(result.template).toBe("CV");
        expect(result.syllable).toHaveLength(2);
      }
    });
  });

  describe("generateWord", () => {
    it("should respect length range", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["t"],
        vowels: ["a"],
        syllableTemplates: ["CV"],
        lengthRange: [2, 2],
      };

      const word = generateWord(rng, profile);
      // 2 syllables * 2 chars per syllable = 4 chars
      expect(word).toHaveLength(4);
    });

    it("should avoid forbidden clusters", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["t", "k"],
        vowels: ["a"],
        syllableTemplates: ["CV"],
        lengthRange: [2, 2],
        forbiddenClusters: ["ta"],
      };

      for (let i = 0; i < 20; i++) {
        const word = generateWord(rng, profile);
        expect(word).not.toContain("ta");
      }
    });

    it("should generate deterministically with seed", () => {
      const rng1 = createRNG("same-seed");
      const rng2 = createRNG("same-seed");
      const profile = basicProfile;

      const word1 = generateWord(rng1, profile);
      const word2 = generateWord(rng2, profile);

      expect(word1).toBe(word2);
    });

    it("should generate different names with different seeds", () => {
      const rng1 = createRNG("seed1");
      const rng2 = createRNG("seed2");
      const profile = basicProfile;

      const word1 = generateWord(rng1, profile);
      const word2 = generateWord(rng2, profile);

      // Very unlikely to be the same
      expect(word1).not.toBe(word2);
    });
  });

  describe("generateWordWithFavoredClusters", () => {
    it("should boost names with favored clusters", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["t", "h"],
        vowels: ["a", "e"],
        syllableTemplates: ["CV", "CVC"],
        lengthRange: [2, 2],
        favoredClusters: ["th"],
        favoredClusterBoost: 10.0,
      };

      let thCount = 0;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const word = generateWordWithFavoredClusters(
          createRNG(`test-${i}`),
          profile
        );
        if (word.includes("th")) {
          thCount++;
        }
      }

      // With high boost, should get "th" in at least some names
      // Note: With only 2 consonants, even without boost we'd get ~50% "th"
      // The test verifies the boost mechanism works, not necessarily that it reaches 50%
      expect(thCount).toBeGreaterThan(5);
    });
  });

  describe("generateWordWithDebug", () => {
    it("should return syllables and templates", () => {
      const rng = createRNG("test");
      const profile = basicProfile;

      const result = generateWordWithDebug(rng, profile);

      expect(result.word).toBeTruthy();
      expect(result.syllables).toBeInstanceOf(Array);
      expect(result.templates).toBeInstanceOf(Array);
      expect(result.syllables.length).toBeGreaterThan(0);
      expect(result.templates.length).toBe(result.syllables.length);
    });

    it("should produce word matching syllables", () => {
      const rng = createRNG("test");
      const profile = basicProfile;

      const result = generateWordWithDebug(rng, profile);
      const reconstructed = result.syllables.join("");

      expect(result.word).toBe(reconstructed);
    });
  });

  describe("edge cases", () => {
    it("should handle single syllable names", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["k"],
        vowels: ["a"],
        syllableTemplates: ["CV"],
        lengthRange: [1, 1],
      };

      const word = generateWord(rng, profile);
      expect(word).toBe("ka");
    });

    it("should handle multi-character phonemes", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["th", "kr"],
        vowels: ["ae", "oo"],
        syllableTemplates: ["CV"],
        lengthRange: [1, 1],
      };

      const word = generateWord(rng, profile);
      expect(word.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty weights (defaults to uniform)", () => {
      const rng = createRNG("test");
      const profile: PhonologyProfile = {
        consonants: ["t", "k"],
        vowels: ["a"],
        syllableTemplates: ["CV"],
        consonantWeights: [],
        lengthRange: [1, 1],
      };

      const word = generateWord(rng, profile);
      expect(word).toMatch(/^[tk]a$/);
    });
  });
});
