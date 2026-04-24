/**
 * DisplayOptionsPanel — Compact radio-group display options for chronicle layout overrides.
 *
 * Auto-saves to IndexedDB on change (300ms debounce).
 * Uses the same PageLayoutOverride schema as PageLayoutEditor.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getPageLayout,
  putPageLayout,
  deletePageLayout,
} from "../../lib/db/pageLayoutRepository";
import type { PageLayoutOverride } from "../../lib/preprint/prePrintTypes";
import "./DisplayOptionsPanel.css";

const LAYOUT_MODES = [
  { value: "", label: "Auto" },
  { value: "flow", label: "Flow" },
  { value: "margin", label: "Margin" },
  { value: "centered", label: "Centered" },
];

const ANNOTATION_DISPLAY = [
  { value: "", label: "Per-note" },
  { value: "full", label: "Full" },
  { value: "popout", label: "Popout" },
  { value: "disabled", label: "Disabled" },
];

const ANNOTATION_POSITION = [
  { value: "", label: "Default" },
  { value: "sidenote", label: "Sidenote" },
  { value: "inline", label: "Inline" },
  { value: "footnote", label: "Footnote" },
];

const IMAGE_LAYOUT = [
  { value: "", label: "Default" },
  { value: "float", label: "Float" },
  { value: "margin", label: "Margin" },
  { value: "block", label: "Block" },
  { value: "hidden", label: "Hidden" },
];

const CONTENT_WIDTH = [
  { value: "", label: "Standard" },
  { value: "narrow", label: "Narrow" },
  { value: "wide", label: "Wide" },
];

const TEXT_ALIGN = [
  { value: "", label: "Left" },
  { value: "center", label: "Center" },
  { value: "justify", label: "Justify" },
];

const DROPCAP = [
  { value: "", label: "Auto" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

interface DisplayOptionsPanelProps {
  chronicleId: string | null;
  chronicleName: string;
  simulationRunId: string;
}

type OverrideFields = Omit<PageLayoutOverride, "pageId" | "simulationRunId" | "updatedAt">;

export default function DisplayOptionsPanel({
  chronicleId,
  chronicleName,
  simulationRunId,
}: Readonly<DisplayOptionsPanelProps>) {
  const [fields, setFields] = useState<OverrideFields>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load existing override when chronicle changes
  useEffect(() => {
    if (!chronicleId) {
      setFields({});
      return;
    }
    let cancelled = false;
    getPageLayout(simulationRunId, chronicleId).then((layout) => {
      if (!cancelled) {
        if (layout) {
          const { pageId: _p, simulationRunId: _s, updatedAt: _u, ...rest } = layout;
          setFields(rest);
        } else {
          setFields({});
        }
      }
    });
    return () => { cancelled = true; };
  }, [chronicleId, simulationRunId]);

  // Auto-save debounced
  const saveFields = useCallback(
    (next: OverrideFields) => {
      if (!chronicleId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        putPageLayout({
          pageId: chronicleId,
          simulationRunId,
          updatedAt: Date.now(),
          ...next,
        });
      }, 300);
    },
    [chronicleId, simulationRunId]
  );

  const handleChange = useCallback(
    (field: keyof OverrideFields, value: string | boolean) => {
      setFields((prev) => {
        const next = { ...prev, [field]: value || undefined };
        saveFields(next);
        return next;
      });
    },
    [saveFields]
  );

  const handleClear = useCallback(() => {
    if (!chronicleId) return;
    deletePageLayout(simulationRunId, chronicleId);
    setFields({});
  }, [chronicleId, simulationRunId]);

  if (!chronicleId) {
    return <div className="dop-no-selection">Select a chronicle to edit display options</div>;
  }

  return (
    <div className="dop-panel">
      <div className="dop-page-name" title={chronicleName}>{chronicleName}</div>

      <RadioGroup label="Layout" field="layoutMode" options={LAYOUT_MODES} value={String(fields.layoutMode || "")} onChange={handleChange} />
      <RadioGroup label="Annotations" field="annotationDisplay" options={ANNOTATION_DISPLAY} value={String(fields.annotationDisplay || "")} onChange={handleChange} />
      <RadioGroup label="Note Position" field="annotationPosition" options={ANNOTATION_POSITION} value={String(fields.annotationPosition || "")} onChange={handleChange} />
      <RadioGroup label="Images" field="imageLayout" options={IMAGE_LAYOUT} value={String(fields.imageLayout || "")} onChange={handleChange} />
      <RadioGroup label="Width" field="contentWidth" options={CONTENT_WIDTH} value={String(fields.contentWidth || "")} onChange={handleChange} />
      <RadioGroup label="Align" field="textAlign" options={TEXT_ALIGN} value={String(fields.textAlign || "")} onChange={handleChange} />

      <RadioGroup label="Drop Cap" field="dropcap" options={DROPCAP}
        value={String(fields.dropcap || "")} onChange={handleChange} />

      <button className="dop-clear-button" onClick={handleClear}>
        Clear all overrides
      </button>
    </div>
  );
}

function RadioGroup({ label, field, options, value, onChange }: Readonly<{
  label: string;
  field: keyof OverrideFields;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (field: keyof OverrideFields, value: string) => void;
}>) {
  return (
    <div>
      <div className="dop-section-title">{label}</div>
      <div className="dop-radio-group">
        {options.map((opt) => (
          <label key={opt.value} className="dop-radio-label">
            <input
              type="radio"
              name={field}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(field, opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
