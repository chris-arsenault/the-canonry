import { describe, it, expect } from "vitest";
import { applyQualityFilter, defaultFilters } from "./quality-filter.js";
import type { QualityFilter } from "../types/builder-spec.js";

describe("Quality Filter", () => {
  describe("Basic Filters", () => {
    it("should pass all entries when no filter provided", () => {
      const entries = ["Apple", "Banana", "Cherry"];
      const result = applyQualityFilter(entries);

      expect(result.passed).toEqual(entries);
      expect(result.rejected).toEqual([]);
    });

    it("should filter by minimum length", () => {
      const entries = ["A", "AB", "ABC", "ABCD"];
      const filter: QualityFilter = { minLength: 3 };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["ABC", "ABCD"]);
      expect(result.rejected).toEqual(["A", "AB"]);
    });

    it("should filter by maximum length", () => {
      const entries = ["A", "AB", "ABC", "ABCD"];
      const filter: QualityFilter = { maxLength: 2 };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["A", "AB"]);
      expect(result.rejected).toEqual(["ABC", "ABCD"]);
    });

    it("should filter by length range", () => {
      const entries = ["A", "AB", "ABC", "ABCD", "ABCDE"];
      const filter: QualityFilter = { minLength: 2, maxLength: 4 };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["AB", "ABC", "ABCD"]);
      expect(result.rejected).toEqual(["A", "ABCDE"]);
    });
  });

  describe("Forbidden Substrings", () => {
    it("should reject entries with forbidden substrings", () => {
      const entries = ["Apple", "Banana", "http://example", "Cherry"];
      const filter: QualityFilter = {
        forbiddenSubstrings: ["http", "www"],
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Banana", "Cherry"]);
      expect(result.rejected).toEqual(["http://example"]);
    });

    it("should be case-insensitive", () => {
      const entries = ["Apple", "BANANA", "Cherry"];
      const filter: QualityFilter = {
        forbiddenSubstrings: ["banana"],
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["BANANA"]);
    });
  });

  describe("Banned Words", () => {
    it("should reject exact matches", () => {
      const entries = ["Apple", "Banana", "Cherry"];
      const filter: QualityFilter = {
        bannedWords: ["Banana"],
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["Banana"]);
    });

    it("should be case-insensitive", () => {
      const entries = ["Apple", "BANANA", "banana", "Cherry"];
      const filter: QualityFilter = {
        bannedWords: ["banana"],
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["BANANA", "banana"]);
    });

    it("should not reject partial matches", () => {
      const entries = ["Bananas", "Banana", "Ban"];
      const filter: QualityFilter = {
        bannedWords: ["Banana"],
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Bananas", "Ban"]);
      expect(result.rejected).toEqual(["Banana"]);
    });
  });

  describe("Pattern Matching", () => {
    it("should filter by regex pattern", () => {
      const entries = ["Apple", "Banana123", "Cherry", "Date456"];
      const filter: QualityFilter = {
        allowedPattern: "^[A-Za-z]+$", // Only letters
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["Banana123", "Date456"]);
    });

    it("should enforce capitalization pattern", () => {
      const entries = ["Apple", "banana", "Cherry", "date"];
      const filter: QualityFilter = {
        allowedPattern: "^[A-Z][a-z]+$",
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["banana", "date"]);
    });
  });

  describe("Capitalization Requirement", () => {
    it("should require capitalization", () => {
      const entries = ["Apple", "banana", "Cherry", "date"];
      const filter: QualityFilter = {
        requireCapitalized: true,
      };
      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Cherry"]);
      expect(result.rejected).toEqual(["banana", "date"]);
    });
  });

  describe("Combined Filters", () => {
    it("should apply multiple filters", () => {
      const entries = [
        "A", // too short
        "Apple", // pass
        "banana", // not capitalized
        "Cherry123", // contains numbers
        "Date", // pass
        "verylongwordthatexceedslimit", // too long
      ];

      const filter: QualityFilter = {
        minLength: 3,
        maxLength: 10,
        requireCapitalized: true,
        allowedPattern: "^[A-Za-z]+$",
      };

      const result = applyQualityFilter(entries, filter);

      expect(result.passed).toEqual(["Apple", "Date"]);
      expect(result.rejected.length).toBe(4);
    });

    it("should provide rejection reasons", () => {
      const entries = ["A", "banana", "Cherry123"];
      const filter: QualityFilter = {
        minLength: 3,
        requireCapitalized: true,
        allowedPattern: "^[A-Za-z]+$",
      };

      const result = applyQualityFilter(entries, filter);

      expect(result.reasons["A"]).toContain("Too short");
      expect(result.reasons["banana"]).toContain("Not capitalized");
      expect(result.reasons["Cherry123"]).toContain("Does not match allowed pattern");
    });
  });

  describe("Default Filters", () => {
    it("should have singleWord filter", () => {
      const entries = ["Apple", "A", "verylongwordthatislongerthantwentycharacters", "Good-Word", "Bad@Word"];

      const result = applyQualityFilter(entries, defaultFilters.singleWord);

      expect(result.passed).toContain("Apple");
      expect(result.passed).toContain("Good-Word");
      expect(result.rejected).toContain("A"); // too short
      expect(result.rejected).toContain("verylongwordthatislongerthantwentycharacters"); // too long
      expect(result.rejected).toContain("Bad@Word"); // invalid character
    });

    it("should have phrase filter", () => {
      const entries = ["Single", "Two Words", "Three Word Phrase", "AB"];

      const result = applyQualityFilter(entries, defaultFilters.phrase);

      expect(result.passed).toContain("Single");
      expect(result.passed).toContain("Two Words");
      expect(result.passed).toContain("Three Word Phrase");
      expect(result.rejected).toContain("AB"); // too short
    });

    it("should have properNoun filter", () => {
      const entries = ["Apple", "banana", "Cherry-Tree", "123Bad"];

      const result = applyQualityFilter(entries, defaultFilters.properNoun);

      expect(result.passed).toContain("Apple");
      expect(result.passed).toContain("Cherry-Tree");
      expect(result.rejected).toContain("banana"); // not capitalized
      expect(result.rejected).toContain("123Bad"); // doesn't match pattern
    });
  });
});
