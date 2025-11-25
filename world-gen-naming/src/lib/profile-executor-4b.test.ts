import { describe, it, expect } from "vitest";
import {
  generateFromProfile,
  executeStrategy,
} from "./profile-executor.js";
import type {
  NamingProfile,
  TemplatedStrategy,
  LexemeList,
} from "../types/profile.js";

describe("Profile Executor - Phase 4B (Templated Strategy)", () => {
  // Test lexeme lists
  const testLexemes: LexemeList[] = [
    {
      id: "test_verbs",
      entries: ["Walks", "Runs", "Sleeps"],
    },
    {
      id: "test_preps",
      entries: ["in", "through", "under"],
    },
    {
      id: "test_objects",
      entries: ["Shadows", "Water", "Fire"],
    },
  ];

  describe("Templated Strategy with Lexeme Lists", () => {
    it("should generate names from template with lexeme slots", () => {
      const strategy: TemplatedStrategy = {
        id: "phrase_template",
        kind: "templated",
        weight: 1.0,
        template: "{{verb}}-{{prep}}-{{object}}",
        slots: {
          verb: { kind: "lexemeList", listId: "test_verbs" },
          prep: { kind: "lexemeList", listId: "test_preps" },
          object: { kind: "lexemeList", listId: "test_objects" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
        seed: "test-seed",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\w+-\w+-\w+$/); // Pattern: Word-Word-Word

      // Check that it's using actual lexemes
      const parts = result.split("-");
      expect(parts).toHaveLength(3);
    });

    it("should generate deterministic names with same seed", () => {
      const profile: NamingProfile = {
        id: "test:phrase",
        cultureId: "test",
        type: "person",
        strategies: [
          {
            id: "phrase",
            kind: "templated",
            weight: 1.0,
            template: "{{verb}}-{{object}}",
            slots: {
              verb: { kind: "lexemeList", listId: "test_verbs" },
              object: { kind: "lexemeList", listId: "test_objects" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: testLexemes,
        grammarRules: [],
        seed: "deterministic",
      };

      const name1 = generateFromProfile(profile, context);
      const name2 = generateFromProfile(profile, context);

      expect(name1).toBe(name2);
    });

    it("should support mixed templates with text and slots", () => {
      const strategy: TemplatedStrategy = {
        id: "title_template",
        kind: "templated",
        weight: 1.0,
        template: "The {{verb}} of {{object}}",
        slots: {
          verb: { kind: "lexemeList", listId: "test_verbs" },
          object: { kind: "lexemeList", listId: "test_objects" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
        seed: "test",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toMatch(/^The \w+ of \w+$/);
      expect(result).toContain("The ");
      expect(result).toContain(" of ");
    });

    it("should throw error for missing lexeme list", () => {
      const strategy: TemplatedStrategy = {
        id: "missing_list",
        kind: "templated",
        weight: 1.0,
        template: "{{verb}}",
        slots: {
          verb: { kind: "lexemeList", listId: "nonexistent_list" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [],
      };

      expect(() => executeStrategy(strategy, context)).toThrow(/Lexeme list not found/);
    });
  });

  describe("Argonian-style Phrase Names", () => {
    const argonianLexemes: LexemeList[] = [
      {
        id: "argo_verbs_3sg",
        entries: ["Walks", "Sleeps", "Hides", "Runs", "Swims"],
      },
      {
        id: "argo_preps",
        entries: ["in", "under", "through", "from", "along"],
      },
      {
        id: "argo_objects",
        entries: ["Shadows", "Mud", "Reeds", "Water", "Marshes"],
      },
    ];

    it("should generate Argonian-style hyphenated phrase names", () => {
      const profile: NamingProfile = {
        id: "argonian:person",
        cultureId: "argonian",
        type: "person",
        strategies: [
          {
            id: "phrase_name",
            kind: "templated",
            weight: 1.0,
            template: "{{verb}}-{{prep}}-{{object}}",
            slots: {
              verb: { kind: "lexemeList", listId: "argo_verbs_3sg" },
              prep: { kind: "lexemeList", listId: "argo_preps" },
              object: { kind: "lexemeList", listId: "argo_objects" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: argonianLexemes,
        grammarRules: [],
        seed: "argonian-test",
      };

      const names = Array.from({ length: 10 }, (_, i) =>
        generateFromProfile(profile, { ...context, seed: `argonian-${i}` })
      );

      // All should match pattern
      names.forEach((name) => {
        expect(name).toMatch(/^\w+-\w+-\w+$/);
      });

      // Should have some variety (with deterministic RNG, may have some duplicates)
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBeGreaterThan(2); // At least 3 unique names out of 10
    });

    it("should generate plausible Argonian names", () => {
      const profile: NamingProfile = {
        id: "argonian:person",
        cultureId: "argonian",
        type: "person",
        strategies: [
          {
            id: "phrase_name",
            kind: "templated",
            weight: 1.0,
            template: "{{verb}}-{{prep}}-{{object}}",
            slots: {
              verb: { kind: "lexemeList", listId: "argo_verbs_3sg" },
              prep: { kind: "lexemeList", listId: "argo_preps" },
              object: { kind: "lexemeList", listId: "argo_objects" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: argonianLexemes,
        grammarRules: [],
      };

      // Generate samples
      const samples = [
        generateFromProfile(profile, { ...context, seed: "sample1" }),
        generateFromProfile(profile, { ...context, seed: "sample2" }),
        generateFromProfile(profile, { ...context, seed: "sample3" }),
      ];

      console.log("Sample Argonian names:", samples);

      samples.forEach((name) => {
        // Check format
        const parts = name.split("-");
        expect(parts).toHaveLength(3);

        // Check that verb is from verb list
        expect(argonianLexemes[0].entries).toContain(parts[0]);

        // Check that prep is from prep list
        expect(argonianLexemes[1].entries).toContain(parts[1]);

        // Check that object is from object list
        expect(argonianLexemes[2].entries).toContain(parts[2]);
      });
    });
  });
});
