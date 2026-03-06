/**
 * SlotDropdownPanel - the open dropdown content and ExampleOutputRow.
 */

import React, { useCallback } from "react";
import type { SlotsMap, SlotCallbacks, SlotContext, SlotEditState } from "./types";
import { SlotItem } from "./SlotItem";

interface ExampleOutputRowProps {
  readonly onLoadExampleOutput: () => void;
  readonly hasDataInScratch: boolean;
  readonly setShowDropdown: (show: boolean) => void;
}

function ExampleOutputRow({ onLoadExampleOutput, hasDataInScratch, setShowDropdown }: Readonly<ExampleOutputRowProps>) {
  const handleClick = useCallback(() => {
    if (hasDataInScratch && !window.confirm("Overwrite scratch with the example output?")) {
      return;
    }
    onLoadExampleOutput();
    setShowDropdown(false);
  }, [hasDataInScratch, onLoadExampleOutput, setShowDropdown]);

  return (
    <div className="slot-item slot-item-empty">
      <div className="slot-item-content">
        <div className="slot-label">Example Output</div>
        <div className="slot-item-meta">Load a sample Lore Weave run.</div>
      </div>
      <div className="slot-item-actions">
        <button className="btn-xs" onClick={handleClick}>Load</button>
      </div>
    </div>
  );
}

interface SlotDropdownPanelProps {
  readonly visibleSlots: number[];
  readonly slots: SlotsMap;
  readonly activeSlotIndex: number;
  readonly editState: SlotEditState;
  readonly callbacks: SlotCallbacks;
  readonly context: SlotContext;
  readonly onLoadExampleOutput?: () => void;
  readonly hasDataInScratch: boolean;
  readonly setShowDropdown: (show: boolean) => void;
}

export function SlotDropdownPanel({
  visibleSlots,
  slots,
  activeSlotIndex,
  editState,
  callbacks,
  context,
  onLoadExampleOutput,
  hasDataInScratch,
  setShowDropdown,
}: Readonly<SlotDropdownPanelProps>) {
  return (
    <div className="slot-dropdown">
      <div className="slot-dropdown-header">
        <span className="slot-dropdown-title">Run Slots</span>
      </div>

      <div className="slot-list">
        {visibleSlots.map((slotIndex) => (
          <SlotItem
            key={slotIndex}
            slotIndex={slotIndex}
            slot={slots[slotIndex]}
            isActive={slotIndex === activeSlotIndex}
            editState={editState}
            callbacks={callbacks}
            context={context}
          />
        ))}

        {visibleSlots.length === 1 && !hasDataInScratch ? (
          <div className="slot-empty-hint">
            Run a simulation to create data, then save to a slot.
          </div>
        ) : null}

        {onLoadExampleOutput ? (
          <ExampleOutputRow
            onLoadExampleOutput={onLoadExampleOutput}
            hasDataInScratch={hasDataInScratch}
            setShowDropdown={setShowDropdown}
          />
        ) : null}
      </div>
    </div>
  );
}
