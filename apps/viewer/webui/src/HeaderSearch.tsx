import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse, { type FuseResult } from "fuse.js";
import type { WorldEntity } from "@canonry/world-schema";
import type { ChronicleRecord, StaticPageRecord } from "@the-canonry/world-store";
import {
  getChronicles,
  getEntities,
  getSlotRecord,
  getStaticPages,
} from "@the-canonry/world-store";
import { useKeyboardNavigation } from "@the-canonry/shared-components";

interface SearchEntry {
  id: string;
  title: string;
  type: string;
  content: { summary: string };
}

function staticPageToSearchEntry(page: StaticPageRecord): SearchEntry | null {
  if (!page.pageId) return null;
  if ((page.status || "published") !== "published") return null;
  return {
    id: page.pageId,
    title: page.title || page.pageId,
    type: "page",
    content: { summary: page.summary || "" },
  };
}

function chronicleToSearchEntry(chronicle: ChronicleRecord): SearchEntry | null {
  if (!chronicle.chronicleId) return null;
  if (chronicle.status !== "complete" || !chronicle.acceptedAt) return null;
  return {
    id: chronicle.chronicleId,
    title: chronicle.title || chronicle.chronicleId,
    type: "chronicle",
    content: { summary: chronicle.summary || "" },
  };
}

function entityToSearchEntry(entity: WorldEntity): SearchEntry | null {
  if (!entity.id || !entity.name || entity.kind === "era") return null;
  return {
    id: entity.id,
    title: entity.name,
    type: entity.kind || "entity",
    content: { summary: entity.description || "" },
  };
}

async function loadPageIndex(projectId: string, slotIndex: number): Promise<SearchEntry[]> {
  const slot = await getSlotRecord(projectId, slotIndex);
  const simulationRunId = slot?.simulationRunId ?? null;
  if (!simulationRunId) return [];

  const [entities, chronicles, staticPages] = await Promise.all([
    getEntities(simulationRunId),
    getChronicles(simulationRunId),
    getStaticPages(projectId),
  ]);

  return [
    ...staticPages.map(staticPageToSearchEntry),
    ...chronicles.map(chronicleToSearchEntry),
    ...entities.map(entityToSearchEntry),
  ].filter((entry): entry is SearchEntry => entry !== null);
}

function useSearchIndex(projectId: string, slotIndex: number, dexieSeededAt: number) {
  const [pages, setPages] = useState<SearchEntry[]>([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsIndexLoading(true);
    });
    void (async () => {
      try {
        const result = await loadPageIndex(projectId, slotIndex);
        if (!cancelled) setPages(result);
      } catch (err) {
        console.error("[viewer] Failed to build header search index:", err);
        if (!cancelled) setPages([]);
      } finally {
        if (!cancelled) setIsIndexLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, slotIndex, dexieSeededAt]);

  return { pages, isIndexLoading };
}

interface SearchDropdownProps {
  results: FuseResult<SearchEntry>[];
  selectedIndex: number;
  isIndexLoading: boolean;
  onSelect: (id: string) => void;
  onHover: (index: number) => void;
}

function SearchDropdown({ results, selectedIndex, isIndexLoading, onSelect, onHover }: Readonly<SearchDropdownProps>) {
  if (results.length > 0) {
    return (
      <div className="header-search-dropdown">
        {results.map((result, index) => (
          <button
            key={result.item.id}
            type="button"
            className={`header-search-result ${index === selectedIndex ? "selected" : ""}`}
            onClick={() => onSelect(result.item.id)}
            onMouseEnter={() => onHover(index)}
          >
            <span className="header-search-result-title">{result.item.title}</span>
            <span className="header-search-result-type">{result.item.type}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="header-search-dropdown">
      <div className="header-search-no-results">
        {isIndexLoading ? "Indexing pages..." : "No results found"}
      </div>
    </div>
  );
}

interface HeaderSearchProps {
  projectId: string;
  slotIndex: number;
  dexieSeededAt: number;
  onNavigate: (id: string) => void;
}

export default function HeaderSearch({ projectId, slotIndex, dexieSeededAt, onNavigate }: Readonly<HeaderSearchProps>) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pages, isIndexLoading } = useSearchIndex(projectId, slotIndex, dexieSeededAt);

  const fuse = useMemo(
    () =>
      new Fuse(pages, {
        keys: [
          { name: "title", weight: 2 },
          { name: "content.summary", weight: 1 },
        ],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [pages]
  );

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    return fuse.search(query).slice(0, 8);
  }, [fuse, query]);

  const handleSelect = useCallback(
    (id: string | null) => {
      if (id) onNavigate(id);
      setIsOpen(false);
      setQuery("");
    },
    [onNavigate]
  );

  const handleKeyDown = useKeyboardNavigation({
    results,
    selectedIndex,
    setSelectedIndex,
    onSelect: (id: string) => handleSelect(id),
    onEscape: () => handleSelect(null),
  });

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="header-search" ref={containerRef}>
      <input
        type="text"
        className="header-search-input"
        placeholder="Search wiki..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (isOpen) handleKeyDown(e);
        }}
      />
      {isOpen && query.length >= 2 && (
        <SearchDropdown
          results={results}
          selectedIndex={selectedIndex}
          isIndexLoading={isIndexLoading}
          onSelect={handleSelect}
          onHover={setSelectedIndex}
        />
      )}
    </div>
  );
}
