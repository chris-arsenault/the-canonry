import { describe, it, expect } from "vitest";
import {
  generateFromProfile,
  executeStrategy,
} from "./profile-executor.js";
import type {
  NamingProfile,
  TemplatedStrategy,
  LexemeList,
  GrammarRule,
} from "../types/profile.js";

describe("Profile Executor - Phase 4C (Grammar Support)", () => {
  // Test lexeme lists for grammar
  const testLexemes: LexemeList[] = [
    {
      id: "adjectives",
      entries: ["Arcane", "Blazing", "Frozen"],
    },
    {
      id: "nouns",
      entries: ["Bolt", "Shield", "Wave"],
    },
    {
      id: "forces",
      entries: ["Storm", "Frost", "Flame"],
    },
    {
      id: "weapons",
      entries: ["Bane", "Breaker", "Eater"],
    },
  ];

  // Test grammar rules
  const testGrammars: GrammarRule[] = [
    {
      id: "spell_grammar",
      description: "Spell name: ADJ NOUN",
      pattern: "ADJ NOUN",
      symbolSources: {
        ADJ: { kind: "lexemeList", listId: "adjectives" },
        NOUN: { kind: "lexemeList", listId: "nouns" },
      },
    },
    {
      id: "kenning_grammar",
      description: "Kenning: FORCE-WEAPON",
      pattern: "FORCE-WEAPON",
      symbolSources: {
        FORCE: { kind: "lexemeList", listId: "forces" },
        WEAPON: { kind: "lexemeList", listId: "weapons" },
      },
    },
  ];

  describe("Grammar-based Generation", () => {
    it("should expand grammar with space-separated pattern", () => {
      const strategy: TemplatedStrategy = {
        id: "grammar_test",
        kind: "templated",
        weight: 1.0,
        template: "{{spell}}",
        slots: {
          spell: { kind: "grammar", grammarId: "spell_grammar" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: testGrammars,
        seed: "test",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\w+ \w+$/); // Pattern: Word Word

      // Verify it's using the right lexemes
      const parts = result.split(" ");
      expect(testLexemes[0].entries).toContain(parts[0]); // adjective
      expect(testLexemes[1].entries).toContain(parts[1]); // noun
    });

    it("should expand grammar with hyphen-separated pattern", () => {
      const strategy: TemplatedStrategy = {
        id: "kenning_test",
        kind: "templated",
        weight: 1.0,
        template: "{{kenning}}",
        slots: {
          kenning: { kind: "grammar", grammarId: "kenning_grammar" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: testGrammars,
        seed: "test",
      };

      const result = executeStrategy(strategy, context);

      expect(result).toMatch(/^\w+-\w+$/); // Pattern: Word-Word

      const parts = result.split("-");
      expect(testLexemes[2].entries).toContain(parts[0]); // force
      expect(testLexemes[3].entries).toContain(parts[1]); // weapon
    });

    it("should generate deterministic grammar-based names", () => {
      const profile: NamingProfile = {
        id: "test:spell",
        cultureId: "test",
        type: "spell",
        strategies: [
          {
            id: "spell_strat",
            kind: "templated",
            weight: 1.0,
            template: "{{name}}",
            slots: {
              name: { kind: "grammar", grammarId: "spell_grammar" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: testLexemes,
        grammarRules: testGrammars,
        seed: "deterministic",
      };

      const name1 = generateFromProfile(profile, context);
      const name2 = generateFromProfile(profile, context);

      expect(name1).toBe(name2);
    });

    it("should throw error for missing grammar rule", () => {
      const strategy: TemplatedStrategy = {
        id: "missing_grammar",
        kind: "templated",
        weight: 1.0,
        template: "{{name}}",
        slots: {
          name: { kind: "grammar", grammarId: "nonexistent_grammar" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: testGrammars,
      };

      expect(() => executeStrategy(strategy, context)).toThrow(/Grammar rule not found/);
    });

    it("should throw error for undefined grammar symbol", () => {
      const badGrammar: GrammarRule = {
        id: "bad_grammar",
        pattern: "X Y",
        symbolSources: {
          X: { kind: "lexemeList", listId: "adjectives" },
          // Y is not defined!
        },
      };

      const strategy: TemplatedStrategy = {
        id: "bad_test",
        kind: "templated",
        weight: 1.0,
        template: "{{name}}",
        slots: {
          name: { kind: "grammar", grammarId: "bad_grammar" },
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: testLexemes,
        grammarRules: [badGrammar],
      };

      expect(() => executeStrategy(strategy, context)).toThrow(/Symbol.*not defined/);
    });
  });

  describe("Fantasy Name Examples", () => {
    const fantasyLexemes: LexemeList[] = [
      {
        id: "spell_adj",
        entries: ["Arcane", "Blazing", "Frozen", "Shadow", "Radiant"],
      },
      {
        id: "spell_noun",
        entries: ["Bolt", "Lance", "Shield", "Barrier", "Wave"],
      },
      {
        id: "natural_forces",
        entries: ["Storm", "Frost", "Flame", "Stone", "Thunder"],
      },
      {
        id: "predatory",
        entries: ["Bane", "Breaker", "Eater", "Render", "Splitter"],
      },
    ];

    const fantasyGrammars: GrammarRule[] = [
      {
        id: "spell_name",
        pattern: "ADJ NOUN",
        symbolSources: {
          ADJ: { kind: "lexemeList", listId: "spell_adj" },
          NOUN: { kind: "lexemeList", listId: "spell_noun" },
        },
      },
      {
        id: "kenning",
        pattern: "N1-N2",
        symbolSources: {
          N1: { kind: "lexemeList", listId: "natural_forces" },
          N2: { kind: "lexemeList", listId: "predatory" },
        },
      },
    ];

    it("should generate spell names", () => {
      const profile: NamingProfile = {
        id: "fantasy:spell",
        cultureId: "fantasy",
        type: "spell",
        strategies: [
          {
            id: "spell_strategy",
            kind: "templated",
            weight: 1.0,
            template: "{{spell}}",
            slots: {
              spell: { kind: "grammar", grammarId: "spell_name" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: fantasyLexemes,
        grammarRules: fantasyGrammars,
      };

      const spells = [
        generateFromProfile(profile, { ...context, seed: "spell1" }),
        generateFromProfile(profile, { ...context, seed: "spell2" }),
        generateFromProfile(profile, { ...context, seed: "spell3" }),
      ];

      console.log("Sample spell names:", spells);

      spells.forEach((spell) => {
        expect(spell).toMatch(/^\w+ \w+$/);
        const [adj, noun] = spell.split(" ");
        expect(fantasyLexemes[0].entries).toContain(adj);
        expect(fantasyLexemes[1].entries).toContain(noun);
      });
    });

    it("should generate kennings (Norse-style weapon names)", () => {
      const profile: NamingProfile = {
        id: "norse:weapon",
        cultureId: "norse",
        type: "weapon",
        strategies: [
          {
            id: "kenning_strategy",
            kind: "templated",
            weight: 1.0,
            template: "{{kenning}}",
            slots: {
              kenning: { kind: "grammar", grammarId: "kenning" },
            },
          } as TemplatedStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: fantasyLexemes,
        grammarRules: fantasyGrammars,
      };

      const weapons = [
        generateFromProfile(profile, { ...context, seed: "weapon1" }),
        generateFromProfile(profile, { ...context, seed: "weapon2" }),
        generateFromProfile(profile, { ...context, seed: "weapon3" }),
      ];

      console.log("Sample kennings:", weapons);

      weapons.forEach((weapon) => {
        expect(weapon).toMatch(/^\w+-\w+$/);
        const [force, pred] = weapon.split("-");
        expect(fantasyLexemes[2].entries).toContain(force);
        expect(fantasyLexemes[3].entries).toContain(pred);
      });
    });
  });
});
