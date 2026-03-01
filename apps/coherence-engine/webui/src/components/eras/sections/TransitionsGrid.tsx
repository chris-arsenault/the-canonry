/**
 * TransitionsGrid - Two-column layout for entry/exit conditions and effects
 *
 * Displays Entry (left) and Exit (right) side by side for better use of screen width.
 * Each column has conditions and effects stacked vertically.
 */

import React, { useCallback, useMemo } from "react";
import { AddItemButton, SearchableDropdown } from "../../shared";
import { TransitionConditionEditor, TransitionEffectItem } from "../shared";

const ADD_ITEM_STYLES = Object.freeze({
  addItemBtn: { marginTop: "8px", padding: "6px 12px", fontSize: "12px" },
});

interface Condition {
  type: string;
  [key: string]: unknown;
}

interface PressureEntry {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface DropdownItem {
  value: string;
  label: string;
}

interface SchemaObject {
  entityKinds?: Array<{ kind: string; description?: string }>;
  relationshipKinds?: Array<{ kind: string; description?: string }>;
  [key: string]: unknown;
}

interface EraObject {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Compact section within the grid
 */
interface MiniSectionProps {
  title: string;
  icon?: string;
  count?: number;
  children?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

function MiniSection({ title, icon, count, children, isEmpty, emptyMessage }: MiniSectionProps) {
  return (
    <div className="transitions-mini-section viewer-section">
      <div className="transitions-mini-header">
        <span className="transitions-mini-icon">{icon}</span>
        <span className="transitions-mini-title">{title}</span>
        <span className="transitions-mini-count">{count}</span>
      </div>
      <div className="transitions-mini-content">
        {isEmpty && <div className="transitions-mini-empty">{emptyMessage}</div>}
        {children}
      </div>
    </div>
  );
}

interface ConditionsColumnProps {
  conditions: Condition[];
  onUpdate: (index: number, updated: Condition) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  pressures: PressureEntry[];
  schema?: SchemaObject;
  eras: EraObject[];
  label: string;
  emptyMessage: string;
}

function ConditionsSection({
  conditions,
  onUpdate,
  onRemove,
  onAdd,
  pressures,
  schema,
  eras,
  label,
  emptyMessage,
}: ConditionsColumnProps) {
  const handleUpdate = useCallback(
    (index: number, updated: Condition) => onUpdate(index, updated),
    [onUpdate],
  );
  const handleRemove = useCallback(
    (index: number) => onRemove(index),
    [onRemove],
  );

  return (
    <MiniSection
      title="Conditions"
      icon="?"
      count={conditions.length}
      isEmpty={conditions.length === 0}
      emptyMessage={emptyMessage}
    >
      {conditions.map((condition, index) => (
        <TransitionConditionEditor
          key={index}
          condition={condition}
          index={index}
          onChange={(updated: Condition) => handleUpdate(index, updated)}
          onRemove={() => handleRemove(index)}
          pressures={pressures}
          schema={schema}
          eras={eras}
        />
      ))}
      <AddItemButton
        onClick={onAdd}
        label={`+ ${label}`}
        styles={ADD_ITEM_STYLES}
      />
    </MiniSection>
  );
}

interface EffectsColumnProps {
  pressureChanges: Array<[string, number]>;
  onUpdate: (pressureId: string, newValue: number) => void;
  onRemove: (pressureId: string) => void;
  onAdd: (item: DropdownItem) => void;
  availablePressures: DropdownItem[];
  pressures: PressureEntry[];
}

function EffectsSection({
  pressureChanges,
  onUpdate,
  onRemove,
  onAdd,
  availablePressures,
  pressures,
}: EffectsColumnProps) {
  return (
    <MiniSection
      title="Effects"
      icon="*"
      count={pressureChanges.length}
      isEmpty={pressureChanges.length === 0}
      emptyMessage="No pressure changes"
    >
      {pressureChanges.map(([pressureId, value]) => (
        <TransitionEffectItem
          key={pressureId}
          pressureId={pressureId}
          value={value}
          onChange={(newValue: number) => onUpdate(pressureId, newValue)}
          onRemove={() => onRemove(pressureId)}
          pressures={pressures}
        />
      ))}
      <div className="transitions-add-effect">
        <SearchableDropdown
          items={availablePressures}
          onSelect={onAdd}
          placeholder="+ Add effect..."
          emptyMessage="All pressures added"
        />
      </div>
    </MiniSection>
  );
}

interface TransitionsGridProps {
  entryConditions?: Condition[];
  exitConditions?: Condition[];
  entryPressureChanges?: Array<[string, number]>;
  exitPressureChanges?: Array<[string, number]>;
  onUpdateEntryCondition: (index: number, updated: Condition) => void;
  onRemoveEntryCondition: (index: number) => void;
  onAddEntryCondition: () => void;
  onUpdateExitCondition: (index: number, updated: Condition) => void;
  onRemoveExitCondition: (index: number) => void;
  onAddExitCondition: () => void;
  onUpdateEntryEffect: (pressureId: string, newValue: number) => void;
  onRemoveEntryEffect: (pressureId: string) => void;
  onAddEntryEffect: (item: DropdownItem) => void;
  onUpdateExitEffect: (pressureId: string, newValue: number) => void;
  onRemoveExitEffect: (pressureId: string) => void;
  onAddExitEffect: (item: DropdownItem) => void;
  availablePressuresForEntry?: DropdownItem[];
  availablePressuresForExit?: DropdownItem[];
  pressures?: PressureEntry[];
  schema?: SchemaObject;
  eras?: EraObject[];
}

export function TransitionsGrid({
  entryConditions = [],
  exitConditions = [],
  entryPressureChanges = [],
  exitPressureChanges = [],
  onUpdateEntryCondition,
  onRemoveEntryCondition,
  onAddEntryCondition,
  onUpdateExitCondition,
  onRemoveExitCondition,
  onAddExitCondition,
  onUpdateEntryEffect,
  onRemoveEntryEffect,
  onAddEntryEffect,
  onUpdateExitEffect,
  onRemoveExitEffect,
  onAddExitEffect,
  availablePressuresForEntry = [],
  availablePressuresForExit = [],
  pressures = [],
  schema,
  eras = [],
}: TransitionsGridProps) {
  const stableEntryPressures = useMemo(() => availablePressuresForEntry, [availablePressuresForEntry]);
  const stableExitPressures = useMemo(() => availablePressuresForExit, [availablePressuresForExit]);

  return (
    <div className="transitions-grid">
      {/* Entry Column */}
      <div className="transitions-column transitions-entry">
        <div className="transitions-column-header">
          <span className="transitions-column-icon">&#128682;</span>
          <span className="transitions-column-title">Entry</span>
          <span className="transitions-column-subtitle">When era starts</span>
        </div>

        <ConditionsSection
          conditions={entryConditions}
          onUpdate={onUpdateEntryCondition}
          onRemove={onRemoveEntryCondition}
          onAdd={onAddEntryCondition}
          pressures={pressures}
          schema={schema}
          eras={eras}
          label="Condition"
          emptyMessage="No entry conditions -- starts immediately"
        />

        <EffectsSection
          pressureChanges={entryPressureChanges}
          onUpdate={onUpdateEntryEffect}
          onRemove={onRemoveEntryEffect}
          onAdd={onAddEntryEffect}
          availablePressures={stableEntryPressures}
          pressures={pressures}
        />
      </div>

      {/* Arrow divider */}
      <div className="transitions-divider">
        <span className="transitions-arrow">&rarr;</span>
      </div>

      {/* Exit Column */}
      <div className="transitions-column transitions-exit">
        <div className="transitions-column-header">
          <span className="transitions-column-icon">&#128260;</span>
          <span className="transitions-column-title">Exit</span>
          <span className="transitions-column-subtitle">When era ends</span>
        </div>

        <ConditionsSection
          conditions={exitConditions}
          onUpdate={onUpdateExitCondition}
          onRemove={onRemoveExitCondition}
          onAdd={onAddExitCondition}
          pressures={pressures}
          schema={schema}
          eras={eras}
          label="Condition"
          emptyMessage="No exit conditions -- transitions immediately"
        />

        <EffectsSection
          pressureChanges={exitPressureChanges}
          onUpdate={onUpdateExitEffect}
          onRemove={onRemoveExitEffect}
          onAdd={onAddExitEffect}
          availablePressures={stableExitPressures}
          pressures={pressures}
        />
      </div>
    </div>
  );
}
