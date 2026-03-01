/**
 * Action button groups for slot rows.
 */

import React, { useCallback } from "react";
import type { SlotData, SlotCallbacks, SlotContext } from "./types";

function ScratchActions({ slot, slotIndex, isActive, callbacks, context }: Readonly<{
  slot: SlotData | undefined;
  slotIndex: number;
  isActive: boolean;
  callbacks: SlotCallbacks;
  context: SlotContext;
}>) {
  const handleImport = useCallback(() => callbacks.handleImportRequest(slotIndex), [callbacks, slotIndex]);
  const handleExport = useCallback(() => {
    callbacks.onExportSlot?.(slotIndex);
    callbacks.setShowDropdown(false);
  }, [callbacks, slotIndex]);
  const handleLoad = useCallback(() => {
    callbacks.onLoadSlot(0);
    callbacks.setShowDropdown(false);
  }, [callbacks]);
  const handleClear = useCallback(() => {
    if (window.confirm("Clear scratch data? This cannot be undone.")) {
      callbacks.onClearSlot(0);
      callbacks.setShowDropdown(false);
    }
  }, [callbacks]);

  return (
    <>
      {context.canImport ? <button className="btn-xs" onClick={handleImport}>Import</button> : null}
      {context.canExport ? <button className="btn-xs" onClick={handleExport}>Export</button> : null}
      {isActive ? (
        <span className="slot-status">Active</span>
      ) : (
        <button className="btn-xs" onClick={handleLoad}>Load</button>
      )}
      {slot ? <button className="btn-xs btn-xs-danger" onClick={handleClear} title="Clear scratch data">×</button> : null}
    </>
  );
}

function EmptySlotActions({ slotIndex, callbacks, context }: Readonly<{
  slotIndex: number;
  callbacks: SlotCallbacks;
  context: SlotContext;
}>) {
  const handleImport = useCallback(() => callbacks.handleImportRequest(slotIndex), [callbacks, slotIndex]);
  const handleSave = useCallback(() => {
    callbacks.onSaveToSlot(slotIndex);
    callbacks.setShowDropdown(false);
  }, [callbacks, slotIndex]);

  const showSave = context.hasDataInScratch && context.activeSlotIndex === 0;

  return (
    <>
      {context.canImport ? <button className="btn-xs" onClick={handleImport}>Import</button> : null}
      {showSave ? <button className="btn-xs btn-xs-primary" onClick={handleSave}>Save</button> : null}
    </>
  );
}

function FilledSlotActions({ slot, slotIndex, isActive, callbacks, context }: Readonly<{
  slot: SlotData;
  slotIndex: number;
  isActive: boolean;
  callbacks: SlotCallbacks;
  context: SlotContext;
}>) {
  const handleImport = useCallback(() => callbacks.handleImportRequest(slotIndex), [callbacks, slotIndex]);
  const handleExport = useCallback(() => {
    callbacks.onExportSlot?.(slotIndex);
    callbacks.setShowDropdown(false);
  }, [callbacks, slotIndex]);
  const handleSave = useCallback(() => {
    if (window.confirm(`Overwrite "${slot.title}" with current scratch data?`)) {
      callbacks.onSaveToSlot(slotIndex);
      callbacks.setShowDropdown(false);
    }
  }, [callbacks, slot.title, slotIndex]);
  const handleLoad = useCallback(() => {
    callbacks.onLoadSlot(slotIndex);
    callbacks.setShowDropdown(false);
  }, [callbacks, slotIndex]);
  const handleClear = useCallback(() => {
    if (window.confirm(`Delete "${slot.title}"? This cannot be undone.`)) {
      callbacks.onClearSlot(slotIndex);
      callbacks.setShowDropdown(false);
    }
  }, [callbacks, slot.title, slotIndex]);

  const showSave = context.hasDataInScratch && context.activeSlotIndex === 0;

  return (
    <>
      {context.canImport ? <button className="btn-xs" onClick={handleImport}>Import</button> : null}
      {context.canExport ? <button className="btn-xs" onClick={handleExport}>Export</button> : null}
      {showSave ? <button className="btn-xs" onClick={handleSave} title="Overwrite with scratch data">Save</button> : null}
      {isActive ? (
        <span className="slot-status">Active</span>
      ) : (
        <button className="btn-xs" onClick={handleLoad}>Load</button>
      )}
      <button className="btn-xs btn-xs-danger" onClick={handleClear} title="Delete this slot">×</button>
    </>
  );
}

interface SlotItemActionsProps {
  readonly isScratch: boolean;
  readonly isEmpty: boolean;
  readonly slot: SlotData | undefined;
  readonly slotIndex: number;
  readonly isActive: boolean;
  readonly callbacks: SlotCallbacks;
  readonly context: SlotContext;
}

export function SlotItemActions({ isScratch, isEmpty, slot, slotIndex, isActive, callbacks, context }: Readonly<SlotItemActionsProps>) {
  if (isScratch) {
    return <ScratchActions slot={slot} slotIndex={slotIndex} isActive={isActive} callbacks={callbacks} context={context} />;
  }
  if (isEmpty || !slot) {
    return <EmptySlotActions slotIndex={slotIndex} callbacks={callbacks} context={context} />;
  }
  return <FilledSlotActions slot={slot} slotIndex={slotIndex} isActive={isActive} callbacks={callbacks} context={context} />;
}
