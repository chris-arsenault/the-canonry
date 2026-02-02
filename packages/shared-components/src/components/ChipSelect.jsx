/**
 * ChipSelect - Multi-select component with searchable dropdown
 *
 * Displays selected items as removable chips with a searchable dropdown to add more.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableOptions = useMemo(() => {
    return options.filter(opt => !value.includes(opt.value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search) return availableOptions;
    const lower = search.toLowerCase();
    return availableOptions.filter(opt =>
      opt.value.toLowerCase().includes(lower) ||
      opt.label?.toLowerCase().includes(lower)
    );
  }, [availableOptions, search]);

  const handleSelect = (optValue) => {
    onChange([...value, optValue]);
    setSearch('');
    inputRef.current?.focus();
  };

  const handleRemove = (optValue) => {
    onChange(value.filter(v => v !== optValue));
  };

  const getLabel = (val) => {
    const opt = options.find(o => o.value === val);
    return opt?.label || val;
  };

  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <div ref={containerRef} className="dropdown">
        <div
          className="chip-container chip-container-input"
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          {value.map(v => (
            <span key={v} className="chip">
              {getLabel(v)}
              <button
                type="button"
                className="chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(v);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            placeholder={value.length === 0 ? placeholder : ''}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="chip-input"
          />
        </div>
        {isOpen && filteredOptions.length > 0 && (
          <div className="dropdown-menu">
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="dropdown-item"
              >
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
