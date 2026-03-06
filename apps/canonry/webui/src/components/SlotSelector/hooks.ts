/**
 * Custom hooks for SlotSelector.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type React from "react";
import type { SlotsMap } from "./types";

const MAX_SAVE_SLOTS = 4;

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onClose]);
}

export function useSlotEditing(
  onUpdateTitle: (slotIndex: number, title: string) => void,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (editingSlot !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSlot, inputRef]);

  const handleStartEdit = useCallback(
    (slotIndex: number, currentTitle: string | undefined, e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setEditingSlot(slotIndex);
      setEditValue(currentTitle || "");
    },
    [],
  );

  const handleSaveEdit = useCallback(() => {
    if (editingSlot !== null && editValue.trim()) {
      onUpdateTitle(editingSlot, editValue.trim());
    }
    setEditingSlot(null);
    setEditValue("");
  }, [editingSlot, editValue, onUpdateTitle]);

  const handleCancelEdit = useCallback(() => {
    setEditingSlot(null);
    setEditValue("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  return { editingSlot, editValue, setEditValue, handleStartEdit, handleSaveEdit, handleKeyDown };
}

export function useSlotImport(
  onImportSlot: ((slotIndex: number, file: File) => void) | undefined,
  slots: SlotsMap,
  fileInputRef: React.RefObject<HTMLInputElement | null>,
  setShowDropdown: (show: boolean) => void,
) {
  const [importTargetSlot, setImportTargetSlot] = useState<number | null>(null);

  const handleImportRequest = useCallback(
    (slotIndex: number) => {
      if (!onImportSlot) return;
      const slot = slots[slotIndex];
      const slotTitle = slot?.title || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`);
      if (slot && !window.confirm(`Overwrite "${slotTitle}" with imported data?`)) {
        return;
      }
      setImportTargetSlot(slotIndex);
      fileInputRef.current?.click();
    },
    [onImportSlot, slots, fileInputRef],
  );

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || importTargetSlot === null || !onImportSlot) {
        e.target.value = "";
        return;
      }
      onImportSlot(importTargetSlot, file);
      setImportTargetSlot(null);
      setShowDropdown(false);
      e.target.value = "";
    },
    [importTargetSlot, onImportSlot, setShowDropdown],
  );

  return { handleImportRequest, handleImportFile };
}

export function useVisibleSlots(slots: SlotsMap, hasDataInScratch: boolean): number[] {
  return useMemo(() => {
    const visible = [0];
    let nextEmptySlot: number | null = null;

    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
      if (slots[i]) {
        visible.push(i);
      } else if (nextEmptySlot === null) {
        nextEmptySlot = i;
      }
    }

    if (hasDataInScratch && nextEmptySlot !== null) {
      visible.push(nextEmptySlot);
    }

    return visible;
  }, [slots, hasDataInScratch]);
}
