import { describe, it, expect } from "vitest";
import {
  validateLexemeSlotSpec,
  validateTemplateSpec,
  validateBatchSpec,
  createDefaultLexemeSpec,
  createDefaultTemplateSpec,
} from "./spec-loader.js";
import type { LexemeSlotSpec, TemplateSpec, BatchSpec } from "../types/builder-spec.js";

describe("Spec Loader - Validation", () => {
  describe("Lexeme Slot Spec", () => {
    it("should validate valid lexeme spec", () => {
      const spec: LexemeSlotSpec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "noun",
        style: "fantasy, neutral",
        targetCount: 30,
        sourceMode: "llm",
      };

      expect(() => validateLexemeSlotSpec(spec)).not.toThrow();
    });

    it("should reject invalid POS tag", () => {
      const spec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "invalid_pos",
        style: "fantasy",
        targetCount: 30,
        sourceMode: "llm",
      };

      expect(() => validateLexemeSlotSpec(spec)).toThrow();
    });

    it("should reject invalid source mode", () => {
      const spec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "noun",
        style: "fantasy",
        targetCount: 30,
        sourceMode: "invalid",
      };

      expect(() => validateLexemeSlotSpec(spec)).toThrow();
    });

    it("should reject negative target count", () => {
      const spec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "noun",
        style: "fantasy",
        targetCount: -1,
        sourceMode: "llm",
      };

      expect(() => validateLexemeSlotSpec(spec)).toThrow();
    });

    it("should validate optional quality filter", () => {
      const spec: LexemeSlotSpec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "noun",
        style: "fantasy",
        targetCount: 30,
        sourceMode: "llm",
        qualityFilter: {
          minLength: 3,
          maxLength: 15,
          requireCapitalized: true,
          llmCritic: false,
        },
      };

      expect(() => validateLexemeSlotSpec(spec)).not.toThrow();
    });

    it("should validate optional examples", () => {
      const spec: LexemeSlotSpec = {
        id: "test_nouns",
        cultureId: "test",
        pos: "noun",
        style: "fantasy",
        targetCount: 30,
        sourceMode: "llm",
        examples: ["Forest", "River", "Mountain"],
      };

      expect(() => validateLexemeSlotSpec(spec)).not.toThrow();
    });
  });

  describe("Template Spec", () => {
    it("should validate valid template spec", () => {
      const spec: TemplateSpec = {
        id: "test_templates",
        cultureId: "test",
        type: "person",
        style: "fantasy",
        targetCount: 5,
        sourceMode: "llm",
        slotHints: [
          {
            name: "NOUN",
            kind: "lexemeList",
            description: "A noun",
            listId: "test_nouns",
          },
        ],
      };

      expect(() => validateTemplateSpec(spec)).not.toThrow();
    });

    it("should require slot hints", () => {
      const spec = {
        id: "test_templates",
        cultureId: "test",
        type: "person",
        style: "fantasy",
        targetCount: 5,
        sourceMode: "llm",
        // Missing slotHints
      };

      expect(() => validateTemplateSpec(spec)).toThrow();
    });

    it("should validate slot hint kinds", () => {
      const spec: TemplateSpec = {
        id: "test_templates",
        cultureId: "test",
        type: "person",
        style: "fantasy",
        targetCount: 5,
        sourceMode: "llm",
        slotHints: [
          {
            name: "NOUN",
            kind: "lexemeList",
            description: "A noun",
          },
          {
            name: "NAME",
            kind: "phonotactic",
            description: "Generated name",
          },
          {
            name: "ENTITY",
            kind: "entityName",
            description: "Entity name",
          },
        ],
      };

      expect(() => validateTemplateSpec(spec)).not.toThrow();
    });
  });

  describe("Batch Spec", () => {
    it("should validate valid batch spec", () => {
      const spec: BatchSpec = {
        name: "test_batch",
        description: "Test batch",
        lexemeSpecs: [
          {
            id: "test_nouns",
            cultureId: "test",
            pos: "noun",
            style: "fantasy",
            targetCount: 30,
            sourceMode: "llm",
          },
        ],
        templateSpecs: [
          {
            id: "test_templates",
            cultureId: "test",
            type: "person",
            style: "fantasy",
            targetCount: 5,
            sourceMode: "llm",
            slotHints: [],
          },
        ],
        profileSpecs: [],
      };

      expect(() => validateBatchSpec(spec)).not.toThrow();
    });

    it("should allow empty lexeme and template specs", () => {
      const spec: BatchSpec = {
        name: "empty_batch",
        lexemeSpecs: [],
        templateSpecs: [],
        profileSpecs: [],
      };

      expect(() => validateBatchSpec(spec)).not.toThrow();
    });
  });

  describe("Default Spec Creators", () => {
    it("should create default lexeme spec", () => {
      const spec = createDefaultLexemeSpec({
        id: "custom_id",
        cultureId: "custom",
      });

      expect(spec.id).toBe("custom_id");
      expect(spec.cultureId).toBe("custom");
      expect(spec.pos).toBe("noun");
      expect(spec.targetCount).toBe(30);
      expect(spec.sourceMode).toBe("llm");
    });

    it("should create default template spec", () => {
      const spec = createDefaultTemplateSpec({
        id: "custom_id",
        type: "battle",
      });

      expect(spec.id).toBe("custom_id");
      expect(spec.type).toBe("battle");
      expect(spec.targetCount).toBe(5);
      expect(spec.sourceMode).toBe("llm");
    });
  });
});
