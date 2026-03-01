/**
 * ChronicleFilterBar - Sort, filter, group controls and entity search.
 */

import React, { useCallback, useMemo } from "react";
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  FOCUS_OPTIONS,
} from "./chroniclePanelConstants";
import type { EntityNavItem } from "./chroniclePanelTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChronicleFilterBarProps {
  groupByType: boolean;
  onSetGroupByType: (value: boolean) => void;
  sortMode: string;
  onSetSortMode: (value: string) => void;
  statusFilter: string;
  onSetStatusFilter: (value: string) => void;
  focusFilter: string;
  onSetFocusFilter: (value: string) => void;
  entitySearchQuery: string;
  onSetEntitySearchQuery: (value: string) => void;
  onSetEntitySearchSelectedId: (id: string | null) => void;
  showEntitySuggestions: boolean;
  onSetShowEntitySuggestions: (value: boolean) => void;
  entitySuggestions: EntityNavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChronicleFilterBar({
  groupByType,
  onSetGroupByType,
  sortMode,
  onSetSortMode,
  statusFilter,
  onSetStatusFilter,
  focusFilter,
  onSetFocusFilter,
  entitySearchQuery,
  onSetEntitySearchQuery,
  onSetEntitySearchSelectedId,
  showEntitySuggestions,
  onSetShowEntitySuggestions,
  entitySuggestions,
}: ChronicleFilterBarProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSetEntitySearchQuery(e.target.value);
      onSetEntitySearchSelectedId(null);
    },
    [onSetEntitySearchQuery, onSetEntitySearchSelectedId],
  );

  const handleSearchFocus = useCallback(
    () => onSetShowEntitySuggestions(true),
    [onSetShowEntitySuggestions],
  );

  const handleSearchBlur = useCallback(
    () => setTimeout(() => onSetShowEntitySuggestions(false), 100),
    [onSetShowEntitySuggestions],
  );

  const handleSuggestionSelect = useCallback(
    (entity: EntityNavItem, e: React.MouseEvent) => {
      e.preventDefault();
      onSetEntitySearchQuery(entity.name || "");
      onSetEntitySearchSelectedId(entity.id);
      onSetShowEntitySuggestions(false);
    },
    [onSetEntitySearchQuery, onSetEntitySearchSelectedId, onSetShowEntitySuggestions],
  );

  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      )),
    [],
  );

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      )),
    [],
  );

  const focusOptions = useMemo(
    () =>
      FOCUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      )),
    [],
  );

  return (
    <div className="chron-filter-bar">
      <label className="chron-filter-bar-group-label">
        <input
          type="checkbox"
          checked={groupByType}
          onChange={(e) => onSetGroupByType(e.target.checked)}
        />
        Group by type
      </label>

      <div className="chron-filter-bar-field">
        <span className="chron-filter-bar-label">Sort:</span>
        <select
          className="illuminator-select chron-filter-bar-select chron-filter-bar-select-sort"
          value={sortMode}
          onChange={(e) => onSetSortMode(e.target.value)}
        >
          {sortOptions}
        </select>
      </div>

      <div className="chron-filter-bar-field">
        <span className="chron-filter-bar-label">Status:</span>
        <select
          className="illuminator-select chron-filter-bar-select chron-filter-bar-select-status"
          value={statusFilter}
          onChange={(e) => onSetStatusFilter(e.target.value)}
        >
          {statusOptions}
        </select>
      </div>

      <div className="chron-filter-bar-field">
        <span className="chron-filter-bar-label">Focus:</span>
        <select
          className="illuminator-select chron-filter-bar-select chron-filter-bar-select-focus"
          value={focusFilter}
          onChange={(e) => onSetFocusFilter(e.target.value)}
        >
          {focusOptions}
        </select>
      </div>

      <div className="chron-filter-bar-search">
        <input
          className="illuminator-input chron-filter-bar-search-input"
          placeholder="Search cast by entity..."
          value={entitySearchQuery}
          onChange={handleSearchChange}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
        />
        {showEntitySuggestions && entitySuggestions.length > 0 && (
          <div className="chron-filter-bar-suggestions">
            {entitySuggestions.map((entity) => (
              <div
                key={entity.id}
                role="option"
                aria-selected={false}
                tabIndex={0}
                onMouseDown={(e) => handleSuggestionSelect(entity, e)}
                className="chron-filter-bar-suggestion-item"
              >
                <span className="chron-filter-bar-suggestion-name">{entity.name}</span>
                <span className="chron-filter-bar-suggestion-kind">{entity.kind}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChronicleFilterBar;
