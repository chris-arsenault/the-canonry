import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Fuse from "fuse.js";
import {
  getChronicles,
  getEntities,
  getSlotRecord,
  getStaticPages,
} from "@penguin-tales/world-store";

function staticPageToSearchEntry(page) {
  if (!page?.pageId) return null;
  if ((page.status || "published") !== "published") return null;
  return {
    id: page.pageId,
    title: page.title || page.pageId,
    type: "page",
    content: { summary: page.summary || "" },
  };
}

function chronicleToSearchEntry(chronicle) {
  if (!chronicle?.chronicleId) return null;
  if (chronicle.status !== "complete" || !chronicle.acceptedAt) return null;
  return {
    id: chronicle.chronicleId,
    title: chronicle.title || chronicle.chronicleId,
    type: "chronicle",
    content: { summary: chronicle.summary || "" },
  };
}

function entityToSearchEntry(entity) {
  if (!entity?.id || !entity.name || entity.kind === "era") return null;
  return {
    id: entity.id,
    title: entity.name,
    type: entity.kind || "entity",
    content: { summary: entity.description || entity.summary || "" },
  };
}

async function loadPageIndex(projectId, slotIndex) {
  const slot = await getSlotRecord(projectId, slotIndex);
  const simulationRunId = slot?.simulationRunId || null;
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
  ].filter(Boolean);
}

function useSearchIndex(projectId, slotIndex, dexieSeededAt) {
  const [pages, setPages] = useState([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);

  useEffect(() => {
    if (!projectId || typeof slotIndex !== "number") return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsIndexLoading(true);
    });
    (async () => {
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

function useKeyboardNavigation(results, selectedIndex, setSelectedIndex, onSelect) {
  return useCallback(
    (e) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) onSelect(results[selectedIndex].item.id);
          break;
        case "Escape":
          onSelect(null);
          break;
      }
    },
    [results, selectedIndex, setSelectedIndex, onSelect]
  );
}

export default function HeaderSearch({ projectId, slotIndex, dexieSeededAt, onNavigate }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);
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
    (id) => {
      if (id) onNavigate(id);
      setIsOpen(false);
      setQuery("");
    },
    [onNavigate]
  );

  const handleKeyDown = useKeyboardNavigation(
    results,
    selectedIndex,
    setSelectedIndex,
    handleSelect
  );

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
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
        <div className="header-search-dropdown">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.item.id}
                type="button"
                className={`header-search-result ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => handleSelect(result.item.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="header-search-result-title">{result.item.title}</span>
                <span className="header-search-result-type">{result.item.type}</span>
              </button>
            ))
          ) : (
            <div className="header-search-no-results">
              {isIndexLoading ? "Indexing pages..." : "No results found"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

HeaderSearch.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  slotIndex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dexieSeededAt: PropTypes.any,
  onNavigate: PropTypes.func,
};
