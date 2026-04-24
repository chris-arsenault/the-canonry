/**
 * FilterBar — Icon-triggered filter overlays with categorized option panels.
 *
 * Desktop: compact inline toolbar with azure accent.
 * Mobile: floating pill toggle, drawer flies out above it, 3 rows, 2x icons.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { FilterState, SortMode, ImageCatalog, FacetList, FacetEntry } from "./types";
import { normalizeFacets } from "./types";
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

type FilterKey = keyof Omit<FilterState, "search" | "sort">;

/* ── SVG Icons ─────────────────────────────────────────────────────────── */

const I = { w: 16, h: 16, vb: "0 0 24 24", sw: 1.8 } as const;
const ip = { width: I.w, height: I.h, viewBox: I.vb, fill: "none", stroke: "currentColor", strokeWidth: I.sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconBrush() {
  return <svg {...ip}><path d="M18 3l-3 3M14.5 5.5l3 3M4 20c1-1 2-2 3-2s2.5 1 3 0 0-2 1-3l6-6-3-3-6 6c-1 1-2 1.5-3 1s-1 2 0 3z" /></svg>;
}
function IconFrame() {
  return <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>;
}
function IconPalette() {
  return <svg {...ip}><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" /></svg>;
}
function IconImage() {
  return <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="2" /><path d="M21 15l-5-5L5 21" /></svg>;
}
function IconPerson() {
  return <svg {...ip}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0112 0v1" /></svg>;
}
function IconGlobe() {
  return <svg {...ip}><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8" /><path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></svg>;
}
function IconCpu() {
  return <svg {...ip}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></svg>;
}
function IconSearch() {
  return <svg {...ip}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>;
}
function IconFilter() {
  return <svg {...ip}><path d="M3 4h18M6 9h12M9 14h6M11 19h2" /></svg>;
}
function IconSort() {
  return <svg {...ip}><path d="M3 6h7M3 12h5M3 18h3" /><path d="M16 4v16M12 8l4-4 4 4M12 16l4 4 4-4" /></svg>;
}

/* ── Hoisted icon elements (avoids re-creating JSX on each render) ────── */

const ICON_BRUSH = <IconBrush />;
const ICON_FRAME = <IconFrame />;
const ICON_PALETTE = <IconPalette />;
const ICON_IMAGE = <IconImage />;
const ICON_PERSON = <IconPerson />;
const ICON_GLOBE = <IconGlobe />;
const ICON_CPU = <IconCpu />;

/* ── Group label formatting ────────────────────────────────────────────── */

const GROUP_LABELS: Record<string, string> = {
  painting: "Painting", "ink-print": "Ink & Print", digital: "Digital",
  camera: "Camera", experimental: "Experimental", document: "Document",
  character: "Character", pair: "Pair", pose: "Pose", collective: "Collective",
  place: "Place", landscape: "Landscape", object: "Object", concept: "Concept",
  event: "Event", general: "General",
  hue: "Hue", special: "Special", natural: "Natural", mood: "Mood",
  metallic: "Metallic", "contrast-pair": "Contrast Pair", "metallic-triplet": "Metallic Triplet",
  other: "Other",
};

function groupLabel(g: string): string {
  return GROUP_LABELS[g] || g.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Click-outside hook ────────────────────────────────────────────────── */

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}

/* ── Popover Panel ─────────────────────────────────────────────────────── */

function buildGroups(facets: FacetEntry[]): { key: string; label: string; items: FacetEntry[] }[] {
  const groups: { key: string; label: string; items: FacetEntry[] }[] = [];
  const seen = new Map<string, FacetEntry[]>();
  for (const f of facets) {
    const g = f.group || "other";
    if (!seen.has(g)) {
      const items: FacetEntry[] = [];
      seen.set(g, items);
      groups.push({ key: g, label: groupLabel(g), items });
    }
    seen.get(g)!.push(f);
  }
  return groups;
}

function findGroupForValue(groups: { key: string; items: FacetEntry[] }[], value: string | null): string | null {
  if (!value) return null;
  for (const g of groups) {
    if (g.items.some((f) => f.id === value)) return g.key;
  }
  return null;
}

function FilterPopover({
  facets, value, onSelect, onClose,
}: Readonly<{
  facets: FacetEntry[];
  value: string | null;
  onSelect: (v: string | null) => void;
  onClose: () => void;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const hasGroups = facets.some((f) => f.group);
  const groups = hasGroups ? buildGroups(facets) : [];
  const [activeTab, setActiveTab] = useState<string>(
    () => findGroupForValue(groups, value) || groups[0]?.key || "",
  );

  const activeGroup = groups.find((g) => g.key === activeTab);

  const handleClick = useCallback((id: string) => {
    onSelect(id === value ? null : id);
    onClose();
  }, [value, onSelect, onClose]);

  const handleClear = useCallback(() => { onSelect(null); onClose(); }, [onSelect, onClose]);

  return (
    <div className={`fp ${hasGroups ? "fp--tabbed" : ""}`} ref={ref}>
      {value && <button className="fp-clear" onClick={handleClear}>Clear</button>}
      {hasGroups ? (
        <>
          <div className="fp-tabs">
            {groups.map((g) => (
              <button key={g.key} className={`fp-tab ${g.key === activeTab ? "fp-tab--active" : ""}`} onClick={() => setActiveTab(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="fp-grid">
            {activeGroup?.items.map((f) => (
              <button key={f.id} className={`fp-item ${f.id === value ? "fp-item--active" : ""}`} onClick={() => handleClick(f.id)}>
                {f.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="fp-list">
          {facets.map((f) => (
            <button key={f.id} className={`fp-item ${f.id === value ? "fp-item--active" : ""}`} onClick={() => handleClick(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sort Trigger (custom dropdown) ────────────────────────────────────── */

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title" },
];

function SortTrigger({
  value, onChange, openId, onToggle,
}: Readonly<{
  value: SortMode;
  onChange: (s: SortMode) => void;
  openId: string | null;
  onToggle: (id: string | null) => void;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = openId === "_sort";
  const label = SORT_OPTIONS.find((o) => o.value === value)?.label || "Sort";

  const handleClose = useCallback(() => onToggle(null), [onToggle]);
  useClickOutside(ref, isOpen ? handleClose : () => {});

  const handleToggle = useCallback(() => { onToggle(isOpen ? null : "_sort"); }, [isOpen, onToggle]);

  const handleSelect = useCallback((s: SortMode) => { onChange(s); onToggle(null); }, [onChange, onToggle]);

  return (
    <div className="ft-wrap" ref={ref}>
      <button
        className={`ft-btn ft-btn--tool ${isOpen ? "ft-btn--open" : ""}`}
        onClick={handleToggle}
        title={`Sort: ${label}`}
        aria-label="Sort"
      >
        <IconSort />
        <span className="ft-sort-label">{label}</span>
      </button>
      {isOpen && (
        <div className="fp">
          <div className="fp-list">
            {SORT_OPTIONS.map((o) => (
              <button key={o.value} className={`fp-item ${o.value === value ? "fp-item--active" : ""}`} onClick={() => handleSelect(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Filter Trigger Button ─────────────────────────────────────────────── */

function FilterTrigger({
  icon, label, value, facets: rawFacets, tier, filterKey, onFilter, openId, onToggle,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string | null;
  facets: FacetList;
  tier: "primary" | "secondary";
  filterKey: FilterKey;
  onFilter: (key: FilterKey, value: string | null) => void;
  openId: string | null;
  onToggle: (id: string | null) => void;
}>) {
  const facets = normalizeFacets(rawFacets);

  const isOpen = openId === filterKey;
  const selectedName = value ? facets.find((f) => f.id === value)?.name : null;

  const handleToggle = useCallback(() => { onToggle(isOpen ? null : filterKey); }, [isOpen, filterKey, onToggle]);
  const handleSelect = useCallback((v: string | null) => { onFilter(filterKey, v); }, [filterKey, onFilter]);
  const handleClose = useCallback(() => { onToggle(null); }, [onToggle]);

  if (facets.length === 0) return null;

  return (
    <div className="ft-wrap">
      <button
        className={`ft-btn ft-btn--${tier} ${value ? "ft-btn--active" : ""} ${isOpen ? "ft-btn--open" : ""}`}
        onClick={handleToggle}
        title={selectedName ? `${label}: ${selectedName}` : label}
        aria-label={label}
      >
        {icon}
        <span className="ft-label">{label}</span>
        {selectedName && <span className="ft-selected">{selectedName}</span>}
      </button>
      {isOpen && <FilterPopover facets={facets} value={value} onSelect={handleSelect} onClose={handleClose} />}
    </div>
  );
}

/* ── Drawer Content ────────────────────────────────────────────────────── */

interface SearchHandlers {
  open: boolean;
  onToggle: () => void;
  onBlur: () => void;
  onChange: (q: string) => void;
}

interface DrawerProps {
  filters: FilterState;
  catalog: ImageCatalog;
  openFilter: string | null;
  search: SearchHandlers;
  searchRef: React.RefObject<HTMLInputElement | null>;
  countText: string;
  hasActiveFilters: boolean;
  onToggle: (id: string | null) => void;
  onSort: (s: SortMode) => void;
  onFilter: (key: FilterKey, value: string | null) => void;
  onClear: () => void;
}

function DrawerContent({
  filters, catalog, openFilter, search, searchRef, countText,
  hasActiveFilters, onToggle, onSort, onFilter, onClear,
}: Readonly<DrawerProps>) {
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { search.onChange(e.target.value); }, [search]);

  return (
    <>
      <div className="fb-row fb-row--tools">
        <div className="fb-search-area">
          <button
            className={`ft-btn ft-btn--tool ${search.open || filters.search ? "ft-btn--active" : ""}`}
            onClick={search.onToggle} title="Search" aria-label="Search"
          >
            <IconSearch />
          </button>
          {search.open && (
            <input ref={searchRef} className="fb-search" type="search" placeholder="Search..."
              value={filters.search} onChange={handleSearchChange} onBlur={search.onBlur} />
          )}
        </div>
        <SortTrigger value={filters.sort} onChange={onSort} openId={openFilter} onToggle={onToggle} />
        <span className="fb-count">{countText}</span>
        {hasActiveFilters && (
          <button className="fb-clear" onClick={onClear} title="Clear all filters">&times;</button>
        )}
      </div>

      <div className="fb-row fb-row--primary">
        <FilterTrigger icon={ICON_BRUSH} label="Style" value={filters.artisticStyle}
          facets={catalog.facets.artisticStyles} tier="primary" filterKey="artisticStyle"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
        <FilterTrigger icon={ICON_FRAME} label="Comp" value={filters.compositionStyle}
          facets={catalog.facets.compositionStyles} tier="primary" filterKey="compositionStyle"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
        <FilterTrigger icon={ICON_PALETTE} label="Palette" value={filters.colorPalette}
          facets={catalog.facets.colorPalettes} tier="primary" filterKey="colorPalette"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
      </div>

      <div className="fb-row fb-row--secondary">
        <FilterTrigger icon={ICON_IMAGE} label="Type" value={filters.imageType}
          facets={catalog.facets.imageTypes} tier="secondary" filterKey="imageType"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
        <FilterTrigger icon={ICON_PERSON} label="Kind" value={filters.entityKind}
          facets={catalog.facets.entityKinds} tier="secondary" filterKey="entityKind"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
        <FilterTrigger icon={ICON_GLOBE} label="Culture" value={filters.culture}
          facets={catalog.facets.cultures} tier="secondary" filterKey="culture"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
        <FilterTrigger icon={ICON_CPU} label="Model" value={filters.model}
          facets={catalog.facets.models} tier="secondary" filterKey="model"
          onFilter={onFilter} openId={openFilter} onToggle={onToggle} />
      </div>
    </>
  );
}

/* ── Main FilterBar ────────────────────────────────────────────────────── */

export default function FilterBar({
  filters, catalog, resultCount, totalCount,
  onSearch, onSort, onFilter, onClear, hasActiveFilters,
}: Readonly<FilterBarProps>) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(filters.search !== "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleToggle = useCallback((id: string | null) => { setOpenFilter(id); }, []);

  const handleSearchToggle = useCallback(() => {
    setSearchOpen((v) => {
      if (!v) setTimeout(() => searchRef.current?.focus(), 0);
      return !v;
    });
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (!filters.search) setSearchOpen(false);
  }, [filters.search]);

  const handleDrawerToggle = useCallback(() => { setDrawerOpen((v) => !v); }, []);

  const countText = resultCount === totalCount ? `${totalCount}` : `${resultCount} / ${totalCount}`;

  const searchState: SearchHandlers = useMemo(() => ({
    open: searchOpen,
    onToggle: handleSearchToggle, onBlur: handleSearchBlur, onChange: onSearch,
  }), [searchOpen, handleSearchToggle, handleSearchBlur, onSearch]);

  const activeCount = [
    filters.artisticStyle, filters.compositionStyle, filters.colorPalette,
    filters.imageType, filters.entityKind, filters.culture, filters.model,
  ].filter(Boolean).length + (filters.search ? 1 : 0);

  return (
    <div className={`fb ${drawerOpen ? "fb--open" : ""}`}>
      <div className="fb-drawer">
        <DrawerContent
          filters={filters} catalog={catalog} openFilter={openFilter}
          search={searchState} searchRef={searchRef} countText={countText}
          hasActiveFilters={hasActiveFilters} onToggle={handleToggle}
          onSort={onSort} onFilter={onFilter} onClear={onClear}
        />
      </div>
      <button className="fb-handle" onClick={handleDrawerToggle} aria-label="Toggle filters">
        <IconFilter />
        <span className="fb-handle-label">Filters</span>
        {activeCount > 0 && <span className="fb-handle-badge">{activeCount}</span>}
        <span className="fb-handle-count">{countText}</span>
      </button>
    </div>
  );
}
