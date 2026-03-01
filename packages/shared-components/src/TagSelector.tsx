/**
 * TagSelector - Registry-aware tag selection component
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import './TagSelector.css';

interface TagDefinition {
  tag: string;
  category: string;
  rarity: string;
  description?: string;
  isAxis?: boolean;
}

interface TagSelectorProps {
  readonly value?: string[];
  readonly onChange: (value: string[]) => void;
  readonly tagRegistry?: TagDefinition[];
  readonly onAddToRegistry?: (tagDef: TagDefinition) => void;
  readonly placeholder?: string;
  readonly matchAllEnabled?: boolean;
  readonly matchAll?: boolean;
  readonly onMatchAllChange?: (value: boolean) => void;
  readonly singleSelect?: boolean;
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

export default function TagSelector({
  value = [],
  onChange,
  tagRegistry = [],
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
  const [hoveredInvalidTag, setHoveredInvalidTag] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagLookup = useMemo(() => {
    const lookup: Record<string, TagDefinition> = {};
    tagRegistry.forEach((tagDef) => {
      lookup[tagDef.tag] = tagDef;
    });
    return lookup;
  }, [tagRegistry]);

  const groupedTags = useMemo(() => {
    const groups: Record<string, TagDefinition[]> = {};
    const filtered = tagRegistry.filter((tagDef) => {
      const normalizedQuery = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        tagDef.tag.toLowerCase().includes(normalizedQuery) ||
        tagDef.description?.toLowerCase().includes(normalizedQuery);
      return matchesSearch && !value.includes(tagDef.tag);
    });

    filtered.forEach((tagDef) => {
      if (!groups[tagDef.category]) {
        groups[tagDef.category] = [];
      }
      groups[tagDef.category].push(tagDef);
    });

    return groups;
  }, [searchQuery, tagRegistry, value]);

  const canCreateTag = useMemo<string | false>((): string | false => {
    if (!searchQuery.trim()) return false;
    const normalized = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!normalized) return false;
    if (tagLookup[normalized]) return false;
    if (value.includes(normalized)) return false;
    return normalized;
  }, [searchQuery, tagLookup, value]);

  const flatOptions = useMemo(() => {
    const result: Array<{ type: string; tag: string; [key: string]: unknown }> = [];
    Object.entries(groupedTags).forEach(([_category, tags]) => {
      tags.forEach((tagDef) => result.push({ type: 'existing', ...tagDef }));
    });
    if (canCreateTag) {
      result.push({ type: 'create', tag: canCreateTag });
    }
    return result;
  }, [groupedTags, canCreateTag]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHoveredInvalidTag(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (!flatOptions[highlightedIndex]) return;
        if (flatOptions[highlightedIndex].type === 'create') {
          handleCreateAndSelect(flatOptions[highlightedIndex].tag);
        } else {
          handleSelectTag(flatOptions[highlightedIndex].tag);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
      case 'Backspace':
        if (searchQuery === '' && value.length > 0) {
          handleRemoveTag(value[value.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  const handleSelectTag = (tag: string) => {
    if (singleSelect) {
      onChange([tag]);
      setIsOpen(false);
    } else if (!value.includes(tag)) {
      onChange([...value, tag]);
    }

    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  const handleCreateAndSelect = (tag: string) => {
    if (onAddToRegistry) {
      onAddToRegistry({ tag, category: 'trait', rarity: 'common', description: '' });
    }

    if (singleSelect) {
      onChange([tag]);
      setIsOpen(false);
    } else if (!value.includes(tag)) {
      onChange([...value, tag]);
    }

    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleInvalidTagMouseEnter = (tag: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredInvalidTag(tag);
  };

  const handleInvalidTagMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredInvalidTag(null);
    }, 150);
  };

  const handlePopupMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const renderRarityDots = (rarity: string) => {
    const count = RARITY_DOTS[rarity] || RARITY_DOTS.common;
    return (
      <span className="tag-selector-rarity-dots">
        {Array.from({ length: count }).map((_, index) => (
          <span key={index} className={`tag-selector-rarity-dot ${getRarityClass(rarity)}`} />
        ))}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="tag-selector">
      <div
        className={`tag-selector-input-wrapper ${isOpen ? 'tag-selector-input-wrapper-open' : 'tag-selector-input-wrapper-closed'}`}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.currentTarget.click();
          }
        }}
      >
        {value.map((tag) => {
          const tagMeta = tagLookup[tag];
          const isInvalid = !tagMeta;
          const categoryClass = isInvalid ? 'tag-selector-category-invalid' : getCategoryClass(tagMeta.category);

          return (
            <span
              key={tag}
              className={`tag-selector-chip ${categoryClass}`}
              title={isInvalid ? 'Tag not in registry - hover to add' : tagMeta?.description}
              onMouseEnter={() => isInvalid && onAddToRegistry && handleInvalidTagMouseEnter(tag)}
              onMouseLeave={() => isInvalid && handleInvalidTagMouseLeave()}
            >
              {isInvalid && <span className="tag-selector-invalid-warning">⚠</span>}
              {tag}
              {tagMeta?.isAxis && <span title="Semantic plane axis label" className="tag-selector-axis-indicator">↔</span>}
              {tagMeta && renderRarityDots(tagMeta.rarity)}
              <button
                type="button"
                className="tag-selector-remove-button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveTag(tag);
                }}
              >
                ×
              </button>
              {isInvalid && hoveredInvalidTag === tag && onAddToRegistry && (
                <div
                  className="tag-selector-invalid-popup"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddToRegistry({ tag, category: 'trait', rarity: 'common', description: '' });
                    setHoveredInvalidTag(null);
                  }}
                  onMouseEnter={handlePopupMouseEnter}
                  onMouseLeave={() => setHoveredInvalidTag(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.currentTarget.click();
                    }
                  }}
                >
                  + Add to registry
                </div>
              )}
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          className="tag-selector-search-input"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={value.length === 0 ? placeholder : ''}
        />
      </div>

      {matchAllEnabled && value.length > 1 && (
        <div className="tag-selector-match-all">
          <label className="tag-selector-match-all-label">
            <input
              type="checkbox"
              className="tag-selector-match-all-checkbox"
              checked={matchAll}
              onChange={(event) => onMatchAllChange?.(event.target.checked)}
            />
            Match all tags (AND)
          </label>
          <span className="tag-selector-match-all-hint">
            {matchAll ? 'Entity must have all tags' : 'Entity must have any tag'}
          </span>
        </div>
      )}

      {isOpen && (
        <div className="tag-selector-dropdown">
          {canCreateTag && onAddToRegistry && (
            <div
              className={`tag-selector-create-option ${highlightedIndex === flatOptions.length - 1 ? 'tag-selector-create-option-highlighted' : ''}`}
              onClick={() => handleCreateAndSelect(canCreateTag)}
              onMouseEnter={() => setHighlightedIndex(flatOptions.length - 1)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.currentTarget.click();
                }
              }}
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
                      onClick={() => handleSelectTag(tag.tag)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.currentTarget.click();
                        }
                      }}
                    >
                      <div className="tag-selector-option-row">
                        <span className="tag-selector-option-name">
                          {tag.tag}
                          {tag.isAxis && <span title="Semantic plane axis label" className="tag-selector-axis-indicator">↔</span>}
                        </span>
                        <span className="tag-selector-option-meta">
                          <span className={`tag-selector-rarity-pill ${getCategoryClass(category)}`}>{tag.rarity}</span>
                          {renderRarityDots(tag.rarity)}
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
      )}
    </div>
  );
}