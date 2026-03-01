/**
 * Shared types for SlotSelector components.
 */

import type React from "react";

export interface SlotData {
  title: string;
  createdAt?: number;
}

/** Record mapping slot indices to their data (sparse - empty slots are undefined). */
export type SlotsMap = Record<number, SlotData | undefined>;

export interface SlotCallbacks {
  readonly onLoadSlot: (slotIndex: number) => void;
  readonly onSaveToSlot: (slotIndex: number) => void;
  readonly onClearSlot: (slotIndex: number) => void;
  readonly onExportSlot?: (slotIndex: number) => void;
  readonly handleImportRequest: (slotIndex: number) => void;
  readonly setShowDropdown: (show: boolean) => void;
}

export interface SlotContext {
  readonly hasDataInScratch: boolean;
  readonly activeSlotIndex: number;
  readonly canImport: boolean;
  readonly canExport: boolean;
}

export interface SlotEditState {
  readonly editingSlot: number | null;
  readonly editValue: string;
  readonly setEditValue: (value: string) => void;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  readonly handleSaveEdit: () => void;
  readonly handleStartEdit: (slotIndex: number, currentTitle: string | undefined, e: { stopPropagation: () => void }) => void;
}
