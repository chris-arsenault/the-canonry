import { describe, it, expect } from "vitest";
import { generateFromProfile, executeStrategy } from "./profile-executor.js";
import type {
  NamingProfile,
  DerivedFromEntityStrategy,
} from "../types/profile.js";
import { MockEntityLookup, type Entity } from "../types/integration.js";

describe("Profile Executor - KG Integration (DerivedFromEntity)", () => {
  // Create test entities
  const testEntities: Entity[] = [
    {
      id: "general-1",
      name: "Thorin Ironforge",
      type: "npc",
      tags: ["general", "commander", "dwarf"],
    },
    {
      id: "general-2",
      name: "Elandril Moonwhisper",
      type: "npc",
      tags: ["general", "commander", "elf"],
    },
    {
      id: "location-1",
      name: "Ironpeak",
      type: "location",
      tags: ["mountain", "fortress"],
    },
    {
      id: "location-2",
      name: "Shadowvale",
      type: "location",
      tags: ["valley", "forest"],
    },
    {
      id: "mage-1",
      name: "Zephyr the Wise",
      type: "npc",
      tags: ["mage", "scholar"],
    },
  ];

  describe("Basic Entity Lookup", () => {
    it("should find entity by type", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "test_derived",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "location",
        sourceSelector: {
          type: "location",
        },
        transform: {
          kind: "identity",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(["Ironpeak", "Shadowvale"]).toContain(result);
    });

    it("should find entity by tags", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "find_general",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["general"],
        },
        transform: {
          kind: "identity",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);

      expect(result).toBeDefined();
      expect(["Thorin Ironforge", "Elandril Moonwhisper"]).toContain(result);
    });

    it("should throw error if no entity found", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "no_match",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["nonexistent_tag"],
        },
        transform: {
          kind: "identity",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      expect(() => executeStrategy(strategy, context)).toThrow(/No entity found/);
    });

    it("should throw error if entityLookup not provided", () => {
      const strategy: DerivedFromEntityStrategy = {
        id: "no_lookup",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: { type: "npc" },
        transform: { kind: "identity" },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        // No entityLookup!
      };

      expect(() => executeStrategy(strategy, context)).toThrow(/requires entityLookup/);
    });
  });

  describe("Name Transformations", () => {
    it("should use identity transform (name as-is)", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "identity_test",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["general"],
          limit: 1,
        },
        transform: {
          kind: "identity",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);
      expect(["Thorin Ironforge", "Elandril Moonwhisper"]).toContain(result);
    });

    it("should use prefix transform", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "prefix_test",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["mage"],
        },
        transform: {
          kind: "prefix",
          prefix: "Archmage ",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);
      expect(result).toBe("Archmage Zephyr the Wise");
    });

    it("should use suffix transform", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "suffix_test",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["general"],
          limit: 1,
        },
        transform: {
          kind: "suffix",
          suffix: " the Great",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);
      expect(result).toMatch(/ the Great$/);
    });

    it("should use templated transform for battle names", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "battle_name",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "npc",
        sourceSelector: {
          type: "npc",
          tags: ["general"],
          limit: 1,
        },
        transform: {
          kind: "templated",
          template: "The Battle of {{name}}",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);
      expect(result).toMatch(/^The Battle of /);
      expect(
        result === "The Battle of Thorin Ironforge" ||
        result === "The Battle of Elandril Moonwhisper"
      ).toBe(true);
    });

    it("should use templated transform for location-based names", () => {
      const lookup = new MockEntityLookup(testEntities);

      const strategy: DerivedFromEntityStrategy = {
        id: "campaign_name",
        kind: "derivedFromEntity",
        weight: 1.0,
        sourceType: "location",
        sourceSelector: {
          type: "location",
          tags: ["fortress"],
        },
        transform: {
          kind: "templated",
          template: "The {{name}} Campaign",
        },
      };

      const context = {
        domains: [],
        profiles: [],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      const result = executeStrategy(strategy, context);
      expect(result).toBe("The Ironpeak Campaign");
    });
  });

  describe("Integration: Battle Profile", () => {
    it("should generate battle names from mixed strategies", () => {
      const lookup = new MockEntityLookup(testEntities);

      const profile: NamingProfile = {
        id: "imperial:battle",
        cultureId: "imperial",
        type: "battle",
        strategies: [
          {
            id: "named_after_general",
            kind: "derivedFromEntity",
            weight: 0.5,
            sourceType: "npc",
            sourceSelector: {
              type: "npc",
              tags: ["general"],
            },
            transform: {
              kind: "templated",
              template: "The Battle of {{name}}",
            },
          } as DerivedFromEntityStrategy,
          {
            id: "named_after_location",
            kind: "derivedFromEntity",
            weight: 0.5,
            sourceType: "location",
            sourceSelector: {
              type: "location",
            },
            transform: {
              kind: "templated",
              template: "The {{name}} Conflict",
            },
          } as DerivedFromEntityStrategy,
        ],
      };

      const context = {
        domains: [],
        profiles: [profile],
        lexemeLists: [],
        grammarRules: [],
        entityLookup: lookup,
      };

      // Generate multiple battle names
      const names = Array.from({ length: 10 }, (_, i) =>
        generateFromProfile(profile, { ...context, seed: `battle-${i}` })
      );

      console.log("Sample battle names:", names.slice(0, 5));

      // All should be valid
      names.forEach((name) => {
        expect(name.length).toBeGreaterThan(0);
        expect(
          name.startsWith("The Battle of ") ||
          name.endsWith(" Conflict")
        ).toBe(true);
      });
    });
  });

  describe("MockEntityLookup", () => {
    it("should filter by type", () => {
      const lookup = new MockEntityLookup(testEntities);

      const npcs = lookup.findEntities({ type: "npc" });
      expect(npcs.length).toBe(3);
      npcs.forEach(e => expect(e.type).toBe("npc"));

      const locations = lookup.findEntities({ type: "location" });
      expect(locations.length).toBe(2);
      locations.forEach(e => expect(e.type).toBe("location"));
    });

    it("should filter by tags (OR logic)", () => {
      const lookup = new MockEntityLookup(testEntities);

      const generals = lookup.findEntities({ tags: ["general"] });
      expect(generals.length).toBe(2);

      const dwarves = lookup.findEntities({ tags: ["dwarf"] });
      expect(dwarves.length).toBe(1);
      expect(dwarves[0].name).toBe("Thorin Ironforge");
    });

    it("should filter by tags (AND logic)", () => {
      const lookup = new MockEntityLookup(testEntities);

      const results = lookup.findEntities({
        tags: ["general", "dwarf"],
        requireAllTags: true,
      });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Thorin Ironforge");
    });

    it("should respect limit", () => {
      const lookup = new MockEntityLookup(testEntities);

      const results = lookup.findEntities({ type: "npc", limit: 2 });
      expect(results.length).toBe(2);
    });

    it("should get entity by ID", () => {
      const lookup = new MockEntityLookup(testEntities);

      const entity = lookup.getEntityById("general-1");
      expect(entity).toBeDefined();
      expect(entity?.name).toBe("Thorin Ironforge");

      const notFound = lookup.getEntityById("nonexistent");
      expect(notFound).toBeNull();
    });
  });
});
