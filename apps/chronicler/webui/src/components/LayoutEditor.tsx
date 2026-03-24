/**
 * LayoutEditor — Visual overlay for per-element layout adjustments.
 *
 * When active, images, annotations, and section headings become
 * clickable. Selecting one shows a floating control panel to adjust
 * size, justification, margins, etc. Changes save as elementOverrides
 * on the PageLayoutOverride record.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { ElementOverride } from "../types/world.ts";
import "./LayoutEditor.css";

interface LayoutEditorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  elementOverrides: ElementOverride[];
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

type ElementKind = "image" | "note" | "section";

interface SelectedElement {
  elementId: string;
  kind: ElementKind;
  rect: DOMRect;
  label: string;
}

export default function LayoutEditor({
  containerRef,
  elementOverrides,
  onSave,
}: Readonly<LayoutEditorProps>) {
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentOverride = selected
    ? elementOverrides.find((o) => o.elementId === selected.elementId)
    : undefined;

  // Click handler — detect clicks on images, annotations, and section headings
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't intercept clicks on the panel itself
      if (panelRef.current?.contains(target)) return;

      // Image: figure[data-ref-id] or figure[data-image-id]
      const figure = target.closest("figure[data-ref-id], figure[data-image-id]") as HTMLElement | null;
      if (figure) {
        e.preventDefault();
        e.stopPropagation();
        const id = figure.getAttribute("data-ref-id") || figure.getAttribute("data-image-id") || "";
        if (id) {
          setSelected({ elementId: id, kind: "image", rect: figure.getBoundingClientRect(), label: "Image" });
          return;
        }
      }

      // Annotation: aside[data-note-id]
      const note = target.closest("[data-note-id]") as HTMLElement | null;
      if (note) {
        e.preventDefault();
        e.stopPropagation();
        const noteId = note.getAttribute("data-note-id") || "";
        if (noteId) {
          setSelected({ elementId: noteId, kind: "note", rect: note.getBoundingClientRect(), label: "Annotation" });
          return;
        }
      }

      // Section heading: h2 inside .wp-section
      const heading = target.closest(".wp-section > h2, .wp-section > .section-heading") as HTMLElement | null;
      if (heading) {
        e.preventDefault();
        e.stopPropagation();
        const section = heading.closest(".wp-section") as HTMLElement | null;
        const sectionId = section?.id || heading.textContent || "";
        if (sectionId) {
          setSelected({ elementId: sectionId, kind: "section", rect: heading.getBoundingClientRect(), label: heading.textContent || "Section" });
          return;
        }
      }

      // Click elsewhere → deselect
      setSelected(null);
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);

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

    const clean = next.filter((o) => {
      const { elementId: _id, ...rest } = o;
      return Object.values(rest).some((v) => v !== undefined);
    });

    onSave(clean);
  }, [selected, elementOverrides, onSave]);

  if (!selected) return null;

  // Position panel to the right of the element, clamped to viewport
  const panelTop = Math.max(8, Math.min(selected.rect.top, window.innerHeight - 260));
  const panelLeft = Math.min(selected.rect.right + 12, window.innerWidth - 220);

  return (
    <div ref={panelRef} className="le-panel" style={{ position: "fixed", top: panelTop, left: panelLeft, zIndex: 1000 }}>
      <div className="le-title">{selected.label}</div>

      {selected.kind === "image" && (
        <>
          <OverrideSelect label="Size" value={currentOverride?.size || ""} options={SIZE_OPTIONS}
            onChange={(v) => updateField("size", v as ElementOverride["size"])} />
          <OverrideSelect label="Justify" value={currentOverride?.justification || ""} options={JUSTIFY_OPTIONS}
            onChange={(v) => updateField("justification", v as ElementOverride["justification"])} />
        </>
      )}

      {selected.kind === "note" && (
        <OverrideSelect label="Display" value={currentOverride?.display || ""} options={NOTE_DISPLAY_OPTIONS}
          onChange={(v) => updateField("display", v as ElementOverride["display"])} />
      )}

      <OverrideNumber label="Margin top" value={currentOverride?.marginTop}
        onChange={(v) => updateField("marginTop", v)} />
      <OverrideNumber label="Margin bottom" value={currentOverride?.marginBottom}
        onChange={(v) => updateField("marginBottom", v)} />

      <button className="le-close" onClick={() => setSelected(null)}>Done</button>
    </div>
  );
}

function OverrideSelect({ label, value, options, onChange }: Readonly<{
  label: string; value: string; options: { value: string; label: string }[];
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
  label: string; value: number | undefined;
  onChange: (value: number | undefined) => void;
}>) {
  return (
    <div className="le-field">
      <label className="le-label">{label}</label>
      <input className="le-input" type="number" value={value ?? ""} placeholder="0"
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)} />
    </div>
  );
}
