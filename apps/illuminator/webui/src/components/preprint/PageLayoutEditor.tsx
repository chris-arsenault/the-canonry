/**
 * PageLayoutEditor — Per-page layout override editor.
 *
 * Shown when a content node (not a folder) is selected in the content tree.
 * Reads/writes to the pageLayouts table via pageLayoutRepository.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type {
  PageLayoutOverride,
  LayoutMode,
  AnnotationDisplay,
  AnnotationPosition,
  ImageLayout,
  ContentWidth,
  TextAlign,
} from "../../lib/preprint/prePrintTypes";
import { getPageLayout, putPageLayout, deletePageLayout } from "../../lib/db/pageLayoutRepository";

interface PageLayoutEditorProps {
  pageId: string;
  pageName: string;
  simulationRunId: string;
}

const LAYOUT_MODES: { value: LayoutMode | ""; label: string }[] = [
  { value: "", label: "Auto (engine default)" },
  { value: "flow", label: "Flow — text wraps floats" },
  { value: "margin", label: "Margin — 3-column grid" },
  { value: "centered", label: "Centered — verse/poetry" },
];

const ANNOTATION_DISPLAY: { value: AnnotationDisplay | ""; label: string }[] = [
  { value: "", label: "Per-note default" },
  { value: "full", label: "Full — inline callouts" },
  { value: "popout", label: "Popout — superscript only" },
  { value: "disabled", label: "Disabled — hide all" },
];

const ANNOTATION_POSITION: { value: AnnotationPosition | ""; label: string }[] = [
  { value: "", label: "Default" },
  { value: "sidenote", label: "Sidenote — right margin" },
  { value: "inline", label: "Inline — within text" },
  { value: "footnote", label: "Footnote — collected at bottom" },
];

const IMAGE_LAYOUT: { value: ImageLayout | ""; label: string }[] = [
  { value: "", label: "Default" },
  { value: "float", label: "Float — wrap text" },
  { value: "margin", label: "Margin — side columns" },
  { value: "block", label: "Block — full width" },
  { value: "hidden", label: "Hidden — no images" },
];

const CONTENT_WIDTH: { value: ContentWidth | ""; label: string }[] = [
  { value: "", label: "Standard" },
  { value: "narrow", label: "Narrow (52ch)" },
  { value: "wide", label: "Wide (90ch)" },
];

const TEXT_ALIGN: { value: TextAlign | ""; label: string }[] = [
  { value: "", label: "Default (left)" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "justify", label: "Justify" },
];

type OverrideField = keyof Omit<PageLayoutOverride, "pageId" | "simulationRunId" | "updatedAt">;

/** Metadata keys excluded from "has override" check */
const METADATA_KEYS = new Set(["pageId", "simulationRunId", "updatedAt"]);

/** Check if a PageLayoutOverride has any meaningful (non-metadata) fields set */
function hasAnyOverride(layout: PageLayoutOverride): boolean {
  return Object.entries(layout).some(
    ([k, v]) => !METADATA_KEYS.has(k) && v !== undefined
  );
}

