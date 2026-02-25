/**
 * HistorianConfigEditor - Dedicated tab for configuring the historian persona
 *
 * Defines the scholarly voice that annotates entities and chronicles.
 * Configuration is project-level (one historian per world).
 */

import { useState, useCallback } from "react";
import "./HistorianConfigEditor.css";

// ============================================================================
// Tag/Chip Input (reusable for arrays of strings)
// ============================================================================

function TagInput({ value, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        className={`hce-tag-list${value.length > 0 ? " hce-tag-list--has-items" : ""}`}
      >
        {value.map((tag, i) => (
          <span key={i} className="hce-tag">
            {tag}
            <button onClick={() => removeTag(i)} className="hce-tag-remove">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="hce-input-row">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="hce-text-input"
        />
        <button
          onClick={addTag}
          disabled={!inputValue.trim()}
          className={`hce-add-btn ${inputValue.trim() ? "hce-add-btn--enabled" : "hce-add-btn--disabled"}`}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// List Editor (for longer text items like private facts, running gags)
// ============================================================================

function ListEditor({ value, onChange, placeholder, itemPlaceholder }) {
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const removeItem = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {value.map((item, i) => (
        <div key={i} className="hce-list-item">
          <span className="hce-list-item-text">{item}</span>
          <button onClick={() => removeItem(i)} className="hce-list-item-remove">
            ×
          </button>
        </div>
      ))}
      <div className={`hce-input-row${value.length > 0 ? " hce-input-row--has-items" : ""}`}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={itemPlaceholder || placeholder}
          className="hce-text-input"
        />
        <button
          onClick={addItem}
          disabled={!inputValue.trim()}
          className={`hce-add-btn ${inputValue.trim() ? "hce-add-btn--enabled" : "hce-add-btn--disabled"}`}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Field Label
// ============================================================================

function FieldLabel({ label, description }) {
  return (
    <div className="hce-field-label-wrap">
      <div className="hce-field-label">{label}</div>
      {description && <div className="hce-field-description">{description}</div>}
    </div>
  );
}

// ============================================================================
// Main Editor
// ============================================================================

export default function HistorianConfigEditor({ config, onChange }) {
  const update = useCallback(
    (field, value) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange]
  );

  const [reloadStatus, setReloadStatus] = useState(null); // null | 'confirm' | 'loading' | 'done' | 'error'

  const handleReloadFromDefaults = useCallback(async () => {
    try {
      setReloadStatus("loading");
      const response = await fetch("/default-project/historianConfig.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const defaultConfig = await response.json();
      onChange(defaultConfig);
      setReloadStatus("done");
      setTimeout(() => setReloadStatus(null), 2000);
    } catch (err) {
      setReloadStatus("error");
      console.error("Failed to reload historian config:", err);
      setTimeout(() => setReloadStatus(null), 3000);
    }
  }, [onChange]);

  const isConfigured = config.name.trim().length > 0 && config.background.trim().length > 0;

  return (
    <div className="hce-root">
      {/* Header */}
      <div className="hce-header">
        <div className="hce-header-top">
          <div className="hce-header-title">
            Historian Persona
          </div>
          <button
            onClick={() => setReloadStatus("confirm")}
            disabled={reloadStatus === "loading"}
            className="illuminator-button illuminator-button-secondary hce-reload-btn"
            title="Reload historian config from the default project template"
          >
            {reloadStatus === "loading"
              ? "Loading..."
              : reloadStatus === "done"
                ? "Reloaded \u2713"
                : reloadStatus === "error"
                  ? "Failed \u2717"
                  : "Reload Defaults"}
          </button>
        </div>
        <div className="hce-header-description">
          Define the scholarly voice behind both <strong>annotations</strong> (margin notes —
          corrections, observations, asides) and <strong>copy edits</strong> (full description
          rewrites synthesized from the description archive). The same persona drives both
          operations in a consistent voice across all content.
        </div>
        {!isConfigured && (
          <div className="hce-unconfigured-notice">
            Configure at least a name and background to enable historian annotations and copy edits.
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="hce-fields">
        {/* Name */}
        <div>
          <FieldLabel
            label="Name & Title"
            description='e.g., "Aldric Fenworth, Third Archivist of the Pale Library"'
          />
          <input
            type="text"
            value={config.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Enter the historian's name and title"
            className="hce-full-input"
          />
        </div>

        {/* Background */}
        <div>
          <FieldLabel
            label="Background"
            description="Credentials, institutional affiliation, era they're writing from"
          />
          <textarea
            value={config.background}
            onChange={(e) => update("background", e.target.value)}
            placeholder="A seasoned archivist who has spent forty years cataloguing the histories of the realm. Has outlived most of the people described in these texts. Still shows up to work."
            className="hce-textarea hce-textarea--bg"
          />
        </div>

        {/* Personality Traits */}
        <div>
          <FieldLabel
            label="Personality Traits"
            description="Short phrases that define the historian's character — think weary, not wacky"
          />
          <TagInput
            value={config.personalityTraits}
            onChange={(v) => update("personalityTraits", v)}
            placeholder='e.g., "world-weary", "quietly compassionate"'
          />
        </div>

        {/* Biases */}
        <div>
          <FieldLabel
            label="Biases & Blind Spots"
            description="What they trust, distrust, or have given up arguing about"
          />
          <TagInput
            value={config.biases}
            onChange={(v) => update("biases", v)}
            placeholder='e.g., "distrusts oral histories"'
          />
        </div>

        {/* Stance */}
        <div>
          <FieldLabel
            label="Stance Toward Source Material"
            description="Their overall relationship to the texts they're working with"
          />
          <textarea
            value={config.stance}
            onChange={(e) => update("stance", e.target.value)}
            placeholder='e.g., "Has read too many of these accounts to be surprised, but still occasionally moved by the human cost of events others reduce to dates and outcomes"'
            className="hce-textarea hce-textarea--stance"
          />
        </div>

        {/* Private Facts */}
        <div>
          <FieldLabel
            label="Private Facts"
            description="Things the historian knows that aren't in the canon facts. May surface in annotations and shape editorial choices in copy edits."
          />
          <ListEditor
            value={config.privateFacts}
            onChange={(v) => update("privateFacts", v)}
            placeholder="Add a fact"
            itemPlaceholder='e.g., "The real cause of the Great Fire was arson, not the dragon"'
          />
        </div>

        {/* Running Gags */}
        <div>
          <FieldLabel
            label="Recurring Preoccupations"
            description="Refrains, motifs, or things the historian keeps circling back to — not jokes, but patterns they can't stop noticing"
          />
          <ListEditor
            value={config.runningGags}
            onChange={(v) => update("runningGags", v)}
            placeholder="Add a preoccupation"
            itemPlaceholder='e.g., "The way institutions always outlive the people who built them"'
          />
        </div>
      </div>

      {/* Reload confirmation modal */}
      {reloadStatus === "confirm" && (
        <div
          className="hce-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReloadStatus(null);
          }}
        >
          <div className="hce-modal-box">
            <div className="hce-modal-title">
              Reload from Defaults?
            </div>
            <div className="hce-modal-body">
              This will overwrite your current historian configuration with the default project
              template. Any edits you've made will be lost.
            </div>
            <div className="hce-modal-actions">
              <button
                onClick={() => setReloadStatus(null)}
                className="illuminator-button illuminator-button-secondary hce-modal-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReloadFromDefaults()}
                className="illuminator-button hce-modal-btn"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
