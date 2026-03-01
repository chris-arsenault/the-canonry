/**
 * SlotSelector - Dropdown for selecting and managing run slots
 *
 * Shows scratch slot (0) and up to 4 save slots (1-4).
 * Provides Save/Load actions for managing slots.
 */

import React, { useState, useRef, useCallback, useMemo } from "react";
import type { SlotsMap, SlotCallbacks, SlotContext, SlotEditState } from "./types";
import { useClickOutside, useSlotEditing, useSlotImport, useVisibleSlots } from "./hooks";
import { SlotDropdownPanel } from "./SlotDropdownPanel";
import "./SlotSelector.css";

interface SlotSelectorProps {
  readonly slots: SlotsMap;
  readonly activeSlotIndex: number;
  readonly onLoadSlot: (slotIndex: number) => void;
  readonly onSaveToSlot: (slotIndex: number) => void;
  readonly onClearSlot: (slotIndex: number) => void;
  readonly onUpdateTitle: (slotIndex: number, title: string) => void;
  readonly onExportSlot?: (slotIndex: number) => void;
  readonly onImportSlot?: (slotIndex: number, file: File) => void;
  readonly onLoadExampleOutput?: () => void;
  readonly hasDataInScratch?: boolean;
}

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
  hasDataInScratch = false,
}: Readonly<SlotSelectorProps>) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeDropdown = useCallback(() => setShowDropdown(false), []);
  useClickOutside(dropdownRef, closeDropdown);

  const editing = useSlotEditing(onUpdateTitle, inputRef);
  const { handleImportRequest, handleImportFile } = useSlotImport(onImportSlot, slots, fileInputRef, setShowDropdown);
  const visibleSlots = useVisibleSlots(slots, hasDataInScratch);
  const toggleDropdown = useCallback(() => setShowDropdown((prev) => !prev), []);

  const editState: SlotEditState = useMemo(() => ({
    editingSlot: editing.editingSlot, editValue: editing.editValue, setEditValue: editing.setEditValue,
    inputRef, handleKeyDown: editing.handleKeyDown, handleSaveEdit: editing.handleSaveEdit, handleStartEdit: editing.handleStartEdit,
  }), [editing.editingSlot, editing.editValue, editing.setEditValue, editing.handleKeyDown, editing.handleSaveEdit, editing.handleStartEdit]);

  const callbacks: SlotCallbacks = useMemo(() => ({
    onLoadSlot, onSaveToSlot, onClearSlot, onExportSlot, handleImportRequest, setShowDropdown,
  }), [onLoadSlot, onSaveToSlot, onClearSlot, onExportSlot, handleImportRequest]);

  const context: SlotContext = useMemo(() => ({
    hasDataInScratch, activeSlotIndex, canImport: Boolean(onImportSlot), canExport: Boolean(onExportSlot),
  }), [hasDataInScratch, activeSlotIndex, onImportSlot, onExportSlot]);

  const activeSlot = slots[activeSlotIndex];
  const activeTitle = activeSlotIndex === 0
    ? activeSlot?.title || "Scratch"
    : activeSlot?.title || `Slot ${activeSlotIndex}`;

  return (
    <div className="slot-selector" ref={dropdownRef}>
      <button className="slot-selector-trigger" onClick={toggleDropdown}>
        <span className="slot-selector-name">{activeTitle}</span>
        <span className="slot-selector-chevron">{showDropdown ? "\u25B2" : "\u25BC"}</span>
      </button>

      {showDropdown ? (
        <SlotDropdownPanel
          visibleSlots={visibleSlots}
          slots={slots}
          activeSlotIndex={activeSlotIndex}
          editState={editState}
          callbacks={callbacks}
          context={context}
          onLoadExampleOutput={onLoadExampleOutput}
          hasDataInScratch={hasDataInScratch}
          setShowDropdown={setShowDropdown}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="ss-hidden-input"
        onChange={handleImportFile}
      />
    </div>
  );
}
