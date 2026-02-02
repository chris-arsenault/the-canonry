/**
 * ReferenceDropdown - A styled dropdown for entity/reference selection
 *
 * Supports two modes:
 * - Simple mode (default): Standard <select> dropdown
 * - Searchable mode: Popover with search filtering for large lists
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

/**
 * @param {Object} props
 * @param {string} props.value - Current selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @param {Array<{value: string, label?: string, meta?: string}>} props.options - Array of options
 * @param {string} [props.placeholder] - Placeholder text for empty selection
 * @param {string} [props.label] - Optional label above the dropdown
 * @param {boolean} [props.searchable] - Enable searchable popover mode (default: false)
 * @param {string} [props.className] - Additional class names
 */
export function ReferenceDropdown({
  value,
  onChange,
  options,
  placeholder,
  label,
  searchable = false,
  className = '',
}) {
  // Searchable mode state
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close on outside click (searchable mode)
  useEffect(() => {
    if (!searchable) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchable]);

  // Filter options in searchable mode
  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.value.toLowerCase().includes(lower) ||
        opt.label?.toLowerCase().includes(lower)
    );
  }, [options, search, searchable]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Simple mode: render a standard <select>
  if (!searchable) {
    return (
      <div className={`form-group ${className}`.trim()}>
        {label && <label className="label">{label}</label>}
        <select
          className="select"
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{placeholder || 'Select...'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Searchable mode: render popover with search
  return (
    <div className={`form-group ${className}`.trim()}>
      {label && <label className="label">{label}</label>}
      <div ref={containerRef} className="dropdown">
        <div
          className="dropdown-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedOption ? '' : 'dropdown-trigger-placeholder'}>
            {selectedOption?.label ||
              selectedOption?.value ||
              placeholder ||
              'Select...'}
          </span>
          <span className="dropdown-arrow">▼</span>
        </div>
        {isOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-search">
              <input
                type="text"
                className="dropdown-search-input"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="dropdown-options">
              {filteredOptions.length === 0 ? (
                <div className="dropdown-empty">No options found</div>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    className={`dropdown-option ${value === opt.value ? 'dropdown-option-selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <span>{opt.label || opt.value}</span>
                    {opt.meta && (
                      <span className="dropdown-option-meta">{opt.meta}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReferenceDropdown;
