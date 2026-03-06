/**
 * FactorEditorModal - Modal for editing feedback factors.
 *
 * Sub-components live in FactorFieldSections.tsx; types in factorEditorTypes.ts.
 * State logic is extracted into useFactorEditorState for line-count limits.
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import type { MouseEvent, KeyboardEvent } from "react";
import { FACTOR_TYPES } from "../constants";
import { FactorEditorContent } from "./FactorEditorContent";
import type {
  FactorType,
  Factor,
  CountObj,
  FactorTypeConfig,
  DropdownOption,
  FactorEditorModalProps,
  FactorSchema,
} from "./factorEditorTypes";
import "./FactorEditorModal.css";

// ---------------------------------------------------------------------------
// useSchemaOptions - memoized dropdown options and lookup helpers
// ---------------------------------------------------------------------------

function useSchemaOptions(schema: FactorSchema) {
  const entityKindOptions = useMemo<DropdownOption[]>(
    () =>
      (schema?.entityKinds ?? []).map((ek) => ({
        value: ek.kind,
        label: ek.description ?? ek.kind,
      })),
    [schema],
  );
  const getSubtypeOptions = useCallback(
    (kind: string): DropdownOption[] => {
      const ek = (schema?.entityKinds ?? []).find((e) => e.kind === kind);
      if (!ek?.subtypes) return [];
      return ek.subtypes.map((st) => ({ value: st.id, label: st.name ?? st.id }));
    },
    [schema],
  );
  const getStatusOptions = useCallback(
    (kind: string): DropdownOption[] => {
      const ek = (schema?.entityKinds ?? []).find((e) => e.kind === kind);
      if (!ek?.statuses) return [];
      return ek.statuses.map((st) => ({
        value: st.id,
        label: st.name ?? st.id,
        meta: st.isTerminal ? "terminal" : "",
      }));
    },
    [schema],
  );
  const relationshipKindOptions = useMemo<DropdownOption[]>(
    () =>
      (schema?.relationshipKinds ?? []).map((rk) => ({
        value: rk.kind,
        label: rk.description ?? rk.kind,
      })),
    [schema],
  );

  return { entityKindOptions, getSubtypeOptions, getStatusOptions, relationshipKindOptions };
}

// ---------------------------------------------------------------------------
// useFactorEditorState - all local state + callbacks for the modal
// ---------------------------------------------------------------------------

const DEFAULT_FACTOR: Factor = { type: "entity_count", coefficient: 1 };

function useFactorEditorState(
  factor: Factor | null,
  isOpen: boolean,
  onChange: (f: Factor) => void,
  onClose: () => void,
) {
  const [localFactor, setLocalFactor] = useState<Factor>(factor ?? DEFAULT_FACTOR);
  const [selectedType, setSelectedType] = useState<FactorType>(factor?.type ?? "entity_count");

  // Sync local draft state from props without useEffect.
  // React allows calling setState during render to adjust state when props change.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevFactor, setPrevFactor] = useState<Factor | null>(factor);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevFactor !== factor || prevIsOpen !== isOpen) {
    setPrevFactor(factor);
    setPrevIsOpen(isOpen);
    const next = factor ?? DEFAULT_FACTOR;
    setLocalFactor(next);
    setSelectedType(next.type);
  }

  const handleTypeChange = useCallback((type: FactorType) => {
    setSelectedType(type);
    const base: Factor = { type, coefficient: 1 };
    const defaults: Factor =
      type === "ratio"
        ? { ...base, numerator: { type: "entity_count" }, denominator: { type: "entity_count" }, fallbackValue: 0 }
        : base;
    setLocalFactor(defaults);
  }, []);

  const updateStringField = useCallback((field: string, value: string | undefined) => {
    setLocalFactor((prev) => ({ ...prev, [field]: value }));
  }, []);
  const updateArrayField = useCallback((field: string, value: string[]) => {
    setLocalFactor((prev) => ({ ...prev, [field]: value }));
  }, []);
  const updateNumericField = useCallback((field: string, value: number | undefined) => {
    setLocalFactor((prev) => ({ ...prev, [field]: value }));
  }, []);
  const handleStatusRatioKindChange = useCallback((v: string | undefined) => {
    setLocalFactor((prev) => ({ ...prev, kind: v, subtype: undefined, aliveStatus: undefined }));
  }, []);
  const updateCountField = useCallback((field: string, value: CountObj) => {
    setLocalFactor((prev) => ({ ...prev, [field]: value }));
  }, []);
  const handleNumeratorChange = useCallback(
    (v: CountObj) => updateCountField("numerator", v),
    [updateCountField],
  );
  const handleDenominatorChange = useCallback(
    (v: CountObj) => updateCountField("denominator", v),
    [updateCountField],
  );
  const handleSave = useCallback(() => {
    onChange(localFactor);
    onClose();
  }, [localFactor, onChange, onClose]);

  return {
    localFactor,
    selectedType,
    handleTypeChange,
    updateStringField,
    updateArrayField,
    updateNumericField,
    handleStatusRatioKindChange,
    handleNumeratorChange,
    handleDenominatorChange,
    handleSave,
  };
}

// ---------------------------------------------------------------------------
// useOverlayDismiss - overlay click-to-close behaviour
// ---------------------------------------------------------------------------

function useOverlayDismiss(onClose: () => void) {
  const mouseDownOnOverlay = useRef(false);
  const handleOverlayMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);
  const handleOverlayClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose();
    },
    [onClose],
  );
  const handleOverlayKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") onClose();
    },
    [onClose],
  );
  return { handleOverlayMouseDown, handleOverlayClick, handleOverlayKeyDown };
}

// ---------------------------------------------------------------------------
// FactorEditorModal
// ---------------------------------------------------------------------------

export function FactorEditorModal({
  isOpen,
  onClose,
  factor,
  onChange,
  feedbackType,
  schema,
}: Readonly<FactorEditorModalProps>) {
  const state = useFactorEditorState(factor, isOpen, onChange, onClose);
  const schemaOpts = useSchemaOptions(schema);
  const overlay = useOverlayDismiss(onClose);

  if (!isOpen) return null;

  const typeConfig = FACTOR_TYPES[state.selectedType] as FactorTypeConfig | undefined;
  const badgeCls =
    feedbackType === "positive" ? "fem-feedback-badge-positive" : "fem-feedback-badge-negative";
  const badgeLabel = feedbackType === "positive" ? "+ Positive" : "- Negative";

  return (
    <div
      className="modal-overlay"
      onMouseDown={overlay.handleOverlayMouseDown}
      onClick={overlay.handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={overlay.handleOverlayKeyDown}
    >
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <span>{typeConfig?.icon}</span>
            {factor ? "Edit Factor" : "Add Factor"}
            <span className={badgeCls}>{badgeLabel}</span>
          </div>
          <button className="btn-close" onClick={onClose}>x</button>
        </div>
        <FactorEditorContent
          localFactor={state.localFactor}
          selectedType={state.selectedType}
          tagRegistry={schema?.tagRegistry}
          schemaOptions={schemaOpts}
          fieldUpdaters={{
            updateStringField: state.updateStringField,
            updateArrayField: state.updateArrayField,
            updateNumericField: state.updateNumericField,
            handleStatusRatioKindChange: state.handleStatusRatioKindChange,
            handleNumeratorChange: state.handleNumeratorChange,
            handleDenominatorChange: state.handleDenominatorChange,
          }}
          handleTypeChange={state.handleTypeChange}
          typeConfig={typeConfig}
        />
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={state.handleSave}>
            {factor ? "Save Changes" : "Add Factor"}
          </button>
        </div>
      </div>
    </div>
  );
}
