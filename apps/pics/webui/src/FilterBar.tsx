/**
 * FilterBar — Search, sort, and facet filters for the gallery.
 */

import type { FilterState, SortMode, ImageCatalog } from "./types";
import "./FilterBar.css";

interface FilterBarProps {
  filters: FilterState;
  catalog: ImageCatalog;
  resultCount: number;
  totalCount: number;
  onSearch: (q: string) => void;
  onSort: (s: SortMode) => void;
  onFilter: (key: keyof Omit<FilterState, "search" | "sort">, value: string | null) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      className="fb-select"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function FilterBar({
  filters,
  catalog,
  resultCount,
  totalCount,
  onSearch,
  onSort,
  onFilter,
  onClear,
  hasActiveFilters,
}: Readonly<FilterBarProps>) {
  return (
    <div className="fb">
      <div className="fb-row">
        <input
          className="fb-search"
          type="search"
          placeholder="Search title, entity, or tag..."
          value={filters.search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <select
          className="fb-select"
          value={filters.sort}
          onChange={(e) => onSort(e.target.value as SortMode)}
          aria-label="Sort by"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
        </select>
        <FacetSelect
          label="Type"
          value={filters.imageType}
          options={catalog.facets.imageTypes}
          onChange={(v) => onFilter("imageType", v)}
        />
        <FacetSelect
          label="Kind"
          value={filters.entityKind}
          options={catalog.facets.entityKinds}
          onChange={(v) => onFilter("entityKind", v)}
        />
        <FacetSelect
          label="Culture"
          value={filters.culture}
          options={catalog.facets.cultures}
          onChange={(v) => onFilter("culture", v)}
        />
        <FacetSelect
          label="Style"
          value={filters.artisticStyle}
          options={catalog.facets.artisticStyles}
          onChange={(v) => onFilter("artisticStyle", v)}
        />
        {hasActiveFilters && (
          <button className="fb-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="fb-count">
        {resultCount === totalCount
          ? `${totalCount} images`
          : `${resultCount} of ${totalCount} images`}
      </div>
    </div>
  );
}
