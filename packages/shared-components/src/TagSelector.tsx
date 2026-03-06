/**
 * TagSelector - Registry-aware tag selection component
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import './TagSelector.css';
import type { Optional } from './types/optionality.js';

interface TagDefinition {
  tag: string;
  category: string;
  rarity: string;
  description: Optional<string>;
  isAxis: Optional<boolean>;
}

interface TagSelectorProps {
  readonly value: Optional<string[]>;
  readonly onChange: (value: string[]) => void;
  readonly tagRegistry: Optional<TagDefinition[]>;
  readonly onAddToRegistry: Optional<(tagDef: TagDefinition) => void>;
  readonly placeholder: Optional<string>;
  readonly matchAllEnabled: Optional<boolean>;
  readonly matchAll: Optional<boolean>;
  readonly onMatchAllChange: Optional<(value: boolean) => void>;
  readonly singleSelect: Optional<boolean>;
}

const CATEGORY_CLASS: Record<string, string> = {
  status: 'tag-selector-category-status',
  trait: 'tag-selector-category-trait',
  affiliation: 'tag-selector-category-affiliation',
  behavior: 'tag-selector-category-behavior',
  theme: 'tag-selector-category-theme',
  location: 'tag-selector-category-location',
};

const RARITY_DOTS: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 4,
};

function getCategoryClass(category: string): string {
  return CATEGORY_CLASS[category] || CATEGORY_CLASS.trait;
}

function getRarityClass(rarity: string): string {
  return `tag-selector-rarity-dot-${rarity || 'common'}`;
}

function RarityDots({ rarity }: { readonly rarity: string }) {
  const count = RARITY_DOTS[rarity] || RARITY_DOTS.common;
  return (
    <span className="tag-selector-rarity-dots">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className={`tag-selector-rarity-dot ${getRarityClass(rarity)}`} />
      ))}
    </span>
  );
}

interface TagChipProps {
  readonly tag: string;
  readonly tagMeta: Optional<TagDefinition>;
  readonly hoveredInvalidTag: string | null;
  readonly onAddToRegistry: Optional<(tagDef: TagDefinition) => void>;
  readonly onRemove: (tag: string) => void;
  readonly onInvalidMouseEnter: (tag: string) => void;
  readonly onInvalidMouseLeave: () => void;
  readonly onPopupMouseEnter: () => void;
}

function InvalidTagPopup({ tag, onAdd, onMouseEnter, onMouseLeave }: {
  readonly tag: string;
  readonly onAdd: (tagDef: TagDefinition) => void;
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
}) {
  return (
    <div
      className="tag-selector-invalid-popup"
      onClick={(event) => { event.stopPropagation(); onAdd({ tag, category: 'trait', rarity: 'common', description: '' }); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click(); }}
    >
      + Add to registry
    </div>
  );
}

function TagChipContent({ tagMeta }: { readonly tagMeta: TagDefinition }) {
  return (
    <>
      {tagMeta.isAxis && <span title="Semantic plane axis label" className="tag-selector-axis-indicator">↔</span>}
      <RarityDots rarity={tagMeta.rarity} />
    </>
  );
}

function TagChip({
  tag, tagMeta, hoveredInvalidTag, onAddToRegistry,
  onRemove, onInvalidMouseEnter, onInvalidMouseLeave, onPopupMouseEnter,
}: TagChipProps) {
  const isInvalid = !tagMeta;
  const categoryClass = isInvalid ? 'tag-selector-category-invalid' : getCategoryClass(tagMeta.category);
  const showPopup = isInvalid && hoveredInvalidTag === tag && onAddToRegistry;

  return (
    <span className={`tag-selector-chip ${categoryClass}`}
      title={isInvalid ? 'Tag not in registry - hover to add' : tagMeta?.description}
      onMouseEnter={() => isInvalid && onAddToRegistry && onInvalidMouseEnter(tag)}
      onMouseLeave={() => isInvalid && onInvalidMouseLeave()}
    >
      {isInvalid && <span className="tag-selector-invalid-warning">⚠</span>}
      {tag}
      {tagMeta && <TagChipContent tagMeta={tagMeta} />}
      <button type="button" className="tag-selector-remove-button"
        onClick={(event) => { event.stopPropagation(); onRemove(tag); }}>×</button>
      {showPopup && <InvalidTagPopup tag={tag} onAdd={onAddToRegistry} onMouseEnter={onPopupMouseEnter} onMouseLeave={onInvalidMouseLeave} />}
    </span>
  );
}

interface FlatOption {
  type: string;
  tag: string;
  [key: string]: unknown;
}

interface TagDropdownProps {
  readonly groupedTags: Record<string, TagDefinition[]>;
  readonly flatOptions: FlatOption[];
  readonly highlightedIndex: number;
  readonly canCreateTag: string | false;
  readonly tagRegistry: TagDefinition[];
  readonly searchQuery: string;
  readonly onAddToRegistry: Optional<(tagDef: TagDefinition) => void>;
  readonly onSelectTag: (tag: string) => void;
  readonly onCreateAndSelect: (tag: string) => void;
  readonly onHighlight: (index: number) => void;
}

function TagDropdown({
  groupedTags, flatOptions, highlightedIndex, canCreateTag,
  tagRegistry, searchQuery, onAddToRegistry,
  onSelectTag, onCreateAndSelect, onHighlight,
}: TagDropdownProps) {
  return (
    <div className="tag-selector-dropdown">
      {canCreateTag && onAddToRegistry && (
        <div
          className={`tag-selector-create-option ${highlightedIndex === flatOptions.length - 1 ? 'tag-selector-create-option-highlighted' : ''}`}
          onClick={() => onCreateAndSelect(canCreateTag)}
          onMouseEnter={() => onHighlight(flatOptions.length - 1)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click(); }}
        >
          <div className="tag-selector-create-row">
            <span className="tag-selector-create-icon">+</span>
            <span className="tag-selector-create-label">
              Create &quot;<strong>{canCreateTag}</strong>&quot; and add to registry
            </span>
          </div>
        </div>
      )}

      {Object.keys(groupedTags).length === 0 && !canCreateTag ? (
        <div className="tag-selector-empty-dropdown">
          {(() => {
            if (tagRegistry.length === 0) return 'No tags defined. Type to create a new tag.';
            if (searchQuery) return 'No matching tags. Press Enter to create.';
            return 'All tags selected';
          })()}
        </div>
      ) : (
        Object.entries(groupedTags).map(([category, tags]) => (
          <div key={category}>
            <div className={`tag-selector-category-header ${getCategoryClass(category)}`}>{category}</div>
            {tags.map((tag) => {
              const globalIdx = flatOptions.findIndex((option) => option.type === 'existing' && option.tag === tag.tag);
              const isHighlighted = globalIdx === highlightedIndex;
              return (
                <div
                  key={tag.tag}
                  className={`tag-selector-option ${isHighlighted ? 'tag-selector-option-highlighted' : ''}`}
                  onClick={() => onSelectTag(tag.tag)}
                  onMouseEnter={() => onHighlight(globalIdx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click(); }}
                >
                  <div className="tag-selector-option-row">
                    <span className="tag-selector-option-name">
                      {tag.tag}
                      {tag.isAxis && <span title="Semantic plane axis label" className="tag-selector-axis-indicator">↔</span>}
                    </span>
                    <span className="tag-selector-option-meta">
                      <span className={`tag-selector-rarity-pill ${getCategoryClass(category)}`}>{tag.rarity}</span>
                      <RarityDots rarity={tag.rarity} />
                    </span>
                  </div>
                  {tag.description && <div className="tag-selector-option-description">{tag.description}</div>}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function MatchAllToggle({ matchAll, onMatchAllChange }: {
  readonly matchAll: boolean;
  readonly onMatchAllChange: Optional<(value: boolean) => void>;
}) {
  return (
    <div className="tag-selector-match-all">
      <label className="tag-selector-match-all-label">
        <input type="checkbox" className="tag-selector-match-all-checkbox"
          checked={matchAll} onChange={(event) => onMatchAllChange?.(event.target.checked)} />
        Match all tags (AND)
      </label>
      <span className="tag-selector-match-all-hint">
        {matchAll ? 'Entity must have all tags' : 'Entity must have any tag'}
      </span>
    </div>
  );
}

function useTagSelectorData(tagRegistry: TagDefinition[], searchQuery: string, value: string[]) {
  const tagLookup = useMemo(() => {
    const lookup: Record<string, TagDefinition> = {};
    tagRegistry.forEach((tagDef) => { lookup[tagDef.tag] = tagDef; });
    return lookup;
  }, [tagRegistry]);

  const groupedTags = useMemo(() => {
    const groups: Record<string, TagDefinition[]> = {};
    const normalizedQuery = searchQuery.toLowerCase();
    tagRegistry.filter((tagDef) => {
      const matchesSearch = !searchQuery || tagDef.tag.toLowerCase().includes(normalizedQuery)
        || tagDef.description?.toLowerCase().includes(normalizedQuery);
      return matchesSearch && !value.includes(tagDef.tag);
    }).forEach((tagDef) => {
      if (!groups[tagDef.category]) groups[tagDef.category] = [];
      groups[tagDef.category].push(tagDef);
    });
    return groups;
  }, [searchQuery, tagRegistry, value]);

  // eslint-disable-next-line sonarjs/function-return-type -- returns string or false discriminant by design
  const canCreateTag = useMemo<string | false>((): string | false => {
    if (!searchQuery.trim()) return false;
    const normalized = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!normalized || tagLookup[normalized] || value.includes(normalized)) return false;
    return normalized;
  }, [searchQuery, tagLookup, value]);

  const flatOptions = useMemo<FlatOption[]>(() => {
    const result: FlatOption[] = [];
    Object.entries(groupedTags).forEach(([_category, tags]) => {
      tags.forEach((tagDef) => result.push({ type: 'existing', ...tagDef }));
    });
    if (canCreateTag) result.push({ type: 'create', tag: canCreateTag });
    return result;
  }, [groupedTags, canCreateTag]);

  return { tagLookup, groupedTags, canCreateTag, flatOptions };
}

function useClickOutside(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClickOutside: () => void,
) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) onClickOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [containerRef, onClickOutside]);
}

const EMPTY_VALUE: string[] = [];
const EMPTY_REGISTRY: TagDefinition[] = [];

function useHoverTimeout() {
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredInvalidTag, setHoveredInvalidTag] = useState<string | null>(null);
  const clear = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
  }, []);
  const enter = useCallback((tag: string) => { clear(); setHoveredInvalidTag(tag); }, [clear]);
  const leave = useCallback(() => { hoverTimeoutRef.current = setTimeout(() => setHoveredInvalidTag(null), 150); }, []);
  return { hoveredInvalidTag, clear, enter, leave };
}

/* eslint-disable max-lines-per-function, complexity -- interactive selector with keyboard nav, search, single/multi
   selection, and hover tooltips; state management cannot be split without scattering tightly coupled transitions */
