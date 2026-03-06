/**
 * WikiSearch - Full-text search for wiki pages
 *
 * Uses fuse.js for fuzzy matching across page titles and content.
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import { useKeyboardNavigation } from "@the-canonry/shared-components";
import type { Optional } from "@the-canonry/shared-components";
import type { WikiPage } from "../types/world.ts";
import styles from "./WikiSearch.module.css";

interface WikiSearchProps {
  pages: WikiPage[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (pageId: string) => void;
  /** Direction to expand dropdown - 'down' (default) or 'up' */
  expandDirection: Optional<"down" | "up">;
}

interface SearchResult {
  item: WikiPage;
}

function SearchResultsDropdown({
  results,
  selectedIndex,
  expandDirection,
  onSelect,
  onHover,
}: Readonly<{
  results: SearchResult[];
  selectedIndex: number;
  expandDirection: Optional<"down" | "up">;
  onSelect: (id: string) => void;
  onHover: (index: number) => void;
}>) {
  return (
    <div className={expandDirection === "up" ? styles.dropdownUp : styles.dropdown}>
      {results.length > 0 ? (
        results.map((result, index) => (
          <button
            key={result.item.id}
            className={index === selectedIndex ? styles.resultSelected : styles.result}
            onClick={() => onSelect(result.item.id)}
            onMouseEnter={() => onHover(index)}
          >
            {result.item.title}
            <span className={styles.resultType}>{result.item.type}</span>
          </button>
        ))
      ) : (
        <div className={styles.noResults}>No results found</div>
      )}
    </div>
  );
}

const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 2 },
    { name: "aliases", weight: 1.5 },
    { name: "content.summary", weight: 1.2 },
    { name: "content.sections.heading", weight: 0.5 },
    { name: "content.sections.content", weight: 1 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
};

export default function WikiSearch({
  pages,
  query,
  onQueryChange,
  onSelect,
  expandDirection = "down",
}: Readonly<WikiSearchProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(pages, FUSE_OPTIONS), [pages]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    return fuse.search(query).slice(0, 10);
  }, [fuse, query]);

  const handleSelectAndClose = useCallback(
    (id: string) => { onSelect(id); setIsOpen(false); onQueryChange(""); },
    [onSelect, onQueryChange]
  );

  const handleEscape = useCallback(() => { setIsOpen(false); }, []);

  const handleKeyDown = useKeyboardNavigation({
    results, selectedIndex, setSelectedIndex,
    onSelect: handleSelectAndClose,
    onEscape: handleEscape,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived UI selection reset on results refresh
    setSelectedIndex(0);
  }, [results]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.target.value);
    setIsOpen(true);
  }, [onQueryChange]);

  const handleInputFocus = useCallback(() => { setIsOpen(true); }, []);
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => { if (isOpen) handleKeyDown(e); }, [isOpen, handleKeyDown]);

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        type="text" placeholder="Search..." value={query}
        onChange={handleInputChange} onFocus={handleInputFocus} onKeyDown={handleInputKeyDown}
        className={styles.input}
      />
      {isOpen && query.length >= 2 && (
        <SearchResultsDropdown
          results={results} selectedIndex={selectedIndex}
          expandDirection={expandDirection}
          onSelect={handleSelectAndClose} onHover={setSelectedIndex}
        />
      )}
    </div>
  );
}