export default function PageLayoutEditor({
  pageId,
  pageName,
  simulationRunId,
}: Readonly<PageLayoutEditorProps>) {
  const [override, setOverride] = useState<PageLayoutOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Load existing override
  useEffect(() => {
    let cancelled = false;
    void getPageLayout(simulationRunId, pageId).then((result) => {
      if (!cancelled) {
        setOverride(result);
        setLoading(false);
        setDirty(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [simulationRunId, pageId]);

  const update = useCallback(
    <K extends OverrideField>(field: K, value: PageLayoutOverride[K] | undefined) => {
      setOverride((prev) => {
        const base = prev ?? { pageId, simulationRunId, updatedAt: Date.now() };
        const next = { ...base, [field]: value === "" ? undefined : value, updatedAt: Date.now() };
        return next;
      });
      setDirty(true);
    },
    [pageId, simulationRunId]
  );

  const handleSave = useCallback(async () => {
    if (!override) return;
    await putPageLayout(override);
    setDirty(false);
  }, [override]);

  const handleClear = useCallback(async () => {
    await deletePageLayout(simulationRunId, pageId);
    setOverride(null);
    setDirty(false);
  }, [simulationRunId, pageId]);

  const onLayoutModeChange = useCallback(
    (v: string) => update("layoutMode", (v || undefined) as LayoutMode | undefined),
    [update]
  );
  const onAnnotationDisplayChange = useCallback(
    (v: string) => update("annotationDisplay", (v || undefined) as AnnotationDisplay | undefined),
    [update]
  );
  const onAnnotationPositionChange = useCallback(
    (v: string) => update("annotationPosition", (v || undefined) as AnnotationPosition | undefined),
    [update]
  );
  const onImageLayoutChange = useCallback(
    (v: string) => update("imageLayout", (v || undefined) as ImageLayout | undefined),
    [update]
  );
  const onContentWidthChange = useCallback(
    (v: string) => update("contentWidth", (v || undefined) as ContentWidth | undefined),
    [update]
  );
  const onTextAlignChange = useCallback(
    (v: string) => update("textAlign", (v || undefined) as TextAlign | undefined),
    [update]
  );

  const hasOverride = useMemo(
    () => override !== null && hasAnyOverride(override),
    [override]
  );

  if (loading) {
    return (
      <div className="preprint-layout-editor">
        <div className="preprint-layout-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="preprint-layout-editor">
      <LayoutHeader
        pageName={pageName}
        hasOverride={hasOverride}
        onClear={handleClear}
      />

      <div className="preprint-layout-fields">
        <SelectField label="Layout Mode" value={override?.layoutMode ?? ""} options={LAYOUT_MODES} onChange={onLayoutModeChange} />
        <SelectField label="Annotations" value={override?.annotationDisplay ?? ""} options={ANNOTATION_DISPLAY} onChange={onAnnotationDisplayChange} />
        <SelectField label="Note Position" value={override?.annotationPosition ?? ""} options={ANNOTATION_POSITION} onChange={onAnnotationPositionChange} />
        <SelectField label="Image Layout" value={override?.imageLayout ?? ""} options={IMAGE_LAYOUT} onChange={onImageLayoutChange} />
        <SelectField label="Content Width" value={override?.contentWidth ?? ""} options={CONTENT_WIDTH} onChange={onContentWidthChange} />
        <SelectField label="Text Align" value={override?.textAlign ?? ""} options={TEXT_ALIGN} onChange={onTextAlignChange} />

        <div className="preprint-layout-row">
          <label className="preprint-layout-label">
            <input
              type="checkbox"
              checked={override?.dropcap ?? false}
              onChange={(e) => update("dropcap", e.target.checked || undefined)}
            />
            Drop cap
          </label>
        </div>

        <div className="preprint-layout-row">
          <label htmlFor="custom-css-class" className="preprint-layout-label-block">Custom CSS class</label>
          <input id="custom-css-class"
            type="text"
            className="preprint-input preprint-layout-text"
            value={override?.customClass ?? ""}
            onChange={(e) => update("customClass", e.target.value || undefined)}
            placeholder="e.g. my-custom-layout"
          />
        </div>
      </div>

      {dirty && (
        <div className="preprint-layout-actions">
          <button className="preprint-layout-save" onClick={() => void handleSave()}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function LayoutHeader({
  pageName,
  hasOverride,
  onClear,
}: Readonly<{
  pageName: string;
  hasOverride: boolean;
  onClear: () => Promise<void>;
}>) {
  return (
    <div className="preprint-layout-header">
      <span className="preprint-layout-title" title={pageName}>
        Layout: {pageName}
      </span>
      {hasOverride && (
        <button
          className="preprint-layout-clear"
          onClick={() => void onClear()}
          title="Reset to engine defaults"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}>) {
  const id = React.useId();
  return (
    <div className="preprint-layout-row">
      <label htmlFor={id} className="preprint-layout-label-block">{label}</label>
      <select id={id}
        className="preprint-layout-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
