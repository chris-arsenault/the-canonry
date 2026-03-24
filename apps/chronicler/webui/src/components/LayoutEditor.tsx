/**
 * LayoutEditor — Visual overlay for per-element layout adjustments.
 *
 * When active, images and annotations in the rendered chronicle become
 * clickable. Selecting one shows a floating control panel to adjust
 * size, justification, and margins. Changes save as elementOverrides
 * on the PageLayoutOverride record.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { ElementOverride } from "../types/world.ts";
import "./LayoutEditor.css";

interface LayoutEditorProps {
  /** Container element wrapping the rendered chronicle content */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current element overrides */
  elementOverrides: ElementOverride[];
  /** Save updated overrides */
  onSave: (overrides: ElementOverride[]) => void;
}

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "full-width", label: "Full" },
];

const JUSTIFY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "center", label: "Center" },
];

const NOTE_DISPLAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "full", label: "Full" },
  { value: "popout", label: "Popout" },
  { value: "disabled", label: "Hidden" },
];

interface SelectedElement {
  elementId: string;
  kind: "image" | "note";
  rect: DOMRect;
}

export default function LayoutEditor({
  containerRef,
  elementOverrides,
  onSave,
}: Readonly<LayoutEditorProps>) {
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Find override for selected element
  const currentOverride = selected
    ? elementOverrides.find((o) => o.elementId === selected.elementId)
    : undefined;

  // Click handler — detect clicks on images and annotations
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check for image (inside .chronicle-image figure or direct img)
      const figure = target.closest("figure.chronicle-image, figure.cover-image") as HTMLElement | null;
      const img = target.closest("img") as HTMLElement | null;
      if (figure || img) {
        e.preventDefault();
        e.stopPropagation();
        const el = figure || img!;
        const refId = el.getAttribute("data-ref-id") || el.getAttribute("data-image-id") || "";
        if (refId) {
          setSelected({ elementId: refId, kind: "image", rect: el.getBoundingClientRect() });
          return;
        }
      }

      // Check for historian note
      const note = target.closest("[data-sidenote-callout-idx], .historian-note, .flow-callout, .margin-callout") as HTMLElement | null;
      if (note) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = note.getAttribute("data-note-id") ||
          note.closest("[data-note-id]")?.getAttribute("data-note-id") || "";
        if (noteId) {
          setSelected({ elementId: noteId, kind: "note", rect: note.getBoundingClientRect() });
          return;
        }
      }

      // Click elsewhere → deselect
      if (panelRef.current && !panelRef.current.contains(target)) {
        setSelected(null);
      }
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);

  // Update a field on the current override
  const updateField = useCallback(<K extends keyof ElementOverride>(
    field: K,
    value: ElementOverride[K] | undefined
  ) => {
    if (!selected) return;
    const existing = elementOverrides.find((o) => o.elementId === selected.elementId);
    const updated: ElementOverride = existing
      ? { ...existing, [field]: value || undefined }
      : { elementId: selected.elementId, [field]: value || undefined };

    const next = existing
      ? elementOverrides.map((o) => o.elementId === selected.elementId ? updated : o)
      : [...elementOverrides, updated];

    // Remove entries with no meaningful overrides
    const clean = next.filter((o) => {
      const { elementId: _id, ...rest } = o;
      return Object.values(rest).some((v) => v !== undefined);
    });

    onSave(clean);
  }, [selected, elementOverrides, onSave]);

  if (!selected) return null;

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: Math.min(selected.rect.top, window.innerHeight - 200),
    left: Math.min(selected.rect.right + 12, window.innerWidth - 220),
    zIndex: 1000,
  };

  return (
    <div ref={panelRef} className="le-panel" style={panelStyle}>
      <div className="le-title">
        {selected.kind === "image" ? "Image" : "Annotation"}
      </div>

      {selected.kind === "image" && (
        <>
          <OverrideSelect
            label="Size"
            value={currentOverride?.size || ""}
            options={SIZE_OPTIONS}
            onChange={(v) => updateField("size", v as ElementOverride["size"])}
          />
          <OverrideSelect
            label="Justify"
            value={currentOverride?.justification || ""}
            options={JUSTIFY_OPTIONS}
            onChange={(v) => updateField("justification", v as ElementOverride["justification"])}
          />
        </>
      )}

      {selected.kind === "note" && (
        <OverrideSelect
          label="Display"
          value={currentOverride?.display || ""}
          options={NOTE_DISPLAY_OPTIONS}
          onChange={(v) => updateField("display", v as ElementOverride["display"])}
        />
      )}

      <OverrideNumber
        label="Margin top"
        value={currentOverride?.marginTop}
        onChange={(v) => updateField("marginTop", v)}
      />
      <OverrideNumber
        label="Margin bottom"
        value={currentOverride?.marginBottom}
        onChange={(v) => updateField("marginBottom", v)}
      />

      <button className="le-close" onClick={() => setSelected(null)}>Done</button>
    </div>
  );
}

function OverrideSelect({ label, value, options, onChange }: Readonly<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}>) {
  return (
    <div className="le-field">
      <label className="le-label">{label}</label>
      <select className="le-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function OverrideNumber({ label, value, onChange }: Readonly<{
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}>) {
  return (
    <div className="le-field">
      <label className="le-label">{label}</label>
      <input
        className="le-input"
        type="number"
        value={value ?? ""}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
          onChange(v);
        }}
      />
    </div>
  );
}
