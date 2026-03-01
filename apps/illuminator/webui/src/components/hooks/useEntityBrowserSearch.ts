/**
 * useEntityBrowserSearch - Search logic extracted from EntityBrowser
 */

import { useState, useMemo, useCallback } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import type { SearchResult } from "../EntityBrowserTypes";

export function useEntityBrowserSearch(navEntities: EntityNavItem[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(false);

  const searchResults: SearchResult[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const results: SearchResult[] = [];

    for (const entity of navEntities) {
      const matches: SearchResult["matches"] = [];

      const nameIdx = entity.name.toLowerCase().indexOf(q);
      if (nameIdx !== -1) {
        matches.push({ field: "name", value: entity.name, matchIndex: nameIdx });
      }

      for (const alias of entity.aliases) {
        if (typeof alias !== "string") continue;
        const aliasIdx = alias.toLowerCase().indexOf(q);
        if (aliasIdx !== -1) {
          matches.push({ field: "alias", value: alias, matchIndex: aliasIdx });
        }
      }

      for (const slug of entity.slugAliases) {
        if (typeof slug !== "string") continue;
        const slugIdx = slug.toLowerCase().indexOf(q);
        if (slugIdx !== -1) {
          matches.push({ field: "slug alias", value: slug, matchIndex: slugIdx });
        }
      }

      if (searchText && entity.summary) {
        const sumIdx = entity.summary.toLowerCase().indexOf(q);
        if (sumIdx !== -1) {
          matches.push({ field: "summary", value: entity.summary, matchIndex: sumIdx });
        }
      }

      if (matches.length > 0) {
        results.push({ entity, matches });
      }
    }

    results.sort((a, b) => {
      const aHasName = a.matches.some((m) => m.field === "name") ? 0 : 1;
      const bHasName = b.matches.some((m) => m.field === "name") ? 0 : 1;
      if (aHasName !== bHasName) return aHasName - bHasName;
      return a.entity.name.localeCompare(b.entity.name);
    });

    return results;
  }, [navEntities, searchQuery, searchText]);

  const handleSearchSelect = useCallback((_entityId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    searchOpen,
    searchText,
    searchResults,
    setSearchQuery,
    setSearchOpen,
    setSearchText,
    handleSearchSelect,
  };
}
