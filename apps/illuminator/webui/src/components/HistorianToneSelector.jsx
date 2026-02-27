/**
 * HistorianToneSelector - Popover button for selecting historian tone/mood
 *
 * Replaces the simple "Historian" button with a dropdown that lets the user
 * pick a tone before triggering a review. Same historian persona, different mood.
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import "./HistorianToneSelector.css";

// ============================================================================
// Tone Options
// ============================================================================

const TONE_OPTIONS = [{
  value: "scholarly",
  label: "Scholarly",
  description: "Professional, measured, objective",
  symbol: "\u25CE"
}, {
  value: "witty",
  label: "Witty",
  description: "Sarcastic, playful, sly",
  symbol: "\u2736"
}, {
  value: "weary",
  label: "Weary",
  description: "Resigned satire, black humor",
  symbol: "\u25CB"
}, {
  value: "forensic",
  label: "Forensic",
  description: "Clinical, methodical, cold",
  symbol: "\u25C8"
}, {
  value: "elegiac",
  label: "Elegiac",
  description: "Mournful, lyrical, grief",
  symbol: "\u25C7"
}, {
  value: "cantankerous",
  label: "Cantankerous",
  description: "Irritable, exacting, sharp",
  symbol: "\u266F"
}, {
  value: "rueful",
  label: "Rueful",
  description: "Self-aware regret, crooked smile",
  symbol: "\u2312"
}, {
  value: "conspiratorial",
  label: "Conspiratorial",
  description: "Whispering asides, sharing secrets",
  symbol: "\u2298"
}, {
  value: "bemused",
  label: "Bemused",
  description: "Puzzled, entertained by absurdity",
  symbol: "\u2042"
}];
export const TONE_META = Object.fromEntries(TONE_OPTIONS.map(t => [t.value, t]));

// ============================================================================
// Component
// ============================================================================

export default function HistorianToneSelector({
  onSelect,
  disabled,
  hasNotes,
  className,
  label
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  const handleSelect = tone => {
    setIsOpen(false);
    onSelect(tone);
  };
  return <div ref={containerRef} className={`htsel-container${className ? ` ${className}` : ""}`}>
      <button onClick={() => setIsOpen(!isOpen)} disabled={disabled} title="Select historian tone and generate annotations" className={`htsel-trigger ${disabled ? "htsel-trigger-disabled" : ""}`}>
        {label || (hasNotes ? "Re-annotate" : "Historian")} ▾
      </button>

      {isOpen && <div className="htsel-dropdown">
          <div className="htsel-dropdown-header">Historian Tone</div>
          {TONE_OPTIONS.map(option => <button key={option.value} onClick={() => handleSelect(option.value)} className="htsel-option">
              <span className="htsel-option-symbol">{option.symbol}</span>
              <div className="htsel-option-content">
                <div className="htsel-option-label">{option.label}</div>
                <div className="htsel-option-description">{option.description}</div>
              </div>
            </button>)}
        </div>}
    </div>;
}
HistorianToneSelector.propTypes = {
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  hasNotes: PropTypes.bool,
  className: PropTypes.string,
  label: PropTypes.string
};