export default function TagSelector({
  value = EMPTY_VALUE,
  onChange,
  tagRegistry = EMPTY_REGISTRY,
  onAddToRegistry,
  placeholder = 'Select tags...',
  matchAllEnabled = false,
  matchAll = false,
  onMatchAllChange,
  singleSelect = false,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hover = useHoverTimeout();

  const { tagLookup, groupedTags, canCreateTag, flatOptions } = useTagSelectorData(tagRegistry, searchQuery, value);

  const closeAll = useCallback(() => { setIsOpen(false); hover.clear(); }, [hover]);
  useClickOutside(containerRef, closeAll);

  const selectTag = useCallback((tag: string) => {
    if (singleSelect) { onChange([tag]); setIsOpen(false); }
    else if (!value.includes(tag)) { onChange([...value, tag]); }
    setSearchQuery('');
    inputRef.current?.focus();
  }, [singleSelect, onChange, value]);

  const createAndSelect = useCallback((tag: string) => {
    if (onAddToRegistry) onAddToRegistry({ tag, category: 'trait', rarity: 'common', description: '' });
    selectTag(tag);
  }, [onAddToRegistry, selectTag]);

  const removeTag = useCallback((tag: string) => onChange(value.filter((item) => item !== tag)), [onChange, value]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); setIsOpen(true); }
      return;
    }
    const opt = flatOptions[highlightedIndex];
    const keyActions: Partial<Record<string, () => void>> = {
      ArrowDown: () => setHighlightedIndex((i) => Math.min(i + 1, flatOptions.length - 1)),
      ArrowUp: () => setHighlightedIndex((i) => Math.max(i - 1, 0)),
      Enter: opt ? () => (opt.type === 'create' ? createAndSelect : selectTag)(opt.tag) : undefined,
      Escape: () => setIsOpen(false),
      Backspace: searchQuery === '' && value.length > 0 ? () => removeTag(value[value.length - 1]) : undefined,
    };
    const action = keyActions[event.key];
    if (action) { event.preventDefault(); action(); }
  }, [isOpen, flatOptions, highlightedIndex, searchQuery, value, createAndSelect, selectTag, removeTag]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value); setHighlightedIndex(0);
  }, []);
  const openDropdown = useCallback(() => setIsOpen(true), []);
  const focusAndOpen = useCallback(() => { setIsOpen(true); inputRef.current?.focus(); }, []);

  return (
    <div ref={containerRef} className="tag-selector">
      <div className={`tag-selector-input-wrapper ${isOpen ? 'tag-selector-input-wrapper-open' : 'tag-selector-input-wrapper-closed'}`}
        onClick={focusAndOpen} role="button" tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click(); }}
      >
        {value.map((tag) => (
          <TagChip key={tag} tag={tag} tagMeta={tagLookup[tag]} hoveredInvalidTag={hover.hoveredInvalidTag}
            onAddToRegistry={onAddToRegistry} onRemove={removeTag}
            onInvalidMouseEnter={hover.enter} onInvalidMouseLeave={hover.leave}
            onPopupMouseEnter={hover.clear} />
        ))}
        <input ref={inputRef} type="text" className="tag-selector-search-input" value={searchQuery}
          onChange={handleSearchChange} onKeyDown={handleKeyDown} onFocus={openDropdown}
          placeholder={value.length === 0 ? placeholder : ''} />
      </div>
      {matchAllEnabled && value.length > 1 && <MatchAllToggle matchAll={matchAll} onMatchAllChange={onMatchAllChange} />}
      {isOpen && (
        <TagDropdown groupedTags={groupedTags} flatOptions={flatOptions} highlightedIndex={highlightedIndex}
          canCreateTag={canCreateTag} tagRegistry={tagRegistry} searchQuery={searchQuery}
          onAddToRegistry={onAddToRegistry} onSelectTag={selectTag} onCreateAndSelect={createAndSelect}
          onHighlight={setHighlightedIndex} />
      )}
    </div>
  );
}
