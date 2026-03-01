/**
 * SlotItem - a single row in the slot list, including title and action buttons.
 */

import React, { useCallback } from "react";
import type { SlotData, SlotCallbacks, SlotContext, SlotEditState } from "./types";
import { SlotItemActions } from "./SlotItemActions";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function SlotItemTitle({ slot, slotIndex, isEmpty, isScratch, editingSlot, editValue, setEditValue, inputRef, handleKeyDown, handleSaveEdit, handleStartEdit }: Readonly<{
  slot: SlotData | undefined;
  slotIndex: number;
  isEmpty: boolean;
  isScratch: boolean;
  editingSlot: number | null;
  editValue: string;
  setEditValue: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSaveEdit: () => void;
  handleStartEdit: (slotIndex: number, currentTitle: string | undefined, e: { stopPropagation: () => void }) => void;
}>) {
  const isEditing = editingSlot === slotIndex;

  let title: string;
  if (isScratch) {
    title = slot?.title || "Scratch";
  } else if (isEmpty) {
    title = `Slot ${slotIndex} (empty)`;
  } else {
    title = slot?.title || "";
  }

  const handleClick = useCallback(() => {
    if (!isEmpty && !isScratch) {
      handleStartEdit(slotIndex, slot?.title, { stopPropagation: () => {} });
    }
  }, [isEmpty, isScratch, handleStartEdit, slotIndex, slot]);

  const handleDivKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, [setEditValue]);

  const handleInputClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="slot-title-input"
        value={editValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSaveEdit}
        onClick={handleInputClick}
      />
    );
  }

  return (
    <div
      className="slot-label"
      onClick={handleClick}
      title={!isEmpty && !isScratch ? "Click to edit title" : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={handleDivKeyDown}
    >
      {title}
    </div>
  );
}

interface SlotItemProps {
  readonly slotIndex: number;
  readonly slot: SlotData | undefined;
  readonly isActive: boolean;
  readonly editState: SlotEditState;
  readonly callbacks: SlotCallbacks;
  readonly context: SlotContext;
}

export function SlotItem({ slotIndex, slot, isActive, editState, callbacks, context }: Readonly<SlotItemProps>) {
  const isEmpty = !slot;
  const isScratch = slotIndex === 0;
  const isEditing = editState.editingSlot === slotIndex;

  const handleActionsClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(), []);
  const handleActionsKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }, []);

  return (
    <div className={`slot-item ${isActive ? "slot-item-active" : ""} ${isEmpty ? "slot-item-empty" : ""}`}>
      <div className="slot-item-content">
        <SlotItemTitle
          slot={slot}
          slotIndex={slotIndex}
          isEmpty={isEmpty}
          isScratch={isScratch}
          editingSlot={editState.editingSlot}
          editValue={editState.editValue}
          setEditValue={editState.setEditValue}
          inputRef={editState.inputRef}
          handleKeyDown={editState.handleKeyDown}
          handleSaveEdit={editState.handleSaveEdit}
          handleStartEdit={editState.handleStartEdit}
        />
        {slot && slot.createdAt && !isEditing ? (
          <div className="slot-item-meta">
            {new Date(slot.createdAt).toLocaleDateString("en-US", DATE_FORMAT_OPTIONS)}
          </div>
        ) : null}
      </div>

      <div className="slot-item-actions" onClick={handleActionsClick} role="button" tabIndex={0} onKeyDown={handleActionsKeyDown}>
        <SlotItemActions
          isScratch={isScratch}
          isEmpty={isEmpty}
          slot={slot}
          slotIndex={slotIndex}
          isActive={isActive}
          callbacks={callbacks}
          context={context}
        />
      </div>
    </div>
  );
}
