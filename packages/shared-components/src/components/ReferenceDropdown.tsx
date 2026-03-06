/**
 * ReferenceDropdown - A styled dropdown for entity/reference selection
 *
 * Supports two modes:
 * - Simple mode (default): Standard <select> dropdown
 * - Searchable mode: Popover with search filtering for large lists
 */

import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import type { Optional } from '../types/optionality.js';

interface ReferenceDropdownOption {
  value: string;
  label: Optional<string>;
  meta: Optional<string>;
}

interface ReferenceDropdownProps {
  readonly value: Optional<string>;
  readonly onChange: (value: string | undefined) => void;
  readonly options: ReferenceDropdownOption[];
  readonly placeholder: Optional<string>;
  readonly label: Optional<string>;
  readonly searchable: Optional<boolean>;
  readonly className: Optional<string>;
}

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
// eslint-disable-next-line complexity -- search filtering + selected display + empty state in a dropdown with popover
function SearchableReferenceDropdown({ value, onChange, options, placeholder, label, className = '' }: Omit<ReferenceDropdownProps, 'searchable'>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(opt => opt.value.toLowerCase().includes(lower) || opt.label?.toLowerCase().includes(lower));
  }, [options, search]);
  const selected = options.find((opt) => opt.value === value);
  const handleSelect = (v: string) => { onChange(v); setIsOpen(false); setSearch(''); };

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && <label className="label">{label}</label>}
      <div ref={containerRef} className="dropdown">
        <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
          <span className={selected ? '' : 'dropdown-trigger-placeholder'}>
            {selected?.label || selected?.value || placeholder || 'Select...'}
          </span>
          <span className="dropdown-arrow">▼</span>
        </div>
        {isOpen && (
          <div className="dropdown-menu">
            {/* eslint-disable jsx-a11y/no-autofocus -- search input needs focus when dropdown opens */}
            <div className="dropdown-search"><input type="text" className="dropdown-search-input" placeholder="Search..." value={search}
                onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus /></div>
            {/* eslint-enable jsx-a11y/no-autofocus */}
            <div className="dropdown-options">
              {filtered.length === 0 ? <div className="dropdown-empty">No options found</div> : filtered.map((opt) => (
                <div key={opt.value} className={`dropdown-option ${value === opt.value ? 'dropdown-option-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
                  <span>{opt.label || opt.value}</span>
                  {opt.meta && <span className="dropdown-option-meta">{opt.meta}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReferenceDropdown({ searchable = false, ...props }: ReferenceDropdownProps) {
  const generatedId = useId();
  if (searchable) return <SearchableReferenceDropdown {...props} />;
  const { value, onChange, options, placeholder, label, className = '' } = props;
  return (
    <div className={`form-group ${className}`.trim()}>
      {label && <label htmlFor={generatedId} className="label">{label}</label>}
      <select id={generatedId} className="select" value={value || ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>)}
      </select>
    </div>
  );
}

export default ReferenceDropdown;
