import { describe, it, expect } from "vitest";
import {
  resolveProfile,
  selectStrategy,
  generateFromProfile,
  executeStrategy,
} from "./profile-executor.js";
import type {
  NamingProfile,
  PhonotacticStrategy,
} from "../types/profile.js";
import type { NamingDomain } from "../types/domain.js";

describe("Profile Executor - Phase 4A", () => {
  // Simple test domain
  const testDomain: NamingDomain = {
    id: "test_domain",
    appliesTo: {
      kind: ["test"],
    },
    phonology: {
      consonants: ["t", "k", "r"],
      vowels: ["a", "i"],
      syllableTemplates: ["CV", "CVC"],
      lengthRange: [2, 3],
    },
    morphology: {
      structure: ["root"],
    },
    style: {
      capitalization: "title",
    },
  };

  // Simple test profile
  const testProfile: NamingProfile = {
    id: "test:person",
    cultureId: "test",
    type: "person",
    strategies: [
      {
        id: "phonotactic_core",
        kind: "phonotactic",
        weight: 1.0,
        domainId: "test_domain",
      } as PhonotacticStrategy,
    ],
  };

  describe("resolveProfile", () => {
    it("should resolve profile by exact cultureId + type match", () => {
      const profiles = [testProfile];
      const result = resolveProfile("test", "person", profiles);
      expect(result).toBe(testProfile);
    });

    it("should return null for non-matching profile", () => {
      const profiles = [testProfile];
      const result = resolveProfile("other", "person", profiles);
      expect(result).toBeNull();
    });

    it("should fallback to type-only match", () => {
      const genericProfile: NamingProfile = {
        id: "generic:person",
        cultureId: "",
        type: "person",
        strategies: [],
      };
      const profiles = [testProfile, genericProfile];
      const result = resolveProfile("nonexistent", "person", profiles);
      expect(result).toBe(genericProfile);
    });
  });

  describe("selectStrategy", () => {
    it("should select single strategy", () => {
      const result = selectStrategy(testProfile);
      expect(result).toBe(testProfile.strategies[0]);
    });

    it("should select strategy by weight", () => {
      const multiStrategyProfile: NamingProfile = {
        ...testProfile,
        strategies: [
          {
            id: "strat1",
            kind: "phonotactic",
            weight: 0.5,
            domainId: "test_domain",
          } as PhonotacticStrategy,
          {
            id: "strat2",
            kind: "phonotactic",
            weight: 0.5,
            domainId: "test_domain",
          } as PhonotacticStrategy,
        ],
      };

      const result = selectStrategy(multiStrategyProfile, "test-seed");
      expect(result).toBeDefined();
      expect(["strat1", "strat2"]).toContain(result?.id);
    });

    it("should handle zero weights", () => {
      const zeroWeightProfile: NamingProfile = {
        ...testProfile,
        strategies: [
          {
            id: "strat1",
            kind: "phonotactic",
            weight: 0,
            domainId: "test_domain",
          } as PhonotacticStrategy,
        ],
      };

      const result = selectStrategy(zeroWeightProfile);
      expect(result).toBe(zeroWeightProfile.strategies[0]);
    });

    it("should return null for empty strategies", () => {
      const emptyProfile: NamingProfile = {
        ...testProfile,
        strategies: [],
      };

      const result = selectStrategy(emptyProfile);
      expect(result).toBeNull();
    });
  });

  describe("generateFromProfile", () => {
    it("should generate name from phonotactic strategy", () => {
      const context = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "test-seed",
      };

      const result = generateFromProfile(testProfile, context);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should throw error for missing domain", () => {
      const context = {
        domains: [], // Empty domains
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "test-seed",
      };

      expect(() => generateFromProfile(testProfile, context)).toThrow(
        /Domain not found/
      );
    });

    it("should throw error for profile with no strategies", () => {
      const emptyProfile: NamingProfile = {
        ...testProfile,
        strategies: [],
      };

      const context = {
        domains: [testDomain],
        profiles: [emptyProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "test-seed",
      };

      expect(() => generateFromProfile(emptyProfile, context)).toThrow(
        /No strategies available/
      );
    });

    it("should generate deterministic names with same seed", () => {
      const context = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "deterministic-seed",
      };

      const name1 = generateFromProfile(testProfile, context);
      const name2 = generateFromProfile(testProfile, context);
      expect(name1).toBe(name2);
    });

    it("should generate different names with different seeds", () => {
      const context1 = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "seed1",
      };

      const context2 = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "seed2",
      };

      const name1 = generateFromProfile(testProfile, context1);
      const name2 = generateFromProfile(testProfile, context2);

      // Different seeds should produce different names (with high probability)
      // We'll generate multiple to be sure
      const names1 = Array.from({ length: 5 }, (_, i) =>
        generateFromProfile(testProfile, { ...context1, seed: `seed1-${i}` })
      );
      const names2 = Array.from({ length: 5 }, (_, i) =>
        generateFromProfile(testProfile, { ...context2, seed: `seed2-${i}` })
      );

      expect(names1).not.toEqual(names2);
    });
  });

  describe("executeStrategy", () => {
    it("should execute phonotactic strategy", () => {
      const strategy: PhonotacticStrategy = {
        id: "test_strat",
        kind: "phonotactic",
        weight: 1.0,
        domainId: "test_domain",
      };

      const context = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
        seed: "test-seed",
      };

      const result = executeStrategy(strategy, context);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should throw error for unknown strategy kind", () => {
      const unknownStrategy = {
        id: "unknown",
        kind: "invalid_kind",
        weight: 1.0,
      } as any; // Cast entire object to bypass type checking for this error test

      const context = {
        domains: [testDomain],
        profiles: [testProfile],
        lexemeLists: [],
        grammarRules: [],
      };

      expect(() => executeStrategy(unknownStrategy, context)).toThrow(
        /Unknown strategy kind/
      );
    });
  });
});
