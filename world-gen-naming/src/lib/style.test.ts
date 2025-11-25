import { describe, it, expect } from "vitest";
import { createRNG } from "../utils/rng.js";
import {
  applyStyle,
  hasPreferredEnding,
  selectWithPreferredEndings,
  normalizeForComparison,
  areTooSimilar,
} from "./style.js";
import type { StyleRules } from "../types/domain.js";

describe("Style", () => {
  describe("applyStyle", () => {
    it("should apply title capitalization", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 0,
        hyphenRate: 0,
      };

      const result = applyStyle(rng, "testname", style);
      expect(result.result).toBe("Testname");
    });

    it("should apply allcaps capitalization", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "allcaps",
        apostropheRate: 0,
        hyphenRate: 0,
      };

      const result = applyStyle(rng, "testname", style);
      expect(result.result).toBe("TESTNAME");
    });

    it("should insert apostrophes at syllable boundaries", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 1.0, // Always insert
        hyphenRate: 0,
      };

      const syllables = ["test", "name"];
      const result = applyStyle(rng, "testname", style, syllables);

      expect(result.result).toContain("'");
      expect(result.transforms).toContain("apostrophe");
    });

    it("should insert hyphens at syllable boundaries", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 0,
        hyphenRate: 1.0, // Always insert
      };

      const syllables = ["test", "name"];
      const result = applyStyle(rng, "testname", style, syllables);

      expect(result.result).toContain("-");
      expect(result.transforms).toContain("hyphen");
    });

    it("should not insert markers without syllables", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 1.0,
        hyphenRate: 1.0,
      };

      // No syllables provided
      const result = applyStyle(rng, "test", style);

      expect(result.result).toBe("Test");
      expect(result.transforms).not.toContain("apostrophe");
      expect(result.transforms).not.toContain("hyphen");
    });
  });

  describe("hasPreferredEnding", () => {
    it("should detect preferred ending", () => {
      const result = hasPreferredEnding("Aelriel", ["iel", "ion"]);
      expect(result).toBe(true);
    });

    it("should be case-insensitive", () => {
      const result = hasPreferredEnding("TESTIEL", ["iel"]);
      expect(result).toBe(true);
    });

    it("should return false for non-matching", () => {
      const result = hasPreferredEnding("test", ["iel", "ion"]);
      expect(result).toBe(false);
    });

    it("should return false for no preferred endings", () => {
      const result = hasPreferredEnding("testiel", []);
      expect(result).toBe(false);
    });
  });

  describe("selectWithPreferredEndings", () => {
    it("should boost candidates with preferred endings", () => {
      const rng = createRNG("test");
      const candidates = ["normal", "testiel", "other"];
      const preferredEndings = ["iel"];

      let ielCount = 0;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const selected = selectWithPreferredEndings(
          createRNG(`test-${i}`),
          candidates,
          (c) => c,
          preferredEndings,
          5.0 // High boost
        );

        if (selected === "testiel") {
          ielCount++;
        }
      }

      // With high boost, should select "testiel" most often
      expect(ielCount).toBeGreaterThan(iterations * 0.5);
    });
  });

  describe("normalizeForComparison", () => {
    it("should remove apostrophes and hyphens", () => {
      const result = normalizeForComparison("Test-Name's");
      expect(result).toBe("testnames");
    });

    it("should lowercase", () => {
      const result = normalizeForComparison("TestName");
      expect(result).toBe("testname");
    });

    it("should remove spaces", () => {
      const result = normalizeForComparison("Test Name");
      expect(result).toBe("testname");
    });
  });

  describe("areTooSimilar", () => {
    it("should detect identical normalized names", () => {
      expect(areTooSimilar("Test", "test")).toBe(true);
      expect(areTooSimilar("Test-Name", "TestName")).toBe(true);
      expect(areTooSimilar("Test'Name", "TestName")).toBe(true);
    });

    it("should detect different names", () => {
      expect(areTooSimilar("Test", "Different")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty name", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 0,
        hyphenRate: 0,
      };

      const result = applyStyle(rng, "", style);
      expect(result.result).toBe("");
    });

    it("should handle single character name", () => {
      const rng = createRNG("test");
      const style: StyleRules = {
        capitalization: "title",
        apostropheRate: 0,
        hyphenRate: 0,
      };

      const result = applyStyle(rng, "x", style);
      expect(result.result).toBe("X");
    });
  });
});
