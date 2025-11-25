import { describe, it, expect } from "vitest";
import { createRNG } from "../utils/rng.js";
import {
  applyMorphology,
  applyMorphologyBest,
  canApplyMorphology,
  generateCompound,
  applyHonorific,
} from "./morphology.js";
import type { MorphologyProfile } from "../types/domain.js";

describe("Morphology", () => {
  const basicProfile: MorphologyProfile = {
    prefixes: ["Pre"],
    suffixes: ["suf"],
    structure: ["root", "root-suffix", "prefix-root"],
  };

  describe("applyMorphology", () => {
    it("should return root unchanged for 'root' structure", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        structure: ["root"],
      };

      const result = applyMorphology(rng, "test", profile);
      expect(result.result).toBe("test");
      expect(result.structure).toBe("root");
    });

    it("should apply suffix for 'root-suffix' structure", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        suffixes: ["ion"],
        structure: ["root-suffix"],
      };

      const result = applyMorphology(rng, "test", profile);
      expect(result.result).toBe("testion");
      expect(result.structure).toBe("root-suffix");
      expect(result.parts).toContain("suffix:ion");
    });

    it("should apply prefix for 'prefix-root' structure", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        prefixes: ["Un"],
        structure: ["prefix-root"],
      };

      const result = applyMorphology(rng, "test", profile);
      expect(result.result).toBe("Untest");
      expect(result.structure).toBe("prefix-root");
    });

    it("should apply both prefix and suffix", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        prefixes: ["Pre"],
        suffixes: ["ed"],
        structure: ["prefix-root-suffix"],
      };

      const result = applyMorphology(rng, "test", profile);
      expect(result.result).toBe("Pretested");
    });

    it("should use structure weights", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        prefixes: ["P"],
        structure: ["root", "prefix-root"],
        structureWeights: [100, 0], // Always pick root
      };

      for (let i = 0; i < 10; i++) {
        const result = applyMorphology(rng, "test", profile);
        expect(result.structure).toBe("root");
      }
    });

    it("should be deterministic with seed", () => {
      const profile = basicProfile;
      const rng1 = createRNG("same");
      const rng2 = createRNG("same");

      const result1 = applyMorphology(rng1, "test", profile);
      const result2 = applyMorphology(rng2, "test", profile);

      expect(result1.result).toBe(result2.result);
    });
  });

  describe("applyMorphologyBest", () => {
    it("should penalize overly long names", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        prefixes: ["VeryLongPrefix"],
        suffixes: ["VeryLongSuffix"],
        structure: ["prefix-root-suffix", "root"],
        structureWeights: [1, 1],
      };

      const result = applyMorphologyBest(rng, "short", profile, 3, 15);

      // Should prefer shorter option
      expect(result.result.length).toBeLessThan(40);
    });
  });

  describe("canApplyMorphology", () => {
    it("should return false for root-only structure", () => {
      const profile: MorphologyProfile = {
        structure: ["root"],
      };

      expect(canApplyMorphology(profile)).toBe(false);
    });

    it("should return false if no affixes available", () => {
      const profile: MorphologyProfile = {
        structure: ["prefix-root"],
        // No prefixes defined
      };

      expect(canApplyMorphology(profile)).toBe(false);
    });

    it("should return true if has complex structures and affixes", () => {
      const profile: MorphologyProfile = {
        prefixes: ["Pre"],
        structure: ["root", "prefix-root"],
      };

      expect(canApplyMorphology(profile)).toBe(true);
    });
  });

  describe("generateCompound", () => {
    it("should join two roots", () => {
      const rng = createRNG("test");
      const result = generateCompound(rng, "fire", "storm");

      expect(result).toBe("firestorm");
    });

    it("should use separator if provided", () => {
      const rng = createRNG("test");
      const result = generateCompound(rng, "fire", "storm", "-");

      expect(result).toBe("fire-storm");
    });
  });

  describe("applyHonorific", () => {
    it("should prepend honorific with space", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        honorifics: ["Sir"],
        structure: ["root"],
      };

      const result = applyHonorific(rng, "Test", profile);
      expect(result).toBe("Sir Test");
    });

    it("should return unchanged if no honorifics", () => {
      const rng = createRNG("test");
      const profile: MorphologyProfile = {
        structure: ["root"],
      };

      const result = applyHonorific(rng, "Test", profile);
      expect(result).toBe("Test");
    });
  });
});
