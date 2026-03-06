/**
 * useEntityBrowserSearch - Search logic extracted from EntityBrowser
 */

import { useState, useMemo, useCallback } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import type { SearchResult } from "../EntityBrowserTypes";

function findStringListMatches(
  items: string[],
  query: string,
  fieldLabel: string
): SearchResult["matches"] {
  const matches: SearchResult["matches"] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const idx = item.toLowerCase().indexOf(query);
    if (idx !== -1) {
      matches.push({ field: fieldLabel, value: item, matchIndex: idx });
    }
  }
  return matches;
}

function matchEntity(
  entity: EntityNavItem,
  query: string,
  includeText: boolean
): SearchResult["matches"] {
  const matches: SearchResult["matches"] = [];

  const nameIdx = entity.name.toLowerCase().indexOf(query);
  if (nameIdx !== -1) {
    matches.push({ field: "name", value: entity.name, matchIndex: nameIdx });
  }

  matches.push(...findStringListMatches(entity.aliases, query, "alias"));
  matches.push(...findStringListMatches(entity.slugAliases, query, "slug alias"));

  if (includeText && entity.summary) {
    const sumIdx = entity.summary.toLowerCase().indexOf(query);
    if (sumIdx !== -1) {
      matches.push({ field: "summary", value: entity.summary, matchIndex: sumIdx });
    }
  }

  return matches;
}

export function useEntityBrowserSearch(navEntities: EntityNavItem[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(false);

  const searchResults: SearchResult[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const results: SearchResult[] = [];
    for (const entity of navEntities) {
      const matches = matchEntity(entity, q, searchText);
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
