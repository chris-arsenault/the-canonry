import { describe, it, expect } from "vitest";
import {
  selectDomain,
  rankDomains,
  domainMatches,
  findDomainsForKind,
  findDomainConflicts,
} from "./domain-selector.js";
import type { NamingDomain } from "../types/domain.js";

describe("DomainSelector", () => {
  const elfDomain: NamingDomain = {
    id: "elf",
    appliesTo: {
      kind: ["npc"],
      subKind: ["elf"],
      tags: ["high", "ancient"],
    },
    phonology: {
      consonants: ["l"],
      vowels: ["a"],
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

  const dwarfDomain: NamingDomain = {
    id: "dwarf",
    appliesTo: {
      kind: ["npc"],
      subKind: ["dwarf"],
      tags: ["mountain"],
    },
    phonology: {
      consonants: ["k"],
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

  const genericNpcDomain: NamingDomain = {
    id: "generic_npc",
    appliesTo: {
      kind: ["npc"],
    },
    phonology: {
      consonants: ["t"],
      vowels: ["e"],
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

  describe("selectDomain", () => {
    it("should select exact match by kind and subKind", () => {
      const domain = selectDomain([elfDomain, dwarfDomain], "npc", "elf");

      expect(domain).toBeTruthy();
      expect(domain?.id).toBe("elf");
    });

    it("should select best match by tags", () => {
      const domain = selectDomain(
        [elfDomain, dwarfDomain],
        "npc",
        "elf",
        ["high", "ancient"]
      );

      expect(domain?.id).toBe("elf");
    });

    it("should fall back to generic if no exact match", () => {
      const domain = selectDomain(
        [genericNpcDomain, elfDomain],
        "npc",
        "human"
      );

      expect(domain?.id).toBe("generic_npc");
    });

    it("should return null if no domain matches", () => {
      const domain = selectDomain([elfDomain], "location");

      expect(domain).toBeNull();
    });

    it("should prefer more specific match", () => {
      const domain = selectDomain([genericNpcDomain, elfDomain], "npc", "elf");

      // Elf domain is more specific (has subKind)
      expect(domain?.id).toBe("elf");
    });

    it("should handle partial tag match", () => {
      const domain = selectDomain([elfDomain], "npc", "elf", ["high"]);

      // Has 1 of 2 tags
      expect(domain?.id).toBe("elf");
    });
  });

  describe("rankDomains", () => {
    it("should rank domains by match quality", () => {
      const ranked = rankDomains(
        [genericNpcDomain, elfDomain, dwarfDomain],
        "npc",
        "elf",
        ["high"]
      );

      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].domain.id).toBe("elf");
      expect(ranked[0].score).toBeGreaterThan(ranked[1]?.score ?? 0);
    });

    it("should return empty for no matches", () => {
      const ranked = rankDomains([elfDomain], "location");

      expect(ranked).toHaveLength(0);
    });

    it("should include match reasons", () => {
      const ranked = rankDomains([elfDomain], "npc", "elf");

      expect(ranked[0].reason).toBeTruthy();
      expect(ranked[0].reason).toContain("kind=npc");
    });
  });

  describe("domainMatches", () => {
    it("should return true for matching kind", () => {
      expect(domainMatches(elfDomain, "npc")).toBe(true);
    });

    it("should return false for non-matching kind", () => {
      expect(domainMatches(elfDomain, "location")).toBe(false);
    });

    it("should match subKind", () => {
      expect(domainMatches(elfDomain, "npc", "elf")).toBe(true);
      expect(domainMatches(elfDomain, "npc", "dwarf")).toBe(false);
    });

    it("should handle missing subKind in query", () => {
      expect(domainMatches(elfDomain, "npc")).toBe(true);
    });
  });

  describe("findDomainsForKind", () => {
    it("should find all domains matching kind", () => {
      const domains = findDomainsForKind(
        [elfDomain, dwarfDomain, genericNpcDomain],
        "npc"
      );

      expect(domains).toHaveLength(3);
    });

    it("should return empty for non-matching kind", () => {
      const domains = findDomainsForKind([elfDomain], "location");

      expect(domains).toHaveLength(0);
    });
  });

  describe("findDomainConflicts", () => {
    it("should detect identical domain criteria", () => {
      const duplicate: NamingDomain = {
        ...elfDomain,
        id: "elf_duplicate",
      };

      const conflicts = findDomainConflicts([elfDomain, duplicate]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reason).toBe("identical matching criteria");
    });

    it("should return empty for non-conflicting domains", () => {
      const conflicts = findDomainConflicts([elfDomain, dwarfDomain]);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty domain list", () => {
      const domain = selectDomain([], "npc");
      expect(domain).toBeNull();
    });

    it("should handle domain with no tags", () => {
      const noTagsDomain: NamingDomain = {
        ...elfDomain,
        appliesTo: {
          kind: ["npc"],
        },
      };

      const domain = selectDomain([noTagsDomain], "npc");
      expect(domain).toBeTruthy();
    });

    it("should handle entity with no tags", () => {
      const domain = selectDomain([elfDomain], "npc", "elf", []);
      expect(domain?.id).toBe("elf");
    });
  });
});
