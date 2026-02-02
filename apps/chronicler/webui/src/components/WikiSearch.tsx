/**
 * WikiSearch - Full-text search for wiki pages
 *
 * Uses fuse.js for fuzzy matching across page titles and content.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import type { WikiPage } from '../types/world.ts';
import styles from './WikiSearch.module.css';

interface WikiSearchProps {
  pages: WikiPage[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (pageId: string) => void;
  /** Direction to expand dropdown - 'down' (default) or 'up' */
  expandDirection?: 'down' | 'up';
}

export default function WikiSearch({
  pages,
  query,
  onQueryChange,
  onSelect,
  expandDirection = 'down',
}: WikiSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build fuse.js search index
  const fuse = useMemo(() => {
    return new Fuse(pages, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'aliases', weight: 1.5 },
        { name: 'content.summary', weight: 1.2 },
        { name: 'content.sections.heading', weight: 0.5 },
        { name: 'content.sections.content', weight: 1 },
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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].item.id);
          setIsOpen(false);
          onQueryChange('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when results change
  useEffect(() => {
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
        onKeyDown={handleKeyDown}
        className={styles.input}
      />

      {isOpen && query.length >= 2 && (
        <div className={expandDirection === 'up' ? styles.dropdownUp : styles.dropdown}>
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.item.id}
                className={index === selectedIndex ? styles.resultSelected : styles.result}
                onClick={() => {
                  onSelect(result.item.id);
                  setIsOpen(false);
                  onQueryChange('');
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
