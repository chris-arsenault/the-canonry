/**
 * CultureEditor - Create and manage cultures with collapsible per-entity-kind axis biases.
 *
 * Schema v2: Each culture has axisBiases keyed by entityKindId, where each
 * contains x, y, z values corresponding to that kind's semantic plane axes.
 */

import React, { useState, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import "./CultureEditor.css";

function KindBiasCard({ culture, kind, axisById, isFramework, handleSliderStart, handleSliderChange, handleSliderEnd, getDisplayValue, draggingRef }) {
  const axes = kind.semanticPlane?.axes || {};
  const biases = culture.axisBiases?.[kind.kind] || { x: 50, y: 50, z: 50 };

  return (
    <div className="cued-kind-card">
      <div className="cued-kind-header">
        <span className="cued-kind-name">{kind.description || kind.kind}</span>
        <span className="cued-kind-summary">
          {biases.x}/{biases.y}/{biases.z}
        </span>
      </div>
      {["x", "y", "z"].map((axis) => {
        const axisRef = axes[axis];
        const axisConfig = axisRef?.axisId
          ? axisById.get(axisRef.axisId)
          : undefined;
        const axisPlaceholder =
          axisRef?.axisId && !axisConfig
            ? `Missing axis (${axisRef.axisId})`
            : "Unassigned";
        const storedValue = biases[axis] ?? 50;
        const displayValue = getDisplayValue(
          culture.id,
          kind.kind,
          axis,
          storedValue
        );

        return (
          <div key={axis} className="cued-axis-row">
            <span className="cued-axis-label">{axis.toUpperCase()}</span>
            <span
              className="cued-tag-label"
              title={axisConfig?.lowTag || axisPlaceholder}
            >
              {axisConfig?.lowTag || "\u2014"}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={displayValue}
              disabled={isFramework}
              onMouseDown={(e) =>
                handleSliderStart(
                  culture.id,
                  kind.kind,
                  axis,
                  e.target.value
                )
              }
              onTouchStart={(e) =>
                handleSliderStart(
                  culture.id,
                  kind.kind,
                  axis,
                  e.target.value
                )
              }
              onChange={(e) => handleSliderChange(e.target.value)}
              onMouseUp={handleSliderEnd}
              onTouchEnd={handleSliderEnd}
              onMouseLeave={() => {
                if (draggingRef.current) handleSliderEnd();
              }}
              className={`cued-slider${isFramework ? " cued-slider-disabled" : ""}`}
            />
            <span
              className="cued-tag-label-right"
              title={axisConfig?.highTag || axisPlaceholder}
            >
              {axisConfig?.highTag || "\u2014"}
            </span>
            <span className="cued-axis-value">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CultureEditor({ project, onSave }) {
  const [expandedCultures, setExpandedCultures] = useState({});
  // Track local slider value during drag to avoid expensive state updates
  const [localSliderValue, setLocalSliderValue] = useState(null);
  const draggingRef = useRef(null); // tracks cultureId, kindId, axis

  const cultures = project?.cultures || [];
  const entityKinds = project?.entityKinds || [];
  const axisDefinitions = useMemo(() => project?.axisDefinitions || [], [project?.axisDefinitions]);
  const axisById = useMemo(() => {
    return new Map(axisDefinitions.map((axis) => [axis.id, axis]));
  }, [axisDefinitions]);

  const toggleCulture = (cultureId) => {
    setExpandedCultures((prev) => ({ ...prev, [cultureId]: !prev[cultureId] }));
  };

  const updateCultures = (newCultures) => {
    onSave({ cultures: newCultures });
  };

  const updateCulture = (cultureId, updates) => {
    const existing = cultures.find((c) => c.id === cultureId);
    if (existing?.isFramework) return;
    updateCultures(cultures.map((c) => (c.id === cultureId ? { ...c, ...updates } : c)));
  };

  const commitAxisBias = (cultureId, kindId, axis, value) => {
    const culture = cultures.find((c) => c.id === cultureId);
    if (!culture) return;

    const kindBiases = culture.axisBiases?.[kindId] || { x: 50, y: 50, z: 50 };

    updateCulture(cultureId, {
      axisBiases: {
        ...culture.axisBiases,
        [kindId]: {
          ...kindBiases,
          [axis]: parseInt(value, 10),
        },
      },
    });
  };

  const handleSliderStart = (cultureId, kindId, axis, value) => {
    draggingRef.current = { cultureId, kindId, axis };
    setLocalSliderValue(parseInt(value, 10));
  };

  const handleSliderChange = (value) => {
    if (draggingRef.current) {
      setLocalSliderValue(parseInt(value, 10));
    }
  };

  const handleSliderEnd = () => {
    if (draggingRef.current && localSliderValue !== null) {
      const { cultureId, kindId, axis } = draggingRef.current;
      commitAxisBias(cultureId, kindId, axis, localSliderValue);
    }
    draggingRef.current = null;
    setLocalSliderValue(null);
  };

  const getDisplayValue = (cultureId, kindId, axis, storedValue) => {
    if (
      draggingRef.current &&
      draggingRef.current.cultureId === cultureId &&
      draggingRef.current.kindId === kindId &&
      draggingRef.current.axis === axis &&
      localSliderValue !== null
    ) {
      return localSliderValue;
    }
    return storedValue;
  };

  const getBiasSummary = (culture) => {
    const biasCount = Object.keys(culture.axisBiases || {}).length;
    return `${biasCount} kind${biasCount !== 1 ? "s" : ""} configured`;
  };

  return (
    <div className="cued-container">
      <div className="cued-header">
        <div className="cued-title">Culture Biases</div>
        <div className="cued-subtitle">
          Configure axis biases for each culture on each entity kind&apos;s semantic plane.
        </div>
      </div>

      {cultures.length === 0 ? (
        <div className="cued-empty-state">
          No cultures defined yet. Add cultures in the Enumerist tab first.
        </div>
      ) : (
        <div className="cued-culture-list">
          {cultures.map((culture) => {
            const isExpanded = expandedCultures[culture.id];
            const isFramework = Boolean(culture.isFramework);

            return (
              <div key={culture.id} className="cued-culture-card">
                <div className="cued-culture-header" onClick={() => toggleCulture(culture.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
                  <div className="cued-culture-header-left">
                    <span
                      className="cued-expand-icon"
                      style={{ '--cued-expand-rotation': isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      ▶
                    </span>
                    <div className="cued-color-dot" style={{ '--cued-color-dot-bg': culture.color }} />
                    <span className="cued-culture-name">{culture.name}</span>
                    <span className="cued-culture-id">({culture.id})</span>
                    {isFramework && (
                      <span className="cued-framework-badge">framework</span>
                    )}
                  </div>
                  <div className="cued-culture-summary">{getBiasSummary(culture)}</div>
                </div>

                {isExpanded && (
                  <div className="cued-culture-body">
                    {entityKinds.length === 0 ? (
                      <div className="cued-no-kinds-warning">
                        Define entity kinds in the Enumerist tab first to configure axis biases.
                      </div>
                    ) : (
                      <div className="cued-kinds-grid">
                        {entityKinds.map((kind) => (
                          <KindBiasCard
                            key={kind.kind}
                            culture={culture}
                            kind={kind}
                            axisById={axisById}
                            isFramework={isFramework}
                            handleSliderStart={handleSliderStart}
                            handleSliderChange={handleSliderChange}
                            handleSliderEnd={handleSliderEnd}
                            getDisplayValue={getDisplayValue}
                            draggingRef={draggingRef}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

KindBiasCard.propTypes = {
  culture: PropTypes.object.isRequired,
  kind: PropTypes.object.isRequired,
  axisById: PropTypes.object.isRequired,
  isFramework: PropTypes.bool.isRequired,
  handleSliderStart: PropTypes.func.isRequired,
  handleSliderChange: PropTypes.func.isRequired,
  handleSliderEnd: PropTypes.func.isRequired,
  getDisplayValue: PropTypes.func.isRequired,
  draggingRef: PropTypes.object.isRequired,
};

CultureEditor.propTypes = {
  project: PropTypes.object,
  onSave: PropTypes.func.isRequired,
};
