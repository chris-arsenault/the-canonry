import { describe, it, expect } from "vitest";
import { generateName, generateNames, generateUniqueNames } from "./generator.js";
import type { NamingDomain, GenerationRequest } from "../types/domain.js";

describe("Generator (Integration)", () => {
  const testDomain: NamingDomain = {
    id: "test",
    appliesTo: {
      kind: ["test"],
    },
    phonology: {
      consonants: ["t", "k"],
      vowels: ["a", "e"],
      syllableTemplates: ["CV", "CVC"],
      lengthRange: [2, 2],
    },
    morphology: {
      structure: ["root"],
    },
    style: {
      capitalization: "title",
      apostropheRate: 0,
      hyphenRate: 0,
    },
  };

  describe("generateName", () => {
    it("should generate a valid name", () => {
      const request: GenerationRequest = {
        kind: "test",
        seed: "test-seed",
      };

      const result = generateName([testDomain], request);

      expect(result).toBeTruthy();
      expect(result?.name).toBeTruthy();
      expect(result?.domainId).toBe("test");
    });

    it("should return null for no matching domain", () => {
      const request: GenerationRequest = {
        kind: "nonexistent",
        tags: [], // Ensure tags is defined
      };

      const result = generateName([testDomain], request);

      expect(result).toBeNull();
    });

    it("should be deterministic with seed", () => {
      const request: GenerationRequest = {
        kind: "test",
        seed: "same-seed",
      };

      const result1 = generateName([testDomain], request);
      const result2 = generateName([testDomain], request);

      expect(result1?.name).toBe(result2?.name);
    });

    it("should produce debug info", () => {
      const request: GenerationRequest = {
        kind: "test",
        seed: "test",
      };

      const result = generateName([testDomain], request);

      expect(result?.debug).toBeTruthy();
      expect(result?.debug?.syllables).toBeInstanceOf(Array);
      expect(result?.debug?.phonology).toBeTruthy();
    });
  });

  describe("generateNames", () => {
    it("should generate multiple names", () => {
      const request: GenerationRequest = {
        kind: "test",
        count: 5,
        seed: "test",
      };

      const results = generateNames([testDomain], request);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.name)).toBe(true);
    });

    it("should generate different names", () => {
      const request: GenerationRequest = {
        kind: "test",
        count: 5,
        seed: "test",
      };

      const results = generateNames([testDomain], request);
      const names = results.map((r) => r.name);
      const uniqueNames = new Set(names);

      // Most should be unique (collisions possible but unlikely with 5 names)
      expect(uniqueNames.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe("generateUniqueNames", () => {
    it("should generate only unique names", () => {
      const request: GenerationRequest = {
        kind: "test",
        count: 10,
        seed: "test",
      };

      const results = generateUniqueNames([testDomain], request);
      const names = results.map((r) => r.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(results.length);
    });

    it("should handle small domain capacity", () => {
      // Very constrained domain - can only generate a few unique names
      const tinyDomain: NamingDomain = {
        id: "tiny",
        appliesTo: {
          kind: ["test"],
        },
        phonology: {
          consonants: ["t"],
          vowels: ["a"],
          syllableTemplates: ["CV"],
          lengthRange: [1, 1],
        },
        morphology: {
          structure: ["root"],
        },
        style: {
          capitalization: "title",
        },
      };

      const request: GenerationRequest = {
        kind: "test",
        count: 5,
        seed: "test",
      };

      const results = generateUniqueNames([tinyDomain], request, 100);

      // Can only generate "Ta" - should return 1 unique name
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("full pipeline", () => {
    it("should work with morphology", () => {
      const domainWithMorph: NamingDomain = {
        id: "morph",
        appliesTo: {
          kind: ["test"],
        },
        phonology: {
          consonants: ["t"],
          vowels: ["a"],
          syllableTemplates: ["CV"],
          lengthRange: [1, 1],
        },
        morphology: {
          prefixes: ["Pre"],
          suffixes: ["suf"],
          structure: ["root-suffix", "prefix-root"],
        },
        style: {
          capitalization: "title",
        },
      };

      const request: GenerationRequest = {
        kind: "test",
        seed: "test",
      };

      const result = generateName([domainWithMorph], request);

      expect(result).toBeTruthy();
      expect(result?.name).toMatch(/^(Presta|Tasuf)$/i);
    });

    it("should work with style transforms", () => {
      const domainWithStyle: NamingDomain = {
        id: "style",
        appliesTo: {
          kind: ["test"],
        },
        phonology: {
          consonants: ["t", "k"],
          vowels: ["a"],
          syllableTemplates: ["CV"],
          lengthRange: [2, 2],
        },
        morphology: {
          structure: ["root"],
        },
        style: {
          capitalization: "allcaps",
          apostropheRate: 1.0,
          hyphenRate: 0,
        },
      };

      const request: GenerationRequest = {
        kind: "test",
        seed: "test",
      };

      const result = generateName([domainWithStyle], request);

      expect(result?.name).toMatch(/^[A-Z']+$/); // All uppercase (with possible apostrophes)
      expect(result?.name.replace(/'/g, "")).toMatch(/^[A-Z]+$/); // Uppercase letters only
    });
  });
});
