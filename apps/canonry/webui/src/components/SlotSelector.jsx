/**
 * SlotSelector - Dropdown for selecting and managing run slots
 *
 * Shows scratch slot (0) and up to 4 save slots (1-4).
 * Provides Save/Load actions for managing slots.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

const MAX_SAVE_SLOTS = 4;

export default function SlotSelector({
  slots,
  activeSlotIndex,
  onLoadSlot,
  onSaveToSlot,
  onClearSlot,
  onUpdateTitle,
  onExportSlot,
  onImportSlot,
  onLoadExampleOutput,
  hasDataInScratch,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [importTargetSlot, setImportTargetSlot] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setEditingSlot(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingSlot !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSlot]);

  const handleStartEdit = useCallback((slotIndex, currentTitle, e) => {
    e.stopPropagation();
    setEditingSlot(slotIndex);
    setEditValue(currentTitle || '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingSlot !== null && editValue.trim()) {
      onUpdateTitle(editingSlot, editValue.trim());
    }
    setEditingSlot(null);
    setEditValue('');
  }, [editingSlot, editValue, onUpdateTitle]);

  const handleCancelEdit = useCallback(() => {
    setEditingSlot(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleImportRequest = useCallback((slotIndex) => {
    if (!onImportSlot) return;
    const slot = slots[slotIndex];
    const slotTitle = slot?.title || (slotIndex === 0 ? 'Scratch' : `Slot ${slotIndex}`);
    if (slot && !window.confirm(`Overwrite "${slotTitle}" with imported data?`)) {
      return;
    }
    setImportTargetSlot(slotIndex);
    fileInputRef.current?.click();
  }, [onImportSlot, slots]);

  const handleImportFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || importTargetSlot === null || !onImportSlot) {
      e.target.value = '';
      return;
    }
    onImportSlot(importTargetSlot, file);
    setImportTargetSlot(null);
    setShowDropdown(false);
    e.target.value = '';
  }, [importTargetSlot, onImportSlot]);

  // Get active slot data for display
  const activeSlot = slots[activeSlotIndex];
  const activeTitle = activeSlotIndex === 0
    ? (activeSlot?.title || 'Scratch')
    : (activeSlot?.title || `Slot ${activeSlotIndex}`);

  // Determine which slots to show:
  // - Always show slot 0 (scratch)
  // - Show filled save slots
  // - Show next empty slot if scratch has data
  const visibleSlots = [0]; // Always show scratch
  let nextEmptySlot = null;

  for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
    if (slots[i]) {
      visibleSlots.push(i);
    } else if (nextEmptySlot === null) {
      nextEmptySlot = i;
    }
  }

  // Add next empty slot if scratch has data
  if (hasDataInScratch && nextEmptySlot !== null) {
    visibleSlots.push(nextEmptySlot);
  }

  return (
    <div className="slot-selector" ref={dropdownRef}>
      <button
        className="slot-selector-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="slot-selector-name">{activeTitle}</span>
        <span className="slot-selector-chevron">{showDropdown ? '\u25B2' : '\u25BC'}</span>
      </button>

      {showDropdown && (
        <div className="slot-dropdown">
          <div className="slot-dropdown-header">
            <span className="slot-dropdown-title">Run Slots</span>
          </div>

          <div className="slot-list">
            {visibleSlots.map((slotIndex) => {
              const slot = slots[slotIndex];
              const isActive = slotIndex === activeSlotIndex;
              const isEmpty = !slot;
              const isScratch = slotIndex === 0;
              const isEditing = editingSlot === slotIndex;
              const canExport = Boolean(onExportSlot && slot);
              const canImport = Boolean(onImportSlot);

              const title = isScratch
                ? (slot?.title || 'Scratch')
                : isEmpty
                  ? `Slot ${slotIndex} (empty)`
                  : slot.title;

              return (
                <div
                  key={slotIndex}
                  className={`slot-item ${isActive ? 'slot-item-active' : ''} ${isEmpty ? 'slot-item-empty' : ''}`}
                >
                  <div className="slot-item-content">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="slot-title-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="slot-item-name"
                        onClick={() => !isEmpty && !isScratch && handleStartEdit(slotIndex, slot?.title, { stopPropagation: () => {} })}
                        title={!isEmpty && !isScratch ? 'Click to edit title' : undefined}
                      >
                        {isActive && <span className="slot-active-indicator">*</span>}
                        {title}
                      </div>
                    )}
                    {slot?.createdAt && !isEditing && (
                      <div className="slot-item-meta">
                        {new Date(slot.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>

                  <div className="slot-item-actions" onClick={(e) => e.stopPropagation()}>
                    {isScratch ? (
                      // Scratch slot - Load if not active, Clear if has data
                      <>
                        {canImport && (
                          <button
                            className="btn-xs"
                            onClick={() => handleImportRequest(slotIndex)}
                          >
                            Import
                          </button>
                        )}
                        {canExport && (
                          <button
                            className="btn-xs"
                            onClick={() => {
                              onExportSlot(slotIndex);
                              setShowDropdown(false);
                            }}
                          >
                            Export
                          </button>
                        )}
                        {isActive ? (
                          <span className="slot-status">Active</span>
                        ) : (
                          <button
                            className="btn-xs"
                            onClick={() => {
                              onLoadSlot(0);
                              setShowDropdown(false);
                            }}
                          >
                            Load
                          </button>
                        )}
                        {slot && (
                          <button
                            className="btn-xs btn-xs-danger"
                            onClick={() => {
                              if (window.confirm('Clear scratch data? This cannot be undone.')) {
                                onClearSlot(0);
                                setShowDropdown(false);
                              }
                            }}
                            title="Clear scratch data"
                          >
                            ×
                          </button>
                        )}
                      </>
                    ) : isEmpty ? (
                      // Empty save slot - only show Save if scratch has data
                      <>
                        {canImport && (
                          <button
                            className="btn-xs"
                            onClick={() => handleImportRequest(slotIndex)}
                          >
                            Import
                          </button>
                        )}
                        {hasDataInScratch && activeSlotIndex === 0 && (
                          <button
                            className="btn-xs btn-xs-primary"
                            onClick={() => {
                              onSaveToSlot(slotIndex);
                              setShowDropdown(false);
                            }}
                          >
                            Save
                          </button>
                        )}
                      </>
                    ) : (
                      // Filled save slot - show Save (if on scratch), Load, and Clear
                      <>
                        {canImport && (
                          <button
                            className="btn-xs"
                            onClick={() => handleImportRequest(slotIndex)}
                          >
                            Import
                          </button>
                        )}
                        {canExport && (
                          <button
                            className="btn-xs"
                            onClick={() => {
                              onExportSlot(slotIndex);
                              setShowDropdown(false);
                            }}
                          >
                            Export
                          </button>
                        )}
                        {hasDataInScratch && activeSlotIndex === 0 && (
                          <button
                            className="btn-xs"
                            onClick={() => {
                              if (window.confirm(`Overwrite "${slot.title}" with current scratch data?`)) {
                                onSaveToSlot(slotIndex);
                                setShowDropdown(false);
                              }
                            }}
                            title="Overwrite with scratch data"
                          >
                            Save
                          </button>
                        )}
                        {isActive ? (
                          <span className="slot-status">Active</span>
                        ) : (
                          <button
                            className="btn-xs"
                            onClick={() => {
                              onLoadSlot(slotIndex);
                              setShowDropdown(false);
                            }}
                          >
                            Load
                          </button>
                        )}
                        <button
                          className="btn-xs btn-xs-danger"
                          onClick={() => {
                            if (window.confirm(`Delete "${slot.title}"? This cannot be undone.`)) {
                              onClearSlot(slotIndex);
                              setShowDropdown(false);
                            }
                          }}
                          title="Delete this slot"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleSlots.length === 1 && !hasDataInScratch && (
              <div className="slot-empty-hint">
                Run a simulation to create data, then save to a slot.
              </div>
            )}

            {onLoadExampleOutput && (
              <div className="slot-item slot-item-empty">
                <div className="slot-item-content">
                  <div className="slot-item-name">Example Output</div>
                  <div className="slot-item-meta">Load a sample Lore Weave run.</div>
                </div>
                <div className="slot-item-actions">
                  <button
                    className="btn-xs"
                    onClick={() => {
                      if (hasDataInScratch && !window.confirm('Overwrite scratch with the example output?')) {
                        return;
                      }
                      onLoadExampleOutput();
                      setShowDropdown(false);
                    }}
                  >
                    Load
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  );
}
