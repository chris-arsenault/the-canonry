/**
 * ChipSelect - Multi-select component with searchable dropdown
 *
 * Displays selected items as removable chips with a searchable dropdown to add more.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Optional } from '../types/optionality.js';

interface ChipSelectOption {
  value: string;
  label: Optional<string>;
}

interface ChipSelectProps {
  readonly value: Optional<string[]>;
  readonly onChange: (value: string[]) => void;
  readonly options: ChipSelectOption[];
  readonly placeholder: Optional<string>;
  readonly label: Optional<string>;
}

/**
 * @param {Object} props
 * @param {string[]} props.value - Array of selected values
 * @param {Function} props.onChange - Callback when selection changes
 * @param {Array<{value: string, label?: string}>} props.options - Available options
 * @param {string} [props.placeholder] - Placeholder text when empty
 * @param {string} [props.label] - Optional label above the component
 */
export function ChipSelect({
  value = [],
  onChange,
  options,
  placeholder = 'Add...',
  label,
}: ChipSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const available = useMemo(() => options.filter(opt => !value.includes(opt.value)), [options, value]);
  const filtered = useMemo(() => {
    if (!search) return available;
    const lower = search.toLowerCase();
    return available.filter(opt => opt.value.toLowerCase().includes(lower) || opt.label?.toLowerCase().includes(lower));
  }, [available, search]);
  const handleSelect = (v: string) => { onChange([...value, v]); setSearch(''); inputRef.current?.focus(); };
  const getLabel = (val: string) => options.find(o => o.value === val)?.label || val;

  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <div ref={containerRef} className="dropdown">
        <div className="chip-container chip-container-input"
          onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
          {value.map(v => (
            <span key={v} className="chip">
              {getLabel(v)}
              <button type="button" className="chip-remove"
                onClick={(e) => { e.stopPropagation(); onChange(value.filter(x => x !== v)); }}>×</button>
            </span>
          ))}
          <input ref={inputRef} type="text" className="chip-input"
            placeholder={value.length === 0 ? placeholder : ''} value={search}
            onChange={(e) => setSearch(e.target.value)} onFocus={() => setIsOpen(true)} />
        </div>
        {isOpen && filtered.length > 0 && (
          <div className="dropdown-menu">
            {filtered.map((opt) => (
              <div key={opt.value} className="dropdown-item" onClick={() => handleSelect(opt.value)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}>
                {opt.label || opt.value}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChipSelect;
