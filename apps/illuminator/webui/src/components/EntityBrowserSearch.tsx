/**
 * EntityBrowserSearch - Search dropdown for the entity browser
 *
 * Extracted from EntityBrowser to reduce file size and complexity.
 */

import React, { useCallback } from "react";
import { HighlightMatch } from "./EntityBrowserHelpers";
import type { SearchResult } from "./EntityBrowserTypes";

interface EntityBrowserSearchProps {
  searchQuery: string;
  searchText: boolean;
  searchOpen: boolean;
  searchResults: SearchResult[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (value: string) => void;
  onSearchTextChange: (checked: boolean) => void;
  onSearchOpen: (open: boolean) => void;
  onSearchSelect: (entityId: string) => void;
}

export function EntityBrowserSearch({
  searchQuery,
  searchText,
  searchOpen,
  searchResults,
  searchInputRef,
  onSearchQueryChange,
  onSearchTextChange,
  onSearchOpen,
  onSearchSelect,
}: Readonly<EntityBrowserSearchProps>) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchQueryChange(e.target.value);
      if (e.target.value.trim().length >= 2) onSearchOpen(true);
    },
    [onSearchQueryChange, onSearchOpen]
  );

  const handleInputFocus = useCallback(() => {
    if (searchQuery.trim().length >= 2) onSearchOpen(true);
  }, [searchQuery, onSearchOpen]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onSearchOpen(false);
        onSearchQueryChange("");
        e.currentTarget.blur();
      }
      if (e.key === "Enter" && searchResults.length > 0) {
        onSearchSelect(searchResults[0].entity.id);
      }
    },
    [onSearchOpen, onSearchQueryChange, searchResults, onSearchSelect]
  );

  const handleBackdropClick = useCallback(() => {
    onSearchOpen(false);
  }, [onSearchOpen]);

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onSearchOpen(false);
    },
    [onSearchOpen]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchTextChange(e.target.checked);
    },
    [onSearchTextChange]
  );

  return (
    <div className="eb-search-wrap">
      <div className="eb-search-row">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder={
            searchText
              ? "Search names, aliases, summaries, descriptions\u2026"
              : "Search names, aliases\u2026"
          }
          className="illuminator-select eb-search-input"
        />
        <label className="eb-search-text-label">
          <input
            type="checkbox"
            checked={searchText}
            onChange={handleCheckboxChange}
          />
          Include text
        </label>
      </div>
      {searchOpen && searchQuery.trim().length >= 2 && (
        <SearchDropdown
          results={searchResults}
          query={searchQuery.trim().toLowerCase()}
          onSelect={onSearchSelect}
        />
      )}
      {searchOpen && (
        <div
          className="eb-search-backdrop"
          onClick={handleBackdropClick}
          role="button"
          tabIndex={0}
          onKeyDown={handleBackdropKeyDown}
        />
      )}
    </div>
  );
}

// ─── SearchDropdown ────────────────────────────────────────────────────────

interface SearchDropdownProps {
  results: SearchResult[];
  query: string;
  onSelect: (entityId: string) => void;
}

function SearchDropdown({ results, query, onSelect }: Readonly<SearchDropdownProps>) {
  if (results.length === 0) {
    return (
      <div className="eb-search-dropdown">
        <div className="eb-search-empty">No matches</div>
      </div>
    );
  }

  return (
    <div className="eb-search-dropdown">
      <div className="eb-search-count">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </div>
      {results.map(({ entity, matches }) => (
        <SearchResultItem
          key={entity.id}
          entity={entity}
          matches={matches}
          query={query}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ─── SearchResultItem ──────────────────────────────────────────────────────

interface SearchResultItemProps {
  entity: SearchResult["entity"];
  matches: SearchResult["matches"];
  query: string;
  onSelect: (entityId: string) => void;
}

function SearchResultItem({ entity, matches, query, onSelect }: Readonly<SearchResultItemProps>) {
  const handleClick = useCallback(() => {
    onSelect(entity.id);
  }, [onSelect, entity.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onSelect(entity.id);
    },
    [onSelect, entity.id]
  );

  return (
    <div
      onClick={handleClick}
      className="eb-search-result"
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="eb-search-result-name">
        <HighlightMatch text={entity.name} query={query} />
        <span className="eb-search-result-kind">
          {entity.kind}
          {entity.subtype ? `/${entity.subtype}` : ""}
        </span>
      </div>
      {matches
        .filter((m) => m.field !== "name")
        .map((m, i) => (
          <div key={i} className="eb-search-match-row">
            <span className="eb-search-match-field">{m.field}</span>
            <HighlightMatch
              text={m.value}
              query={query}
              truncate={m.field === "summary" || m.field === "description" ? 120 : 0}
              matchIndex={m.matchIndex}
            />
          </div>
        ))}
    </div>
  );
}
