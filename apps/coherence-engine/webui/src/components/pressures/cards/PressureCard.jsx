/**
 * PressureCard - Expandable card for editing a pressure
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { FactorCard } from "./FactorCard";
import { FactorEditorModal } from "../modals/FactorEditorModal";
import { getElementValidation, useLocalInputState, NumberInput } from "../../shared";
import {
  buildStorageKey,
  clearStoredValue,
  loadStoredValue,
  saveStoredValue,
} from "../../../utils/persistence";
import "./PressureCard.css";

export function PressureCard({
  pressure,
  expanded,
  onToggle,
  onChange,
  onDelete,
  schema,
  usageMap,
  projectId,
}) {
  const [, setHovering] = useState(false);
  const [editingFactor, setEditingFactor] = useState(null);
  const [addingFactorType, setAddingFactorType] = useState(null);
  const factorModalKey = buildStorageKey(projectId, "pressures:factorModal");

  const handleFieldChange = useCallback(
    (field, value) => {
      onChange({
        ...pressure,
        [field]: value,
      });
    },
    [pressure, onChange]
  );

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(pressure.id, (value) =>
    handleFieldChange("id", value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(pressure.name, (value) =>
    handleFieldChange("name", value)
  );
  const [localDescription, setLocalDescription, handleDescriptionBlur] = useLocalInputState(
    pressure.description || "",
    (value) => handleFieldChange("description", value)
  );

  // Get validation and usage info
  const validation = useMemo(
    () =>
      usageMap
        ? getElementValidation(usageMap, "pressure", pressure.id)
        : { invalidRefs: [], isOrphan: false },
    [usageMap, pressure.id]
  );

  const usage = useMemo(() => {
    if (!usageMap?.pressures?.[pressure.id]) return null;
    return usageMap.pressures[pressure.id];
  }, [usageMap, pressure.id]);

  const hasErrors = validation.invalidRefs.length > 0;
  const isOrphan = validation.isOrphan;
  const usedByCount = usage
    ? (usage.generators?.length || 0) + (usage.systems?.length || 0) + (usage.actions?.length || 0)
    : 0;

  const handleGrowthChange = useCallback(
    (field, value) => {
      onChange({
        ...pressure,
        growth: {
          ...pressure.growth,
          [field]: value,
        },
      });
    },
    [pressure, onChange]
  );

  const persistFactorModal = useCallback(
    (payload) => {
      if (!factorModalKey) return;
      if (payload) {
        saveStoredValue(factorModalKey, payload);
      } else {
        clearStoredValue(factorModalKey);
      }
    },
    [factorModalKey]
  );

  const handleAddFactor = useCallback(
    (feedbackType) => {
      setAddingFactorType(feedbackType);
      persistFactorModal({
        pressureId: pressure.id,
        mode: "add",
        feedbackType,
      });
    },
    [pressure.id, persistFactorModal]
  );

  const handleSaveFactor = useCallback(
    (factor, feedbackType, index) => {
      const feedbackKey = feedbackType === "positive" ? "positiveFeedback" : "negativeFeedback";
      const currentFactors = [...(pressure.growth?.[feedbackKey] || [])];

      if (index !== undefined && index >= 0) {
        currentFactors[index] = factor;
      } else {
        currentFactors.push(factor);
      }

      handleGrowthChange(feedbackKey, currentFactors);
      setEditingFactor(null);
      setAddingFactorType(null);
      persistFactorModal(null);
    },
    [pressure, handleGrowthChange, persistFactorModal]
  );

  const handleEditFactor = useCallback(
    (factor, feedbackType, index) => {
      setEditingFactor({ factor, feedbackType, index });
      persistFactorModal({
        pressureId: pressure.id,
        mode: "edit",
        feedbackType,
        factorIndex: index,
      });
    },
    [pressure.id, persistFactorModal]
  );

  const handleCloseFactorModal = useCallback(() => {
    setEditingFactor(null);
    setAddingFactorType(null);
    persistFactorModal(null);
  }, [persistFactorModal]);

  const handleRemoveFactor = useCallback(
    (feedbackType, index) => {
      const feedbackKey = feedbackType === "positive" ? "positiveFeedback" : "negativeFeedback";
      const newFactors = [...(pressure.growth?.[feedbackKey] || [])];
      newFactors.splice(index, 1);
      handleGrowthChange(feedbackKey, newFactors);
    },
    [pressure, handleGrowthChange]
  );

  const positiveFeedback = pressure.growth?.positiveFeedback || [];
  const negativeFeedback = pressure.growth?.negativeFeedback || [];
  // Compute feedback loop balance status
  const feedbackStatus = useMemo(() => {
    const hasPositive = positiveFeedback.length > 0;
    const hasNegative = negativeFeedback.length > 0;
    const hasHomeostasis = (pressure.homeostasis || 0) !== 0;

    if (!hasPositive && !hasNegative && !hasHomeostasis) {
      return {
        icon: "⚪",
        color: "#9ca3af",
        label: "Static",
        description: "No feedback or homeostasis",
      };
    }
    if (!hasPositive && !hasNegative && hasHomeostasis) {
      return {
        icon: "🧭",
        color: "#22c55e",
        label: "Centering",
        description: "Homeostasis will pull toward equilibrium",
      };
    }
    if (hasPositive && !hasNegative) {
      return {
        icon: "📈",
        color: "#f59e0b",
        label: "Runaway",
        description: "May grow unbounded - consider adding negative feedback",
      };
    }
    if (!hasPositive && hasNegative && !hasHomeostasis) {
      return {
        icon: "📉",
        color: "#3b82f6",
        label: "Diminishing",
        description: "Will trend downward from feedback alone",
      };
    }
    // Both present - self-correcting
    return {
      icon: "⚖️",
      color: "#22c55e",
      label: "Balanced",
      description: "Feedback plus homeostasis provide stabilization",
    };
  }, [positiveFeedback.length, negativeFeedback.length, pressure.homeostasis]);

  // Restore factor modal state from storage (guarded)
  const restoredModalKeyRef = useRef(null);
  useEffect(() => {
    if (!factorModalKey || editingFactor || addingFactorType || restoredModalKeyRef.current === factorModalKey) {
      return;
    }

    restoredModalKeyRef.current = factorModalKey;
    const stored = loadStoredValue(factorModalKey);
    if (!(stored && stored.pressureId === pressure.id)) {
      return;
    }

    if (stored.mode === "add") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted factor modal state
      setAddingFactorType(stored.feedbackType);
      return;
    }

    if (stored.mode === "edit") {
      const feedbackKey =
        stored.feedbackType === "positive" ? "positiveFeedback" : "negativeFeedback";
      const factor = pressure.growth?.[feedbackKey]?.[stored.factorIndex];
      if (factor) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted factor modal state
        setEditingFactor({ factor, feedbackType: stored.feedbackType, index: stored.factorIndex });
      } else {
        clearStoredValue(factorModalKey);
      }
    }
  }, [addingFactorType, editingFactor, factorModalKey, pressure]);

  return (
    <div className="expandable-card">
      <div
        className="expandable-card-header"
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(e); }}
      >
        <div
          className="expandable-card-title pc-title-layout"
        >
          <div className="pc-title-row">
            <span className="expandable-card-name">{pressure.name}</span>
            <span className="expandable-card-id">{pressure.id}</span>
            {hasErrors && (
              <span className="card-error-badge">
                {validation.invalidRefs.length} error
                {validation.invalidRefs.length !== 1 ? "s" : ""}
              </span>
            )}
            {usedByCount > 0 && <span className="card-usage-badge">Used by {usedByCount}</span>}
            {isOrphan && !hasErrors && <span className="card-orphan-badge">Not used</span>}
          </div>
          {pressure.description && (
            <div className="expandable-card-subtitle">{pressure.description}</div>
          )}
        </div>
        <div className="pc-header-right">
          <div className="expandable-card-stats">
            <div className="stat">
              <span className="stat-label">Initial</span>
              <span className="stat-value">{pressure.initialValue}</span>
              <div className="stat-bar">
                <div
                  className="stat-bar-fill pc-stat-bar-fill"
                  // eslint-disable-next-line local/no-inline-styles -- dynamic width from pressure value
                  style={{
                    '--pc-bar-width': `${Math.min(100, Math.max(0, ((pressure.initialValue || 0) + 100) / 2))}%`,
                    width: 'var(--pc-bar-width)',
                  }}
                />
              </div>
            </div>
            <div className="stat">
              <span className="stat-label">Homeostasis</span>
              <span className="stat-value">{pressure.homeostasis}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Factors</span>
              <span className="stat-value">
                <span className="pc-factor-positive">+{positiveFeedback.length}</span>
                {" / "}
                <span className="pc-factor-negative">-{negativeFeedback.length}</span>
              </span>
            </div>
            <div className="stat" title={feedbackStatus.description}>
              <span className="stat-label">Balance</span>
              {/* eslint-disable-next-line local/no-inline-styles -- dynamic feedback color */}
              <span
                className="stat-value pc-balance-value"
                style={{ '--pc-balance-color': feedbackStatus.color, color: 'var(--pc-balance-color)' }}
              >
                <span>{feedbackStatus.icon}</span>
                <span className="pc-balance-label">{feedbackStatus.label}</span>
              </span>
            </div>
          </div>
          <span className={`expand-icon ${expanded ? "expand-icon-open" : ""}`}>▼</span>
        </div>
      </div>

      {expanded && (
        <div className="expandable-card-content">
          {/* Basic Info */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">⚙️</span>
                Basic Configuration
              </div>
            </div>
            <div className="input-grid">
              <div className="input-group">
                <label htmlFor="id" className="label">ID</label>
                <input id="id"
                  type="text"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  onBlur={handleIdBlur}
                  className="input"
                />
              </div>
              <div className="input-group">
                <label htmlFor="pressure-name" className="label">Name</label>
                <input id="pressure-name"
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={handleNameBlur}
                  className="input"
                />
              </div>
              <div className="input-group">
                <label className="label">Initial Value (-100 to 100)
                <NumberInput
                  value={pressure.initialValue}
                  onChange={(v) => handleFieldChange("initialValue", v ?? 0)}
                  min={-100}
                  max={100}
                />
                </label>
              </div>
              <div className="input-group">
                <label className="label">Homeostasis (toward 0)
                <NumberInput
                  value={pressure.homeostasis}
                  onChange={(v) => handleFieldChange("homeostasis", v ?? 0)}
                  min={0}
                />
                </label>
              </div>
            </div>
            <div className="input-grid">
              <div className="input-group grid-col-full">
                <label htmlFor="pressure-description" className="label">Description</label>
                <textarea id="pressure-description"
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  className="input"
                  placeholder="Briefly describe this pressure and what positive/negative values represent"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Positive Feedback */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">📈</span>
                Positive Feedback
                <span className="section-count">{positiveFeedback.length}</span>
              </div>
            </div>
            <div className="nested-card-list">
              {positiveFeedback.length === 0 ? (
                <div className="nested-card-empty">
                  No positive feedback factors. Add factors that increase this pressure.
                </div>
              ) : (
                positiveFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    feedbackType="positive"
                    schema={schema}
                    onEdit={() => handleEditFactor(factor, "positive", index)}
                    onDelete={() => handleRemoveFactor("positive", index)}
                  />
                ))
              )}
              <button className="btn-add-inline" onClick={() => handleAddFactor("positive")}>
                + Add Positive Factor
              </button>
            </div>
          </div>

          {/* Negative Feedback */}
          <div className="section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">📉</span>
                Negative Feedback
                <span className="section-count">{negativeFeedback.length}</span>
              </div>
            </div>
            <div className="nested-card-list">
              {negativeFeedback.length === 0 ? (
                <div className="nested-card-empty">
                  No negative feedback factors. Add factors that decrease this pressure.
                </div>
              ) : (
                negativeFeedback.map((factor, index) => (
                  <FactorCard
                    key={index}
                    factor={factor}
                    feedbackType="negative"
                    schema={schema}
                    onEdit={() => handleEditFactor(factor, "negative", index)}
                    onDelete={() => handleRemoveFactor("negative", index)}
                  />
                ))
              )}
              <button className="btn-add-inline" onClick={() => handleAddFactor("negative")}>
                + Add Negative Factor
              </button>
            </div>
          </div>

          {/* Delete pressure button */}
          <div className="pc-danger-zone">
            <button className="btn btn-danger" onClick={onDelete}>
              Delete Pressure
            </button>
          </div>
        </div>
      )}

      {/* Edit factor modal */}
      {editingFactor && (
        <FactorEditorModal
          isOpen={true}
          onClose={handleCloseFactorModal}
          factor={editingFactor.factor}
          feedbackType={editingFactor.feedbackType}
          schema={schema}
          onChange={(factor) =>
            handleSaveFactor(factor, editingFactor.feedbackType, editingFactor.index)
          }
        />
      )}

      {/* Add factor modal */}
      {addingFactorType && (
        <FactorEditorModal
          isOpen={true}
          onClose={handleCloseFactorModal}
          factor={null}
          feedbackType={addingFactorType}
          schema={schema}
          onChange={(factor) => handleSaveFactor(factor, addingFactorType)}
        />
      )}
    </div>
  );
}

PressureCard.propTypes = {
  pressure: PropTypes.object.isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  schema: PropTypes.object,
  usageMap: PropTypes.object,
  projectId: PropTypes.string,
};
