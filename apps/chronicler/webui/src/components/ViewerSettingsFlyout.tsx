/**
 * ViewerSettingsFlyout — Popover panel for viewer-level display preferences.
 *
 * Toggled from a gear button in the WikiNav bottom section.
 * Uses icon toggle rows instead of dropdowns for compact display.
 * Fixed positioning to escape sidebar overflow:hidden.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { ViewerPreferences } from "../hooks/useViewerPreferences.ts";
import "./ViewerSettingsFlyout.css";

interface ViewerSettingsFlyoutProps {
  prefs: ViewerPreferences;
  onUpdate: <K extends keyof ViewerPreferences>(field: K, value: ViewerPreferences[K]) => void;
}

interface IconOption<T extends string> {
  value: T;
  icon: string;
  label: string;
}

const ANNOTATION_OPTIONS: IconOption<ViewerPreferences["annotationDisplay"]>[] = [
  { value: "default", icon: "—", label: "Default" },
  { value: "full", icon: "▤", label: "Full callouts" },
  { value: "popout", icon: "ⁿ", label: "Popout only" },
];

const POSITION_OPTIONS: IconOption<ViewerPreferences["annotationPosition"]>[] = [
  { value: "default", icon: "—", label: "Default" },
  { value: "sidenote", icon: "▐", label: "Side margin" },
  { value: "inline", icon: "¶", label: "Inline" },
  { value: "footnote", icon: "†", label: "Footnotes" },
];

const IMAGE_OPTIONS: IconOption<ViewerPreferences["imageLayout"]>[] = [
  { value: "default", icon: "—", label: "Default" },
  { value: "hidden", icon: "⊘", label: "Hidden" },
];

export default function ViewerSettingsFlyout({ prefs, onUpdate }: Readonly<ViewerSettingsFlyoutProps>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ bottom: number; left: number } | null>(null);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const hasOverrides = prefs.annotationDisplay !== "default"
    || prefs.annotationPosition !== "default"
    || prefs.imageLayout !== "default";

  return (
    <>
      <button
        ref={buttonRef}
        className={`bottom-link vsf-button${hasOverrides ? " vsf-active" : ""}`}
        onClick={toggle}
        title="Viewer display settings"
      >
        &#x2699;
      </button>
      {open && panelPos && (
        <div
          ref={panelRef}
          className="vsf-panel"
          style={{ bottom: panelPos.bottom, left: panelPos.left }}
        >
          <IconRow label="Notes" value={prefs.annotationDisplay} options={ANNOTATION_OPTIONS}
            onChange={(v) => onUpdate("annotationDisplay", v)} />
          <IconRow label="Position" value={prefs.annotationPosition} options={POSITION_OPTIONS}
            onChange={(v) => onUpdate("annotationPosition", v)} />
          <IconRow label="Images" value={prefs.imageLayout} options={IMAGE_OPTIONS}
            onChange={(v) => onUpdate("imageLayout", v)} />
        </div>
      )}
    </>
  );
}

function IconRow<T extends string>({ label, value, options, onChange }: Readonly<{
  label: string;
  value: T;
  options: IconOption<T>[];
  onChange: (value: T) => void;
}>) {
  return (
    <div className="vsf-row">
      <span className="vsf-row-label">{label}</span>
      <div className="vsf-icons">
        {options.map((o) => (
          <button
            key={o.value}
            className={`vsf-icon${value === o.value ? " vsf-icon-active" : ""}`}
            onClick={() => onChange(o.value)}
            title={o.label}
          >
            {o.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
