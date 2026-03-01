/**
 * WikiSearch - Full-text search for wiki pages
 *
 * Uses fuse.js for fuzzy matching across page titles and content.
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import { useKeyboardNavigation } from "@the-canonry/shared-components";
import type { WikiPage } from "../types/world.ts";
import styles from "./WikiSearch.module.css";

interface WikiSearchProps {
  pages: WikiPage[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (pageId: string) => void;
  /** Direction to expand dropdown - 'down' (default) or 'up' */
  expandDirection?: "down" | "up";
}

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

  // Build fuse.js search index
  const fuse = useMemo(() => {
    return new Fuse(pages, {
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
    });
  }, [pages]);

  // Search results
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    return fuse.search(query).slice(0, 10);
  }, [fuse, query]);

  // Keyboard navigation via shared hook
  const handleEnter = useCallback(
    (id: string) => {
      onSelect(id);
      setIsOpen(false);
      onQueryChange("");
    },
    [onSelect, onQueryChange]
  );

  const handleEscape = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleKeyDown = useKeyboardNavigation({
    results,
    selectedIndex,
    setSelectedIndex,
    onSelect: handleEnter,
    onEscape: handleEscape,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset keyboard selection when result set changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived UI selection reset on results refresh
    setSelectedIndex(0);
  }, [results]);

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => { if (isOpen) handleKeyDown(e); }}
        className={styles.input}
      />

      {isOpen && query.length >= 2 && (
        <div className={expandDirection === "up" ? styles.dropdownUp : styles.dropdown}>
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.item.id}
                className={index === selectedIndex ? styles.resultSelected : styles.result}
                onClick={() => {
                  onSelect(result.item.id);
                  setIsOpen(false);
                  onQueryChange("");
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {result.item.title}
                <span className={styles.resultType}>{result.item.type}</span>
              </button>
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
