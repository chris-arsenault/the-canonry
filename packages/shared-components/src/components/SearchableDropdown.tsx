/**
 * SearchableDropdown - Popover dropdown with search filtering
 *
 * Used for selecting from a list of items with search capability.
 * More user-friendly than native select for large lists.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

interface SearchableDropdownItem {
  id: string;
  name?: string;
}

interface SearchableDropdownProps {
  readonly items: SearchableDropdownItem[];
  readonly onSelect: (id: string) => void;
  readonly placeholder?: string;
  readonly emptyMessage?: string;
  readonly noMatchMessage?: string;
  readonly searchable?: boolean;
  readonly className?: string;
}

/**
 * @param {Object} props
 * @param {Array<{id: string, name?: string}>} props.items - Items to select from
 * @param {Function} props.onSelect - Called with item ID when selected
 * @param {string} [props.placeholder] - Placeholder text for trigger
 * @param {string} [props.emptyMessage] - Message when no items available
 * @param {string} [props.noMatchMessage] - Message when search has no matches
 * @param {boolean} [props.searchable] - Whether to show search input (default true)
 * @param {string} [props.className] - Additional class names
 */
export function SearchableDropdown({
  items,
  onSelect,
  placeholder = 'Select...',
  emptyMessage = 'No items available',
  noMatchMessage = 'No matches found',
  searchable = true,
  className = '',
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter(item =>
      item.id.toLowerCase().includes(lower) ||
      item.name?.toLowerCase().includes(lower)
    );
  }, [items, search]);

  const handleSelect = (item) => {
    onSelect(item.id);
    setIsOpen(false);
    setSearch('');
  };

  if (items.length === 0) {
    return (
      <div className={`dropdown-trigger dropdown-trigger-disabled ${className}`.trim()}>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`dropdown ${className}`.trim()}>
      <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
        <span>{placeholder}</span>
        <span className="dropdown-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="dropdown-menu">
          {searchable && (
            <div className="dropdown-search">
              <input
                type="text"
                className="dropdown-search-input"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>
          )}
          <div className="dropdown-options">
            {filteredItems.length === 0 ? (
              <div className="dropdown-empty">{noMatchMessage}</div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="dropdown-option"
                  onClick={() => handleSelect(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  {item.name || item.id}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
