import { describe, it, expect } from "vitest";
import { generateFromProfile, executeStrategy } from "./profile-executor.js";
import type {
  NamingProfile,
  CompoundStrategy,
  LexemeList,
} from "../types/profile.js";
import type { NamingDomain } from "../types/domain.js";

describe("Profile Executor - Phase 4D (Compound Strategy & Integration)", () => {
  const testDomain: NamingDomain = {
    id: "test_phonotactic",
    appliesTo: { kind: ["test"] },
    phonology: {
      consonants: ["k", "r", "t"],
      vowels: ["a", "i"],
      syllableTemplates: ["CV"],
      lengthRange: [2, 2],
    },
    morphology: {
      structure: ["root"],
    },
    style: {
      capitalization: "title",
    },
  };

  const testLexemes: LexemeList[] = [
    {
      id: "prefixes",
      entries: ["High", "Grand", "Lord"],
    },
    {
      id: "titles",
      entries: ["Master", "Elder", "Guardian"],
    },
  ];

  describe("Compound Strategy", () => {
    it("should combine multiple parts with separator", () => {
      const strategy: CompoundStrategy = {
        id: "compound_test",
        kind: "compound",
        weight: 1.0,
        parts: [
          { kind: "lexemeList", listId: "prefixes" },
          { kind: "lexemeList", listId: "titles" },
        ],
        separator: " ",
      };

      const context = {
        domains: [testDomain],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
        seed: "test",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(result).toMatch(/^\w+ \w+$/);

      const [prefix, title] = result.split(" ");
      expect(testLexemes[0].entries).toContain(prefix);
      expect(testLexemes[1].entries).toContain(title);
    });

    it("should support phonotactic parts in compound", () => {
      const strategy: CompoundStrategy = {
        id: "mixed_compound",
        kind: "compound",
        weight: 1.0,
        parts: [
          { kind: "lexemeList", listId: "prefixes" },
          { kind: "phonotactic", domainId: "test_phonotactic" },
        ],
        separator: " ",
      };

      const context = {
        domains: [testDomain],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
        seed: "test",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(result).toMatch(/^\w+ \w+$/);

      const [prefix, name] = result.split(" ");
      expect(testLexemes[0].entries).toContain(prefix);
      // Phonotactic part should be a generated name
      expect(name.length).toBeGreaterThan(0);
    });

    it("should support no separator (concatenation)", () => {
      const strategy: CompoundStrategy = {
        id: "concat_compound",
        kind: "compound",
        weight: 1.0,
        parts: [
          { kind: "lexemeList", listId: "prefixes" },
          { kind: "lexemeList", listId: "titles" },
        ],
        separator: "",
      };

      const context = {
        domains: [testDomain],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(result).not.toContain(" ");
      // Should be concatenated without space
      expect(result.length).toBeGreaterThan(3);
    });
  });

  describe("Integration: Multiple Strategy Types", () => {
    it("should support profiles with mixed strategy types", () => {
      const profile: NamingProfile = {
        id: "mixed:person",
        cultureId: "mixed",
        type: "person",
        strategies: [
          {
            id: "simple_phonotactic",
            kind: "phonotactic",
            weight: 0.33,
            domainId: "test_phonotactic",
          },
          {
            id: "titled",
            kind: "compound",
            weight: 0.33,
            parts: [
              { kind: "lexemeList", listId: "prefixes" },
              { kind: "phonotactic", domainId: "test_phonotactic" },
            ],
            separator: " ",
          },
          {
            id: "templated_title",
            kind: "templated",
            weight: 0.34,
            template: "{{title}} {{name}}",
            slots: {
              title: { kind: "lexemeList", listId: "titles" },
              name: { kind: "phonotactic", domainId: "test_phonotactic" },
            },
          },
        ],
      };

      const context = {
        domains: [testDomain],
        profiles: [profile],
        lexemeLists: testLexemes,
        grammarRules: [],
      };

      // Generate multiple names to test all strategies
      const names = Array.from({ length: 20 }, (_, i) =>
        generateFromProfile(profile, { ...context, seed: `test-${i}` })
      );

      expect(names.length).toBe(20);
      names.forEach((name) => {
        expect(name.length).toBeGreaterThan(0);
      });

      console.log("Mixed strategy samples:", names.slice(0, 5));
    });
  });
});
