/**
 * TagSelector - Registry-aware tag selection component
 *
 * Features:
 * - Searchable dropdown with categorized tags
 * - Shows tag metadata (category, rarity)
 * - Visual badges for selected tags
 * - Warns about invalid tags not in registry
 * - Good keyboard navigation
 * - Option to add new tags to registry
 * - Single-select mode for choosing exactly one tag
 */

import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';

// Category colors matching the tag registry editor
const CATEGORY_COLORS = {
  status: { bg: 'rgba(34, 197, 94, 0.25)', border: 'rgba(34, 197, 94, 0.5)', text: '#86efac' },
  trait: { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgba(59, 130, 246, 0.5)', text: '#93c5fd' },
  affiliation: { bg: 'rgba(168, 85, 247, 0.25)', border: 'rgba(168, 85, 247, 0.5)', text: '#d8b4fe' },
  behavior: { bg: 'rgba(249, 115, 22, 0.25)', border: 'rgba(249, 115, 22, 0.5)', text: '#fdba74' },
  theme: { bg: 'rgba(236, 72, 153, 0.25)', border: 'rgba(236, 72, 153, 0.5)', text: '#f9a8d4' },
  location: { bg: 'rgba(20, 184, 166, 0.25)', border: 'rgba(20, 184, 166, 0.5)', text: '#5eead4' },
};

// Rarity indicators
const RARITY_DOTS = {
  common: { color: '#9ca3af', count: 1 },
  uncommon: { color: '#22c55e', count: 2 },
  rare: { color: '#3b82f6', count: 3 },
  legendary: { color: '#fbbf24', count: 4 },
};

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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hoveredInvalidTag, setHoveredInvalidTag] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const hoverTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Calculate dropdown position when opening
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Create a lookup map for quick tag validation
  const tagLookup = useMemo(() => {
    const lookup = {};
    tagRegistry.forEach(t => {
      lookup[t.tag] = t;
    });
    return lookup;
  }, [tagRegistry]);

  // Group tags by category for the dropdown
  const groupedTags = useMemo(() => {
    const groups = {};
    const filtered = tagRegistry.filter(t => {
      const matchesSearch = !searchQuery ||
        t.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const notSelected = !value.includes(t.tag);
      return matchesSearch && notSelected;
    });

    filtered.forEach(t => {
      if (!groups[t.category]) {
        groups[t.category] = [];
      }
      groups[t.category].push(t);
    });

    return groups;
  }, [tagRegistry, searchQuery, value]);

  // Check if search query could be a new tag (not in registry, not already selected)
  const canCreateTag = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const normalized = searchQuery.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!normalized) return false;
    if (tagLookup[normalized]) return false;
    if (value.includes(normalized)) return false;
    return normalized;
  }, [searchQuery, tagLookup, value]);

  // Flat list for keyboard navigation (includes "create new" option)
  const flatOptions = useMemo(() => {
    const result = [];
    Object.entries(groupedTags).forEach(([category, tags]) => {
      tags.forEach(t => result.push({ type: 'existing', ...t }));
    });
    if (canCreateTag) {
      result.push({ type: 'create', tag: canCreateTag });
    }
    return result;
  }, [groupedTags, canCreateTag]);

  // Check for invalid tags (selected but not in registry)
  const invalidTags = useMemo(() => {
    return value.filter(tag => !tagLookup[tag]);
  }, [value, tagLookup]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHoveredInvalidTag(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatOptions[highlightedIndex]) {
          const option = flatOptions[highlightedIndex];
          if (option.type === 'create') {
            handleCreateAndSelect(option.tag);
          } else {
            handleSelectTag(option.tag);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Backspace':
        if (searchQuery === '' && value.length > 0) {
          handleRemoveTag(value[value.length - 1]);
        }
        break;
    }
  };

  const handleSelectTag = (tag) => {
    if (singleSelect) {
      // In single-select mode, replace current selection
      onChange([tag]);
      setIsOpen(false);
    } else {
      // In multi-select mode, add to selection
      if (!value.includes(tag)) {
        onChange([...value, tag]);
      }
    }
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleCreateAndSelect = (tag) => {
    if (onAddToRegistry) {
      // Add to registry with defaults
      onAddToRegistry({
        tag,
        category: 'trait',
        rarity: 'common',
        description: '',
      });
    }
    // Select it (replace in single-select mode, add in multi-select)
    if (singleSelect) {
      onChange([tag]);
      setIsOpen(false);
    } else if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleAddInvalidToRegistry = (tag) => {
    if (onAddToRegistry) {
      onAddToRegistry({
        tag,
        category: 'trait',
        rarity: 'common',
        description: '',
      });
    }
    setHoveredInvalidTag(null);
  };

  const handleInvalidTagMouseEnter = (tag) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredInvalidTag(tag);
  };

  const handleInvalidTagMouseLeave = () => {
    // Delay hiding to allow mouse to reach the popup
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredInvalidTag(null);
    }, 150);
  };

  const handlePopupMouseEnter = () => {
    // Cancel the hide timeout when entering the popup
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handlePopupMouseLeave = () => {
    setHoveredInvalidTag(null);
  };

  const getCategoryStyle = (category) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.trait;
  };

  const renderRarityDots = (rarity) => {
    const config = RARITY_DOTS[rarity] || RARITY_DOTS.common;
    return (
      <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '4px' }}>
        {Array.from({ length: config.count }).map((_, i) => (
          <span
            key={i}
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: config.color
            }}
          />
        ))}
      </span>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Selected tags + input */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          padding: '6px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          border: isOpen ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
          minHeight: '36px',
          alignItems: 'center',
          cursor: 'text',
          transition: 'border-color 0.15s',
        }}
      >
        {value.map(tag => {
          const tagMeta = tagLookup[tag];
          const isInvalid = !tagMeta;
          const catStyle = tagMeta ? getCategoryStyle(tagMeta.category) : {
            bg: 'rgba(239, 68, 68, 0.25)',
            border: 'rgba(239, 68, 68, 0.5)',
            text: '#fca5a5'
          };

          return (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: catStyle.bg,
                border: `1px solid ${catStyle.border}`,
                borderRadius: '12px',
                fontSize: '0.75rem',
                color: catStyle.text,
                position: 'relative',
              }}
              title={isInvalid ? 'Tag not in registry - hover to add' : tagMeta?.description}
              onMouseEnter={() => isInvalid && onAddToRegistry && handleInvalidTagMouseEnter(tag)}
              onMouseLeave={() => isInvalid && handleInvalidTagMouseLeave()}
            >
              {isInvalid && <span style={{ color: '#fca5a5' }}>⚠</span>}
              {tag}
              {tagMeta?.isAxis && (
                <span style={{ color: '#22d3ee', fontSize: '0.7rem' }} title="Semantic plane axis label">↔</span>
              )}
              {tagMeta && renderRarityDots(tagMeta.rarity)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: catStyle.text,
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '0.85rem',
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                ×
              </button>
              {/* Hover menu for invalid tags */}
              {isInvalid && hoveredInvalidTag === tag && onAddToRegistry && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '4px',
                    background: '#0c1f2e',
                    border: '1px solid rgba(34, 197, 94, 0.5)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.7rem',
                    color: '#86efac',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    zIndex: 1001,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddInvalidToRegistry(tag);
                  }}
                  onMouseEnter={handlePopupMouseEnter}
                  onMouseLeave={handlePopupMouseLeave}
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: '80px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.8rem',
            color: 'var(--text-color)',
            padding: '2px',
          }}
        />
      </div>

      {/* Match All toggle */}
      {matchAllEnabled && value.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px',
          fontSize: '0.7rem',
          color: 'var(--arctic-frost)',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={matchAll}
              onChange={(e) => onMatchAllChange?.(e.target.checked)}
              style={{ width: '12px', height: '12px' }}
            />
            Match all tags (AND)
          </label>
          <span style={{ opacity: 0.6 }}>
            {matchAll ? 'Entity must have all tags' : 'Entity must have any tag'}
          </span>
        </div>
      )}

      {/* Dropdown - uses fixed positioning to escape overflow containers */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            background: '#0c1f2e',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '8px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 10000,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Create new tag option */}
          {canCreateTag && onAddToRegistry && (
            <div
              onClick={() => handleCreateAndSelect(canCreateTag)}
              onMouseEnter={() => setHighlightedIndex(flatOptions.length - 1)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: highlightedIndex === flatOptions.length - 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                borderLeft: highlightedIndex === flatOptions.length - 1 ? '3px solid #86efac' : '3px solid transparent',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: '#86efac', fontSize: '1rem' }}>+</span>
                <span style={{ color: '#86efac', fontSize: '0.8rem' }}>
                  Create "<strong>{canCreateTag}</strong>" and add to registry
                </span>
              </div>
            </div>
          )}

          {Object.keys(groupedTags).length === 0 && !canCreateTag ? (
            <div style={{
              padding: '12px 16px',
              color: 'var(--arctic-frost)',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}>
              {tagRegistry.length === 0
                ? 'No tags defined. Type to create a new tag.'
                : searchQuery
                  ? 'No matching tags. Press Enter to create.'
                  : 'All tags selected'}
            </div>
          ) : (
            Object.entries(groupedTags).map(([category, tags]) => (
              <div key={category}>
                <div style={{
                  padding: '6px 12px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: getCategoryStyle(category).text,
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                }}>
                  {category}
                </div>
                {tags.map((tag, idx) => {
                  const globalIdx = flatOptions.findIndex(o => o.type === 'existing' && o.tag === tag.tag);
                  const isHighlighted = globalIdx === highlightedIndex;

                  return (
                    <div
                      key={tag.tag}
                      onClick={() => handleSelectTag(tag.tag)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isHighlighted ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid var(--gold-accent)' : '3px solid transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'var(--text-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {tag.tag}
                          {tag.isAxis && (
                            <span style={{ color: '#22d3ee', fontSize: '0.7rem' }} title="Semantic plane axis label">↔</span>
                          )}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            padding: '1px 6px',
                            fontSize: '0.6rem',
                            background: getCategoryStyle(category).bg,
                            border: `1px solid ${getCategoryStyle(category).border}`,
                            borderRadius: '8px',
                            color: getCategoryStyle(category).text,
                          }}>
                            {tag.rarity}
                          </span>
                          {renderRarityDots(tag.rarity)}
                        </span>
                      </div>
                      {tag.description && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'var(--arctic-frost)',
                          marginTop: '2px',
                          opacity: 0.8,
                        }}>
                          {tag.description}
                        </div>
                      )}
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
