/**
 * CultureEditor - Edit culture identity (id, name, description, color)
 *
 * This edits the BASE culture identity only.
 * - Axis biases and home regions are edited in Cosmographer
 * - Naming data is edited in Name Forge
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  ExpandableCard,
  FormGroup,
  FormRow,
  SectionHeader,
  EmptyState,
  InfoBox,
} from "@penguin-tales/shared-components";
import "./CultureEditor.css";

const PRESET_COLORS = [
  "#ff6b7a",
  "#ff8f6b",
  "#ffb366",
  "#ffdd59",
  "#7bed9f",
  "#66ddb3",
  "#6c9bff",
  "#5352ed",
  "#a55eea",
  "#ff6b81",
  "#70a1ff",
  "#eccc68",
  "#ff7f50",
  "#20bf6b",
  "#0fb9b1",
  "#778ca3",
];

export default function CultureEditor({ cultures, onChange }) {
  const [expandedCultures, setExpandedCultures] = useState({});

  const getStableKey = (culture) => culture._key || culture.id;

  const toggleCulture = useCallback((stableKey) => {
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  }, []);

  const addCulture = () => {
    const stableKey = `culture_${Date.now()}`;
    const newCulture = {
      id: stableKey,
      name: "New Culture",
      description: "",
      color: PRESET_COLORS[cultures.length % PRESET_COLORS.length],
      _key: stableKey,
    };
    onChange([...cultures, newCulture]);
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateCulture = (cultureId, updates) => {
    const existing = cultures.find((c) => c.id === cultureId);
    if (existing?.isFramework) return;
    onChange(cultures.map((c) => (c.id === cultureId ? { ...c, ...updates } : c)));
  };

  const deleteCulture = (cultureId) => {
    const existing = cultures.find((c) => c.id === cultureId);
    if (existing?.isFramework) return;
    if (confirm("Delete this culture?")) {
      onChange(cultures.filter((c) => c.id !== cultureId));
    }
  };

  const getCultureSummary = (culture) => {
    const parts = [];
    if (culture.naming?.domains?.length) parts.push(`${culture.naming.domains.length} domains`);
    if (culture.axisBiases && Object.keys(culture.axisBiases).length) parts.push("axis biases");
    return parts.length > 0 ? parts.join(", ") : "not configured";
  };

  const renderHeaderActions = () => (
    <button className="btn btn-primary" onClick={addCulture}>
      + Add Culture
    </button>
  );

  const renderCultureTitle = (culture) => (
    <span className="ced-title-wrapper">
      <span
        className="ced-color-swatch"
        style={{ '--ced-swatch-color': culture.color }}
      />
      {culture.name}
    </span>
  );

  const renderCultureActions = (culture, isFramework) => (
    <span className="text-muted text-small">
      {getCultureSummary(culture)}
      {isFramework && (
        <span className="badge badge-info ced-framework-badge">
          framework
        </span>
      )}
    </span>
  );

  return (
    <div className="editor-container ced-container">
      <SectionHeader
        title="Cultures"
        description="Define cultural groups with their own naming conventions and placement biases."
        count={cultures.length}
        actions={renderHeaderActions()}
      />

      {cultures.length === 0 ? (
        <EmptyState
          icon="🎭"
          title="No cultures defined"
          description="Add one to give your world cultural diversity."
        />
      ) : (
        <div className="list-stack">
          {cultures.map((culture) => {
            const stableKey = getStableKey(culture);
            const isExpanded = expandedCultures[stableKey];
            const isFramework = Boolean(culture.isFramework);

            return (
              <ExpandableCard
                key={stableKey}
                expanded={isExpanded}
                onToggle={toggleCulture}
                toggleId={stableKey}
                title={renderCultureTitle(culture)}
                subtitle={culture.id}
                actions={renderCultureActions(culture, isFramework)}
              >
                {/* Name and ID */}
                <FormRow>
                  <FormGroup label="Name">
                    <input
                      className="input"
                      value={culture.name}
                      disabled={isFramework}
                      onChange={(e) => updateCulture(culture.id, { name: e.target.value })}
                      placeholder="Culture name"
                    />
                  </FormGroup>
                  <FormGroup label="ID">
                    <input
                      className="input"
                      value={culture.id}
                      disabled={isFramework}
                      onChange={(e) => {
                        const newId = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "");
                        if (newId && !cultures.some((c) => c.id === newId && c.id !== culture.id)) {
                          updateCulture(culture.id, { id: newId });
                        }
                      }}
                      placeholder="culture-id"
                    />
                  </FormGroup>
                </FormRow>

                <FormRow>
                  <FormGroup label="Description" wide>
                    <input
                      className="input"
                      value={culture.description || ""}
                      disabled={isFramework}
                      onChange={(e) => updateCulture(culture.id, { description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </FormGroup>
                </FormRow>

                {/* Color Selection */}
                <div className="section">
                  <div className="section-title">Color</div>
                  <div className="ced-color-row">
                    <div
                      className="ced-color-preview"
                      style={{ '--ced-preview-color': culture.color }}
                    />
                    <div className="chip-list">
                      {PRESET_COLORS.map((color) => (
                        <div
                          key={color}
                          className={`chip chip-clickable ced-color-chip ${culture.color === color ? "chip-active" : ""}`}
                          style={{
                            '--ced-chip-bg': color,
                            '--ced-chip-border': culture.color === color ? '#fff' : 'transparent',
                            '--ced-chip-opacity': isFramework ? 0.6 : 1,
                            '--ced-chip-pointer': isFramework ? 'none' : 'auto',
                          }}
                          onClick={() => updateCulture(culture.id, { color })}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info about other editors */}
                <InfoBox title="Additional configuration">
                  <ul className="ced-info-list">
                    <li>
                      <strong>Names tab</strong> — Configure naming domains, grammars, and profiles
                    </li>
                    <li>
                      <strong>Cosmography tab</strong> — Configure axis biases and home regions
                    </li>
                  </ul>
                </InfoBox>

                {/* Actions */}
                <div className="danger-zone">
                  <div className="ced-action-badges">
                    {culture.naming && <span className="badge">has naming</span>}
                    {culture.axisBiases && <span className="badge">has biases</span>}
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteCulture(culture.id)}
                    disabled={isFramework}
                  >
                    Delete Culture
                  </button>
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

CultureEditor.propTypes = {
  cultures: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};
