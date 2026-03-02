/**
 * CultureEditor - Create and manage cultures with collapsible per-entity-kind axis biases.
 *
 * Schema v2: Each culture has axisBiases keyed by entityKindId, where each
 * contains x, y, z values corresponding to that kind's semantic plane axes.
 */

import React, { useRef, useMemo, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { useExpandSet } from "@the-canonry/shared-components";
import "./CultureEditor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AxisDefData {
  id: string;
  name: string;
  lowTag: string;
  highTag: string;
}

interface AxisBiasValues {
  x: number;
  y: number;
  z: number;
}

interface CultureData {
  id: string;
  name: string;
  color: Optional<string>;
  isFramework: Optional<boolean>;
  axisBiases: Optional<Record<string, AxisBiasValues>>;
}

interface EntityKindData {
  kind: string;
  description: Optional<string>;
  semanticPlane: Optional<{
    axes: Optional<Record<string, { axisId: Optional<string> }>>;
  }>;
}

interface CultureEditorProject {
  cultures: Optional<CultureData[]>;
  entityKinds: Optional<EntityKindData[]>;
  axisDefinitions: Optional<AxisDefData[]>;
}

interface DraggingState {
  cultureId: string;
  kindId: string;
  axis: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ResolvedAxisRow {
  lowLabel: string;
  lowTitle: string;
  highLabel: string;
  highTitle: string;
}

function resolveAxisRow(
  axes: Optional<Record<string, { axisId: Optional<string> }>>,
  axis: string,
  axisById: Map<string, AxisDefData>,
): ResolvedAxisRow {
  const axisRef = axes?.[axis];
  const axisConfig = axisRef?.axisId ? axisById.get(axisRef.axisId) : undefined;
  if (axisConfig) {
    return { lowLabel: axisConfig.lowTag, lowTitle: axisConfig.lowTag, highLabel: axisConfig.highTag, highTitle: axisConfig.highTag };
  }
  const placeholder = axisRef?.axisId ? `Missing axis (${axisRef.axisId})` : "Unassigned";
  return { lowLabel: "\u2014", lowTitle: placeholder, highLabel: "\u2014", highTitle: placeholder };
}

// ---------------------------------------------------------------------------
// KindBiasCard
// ---------------------------------------------------------------------------

interface KindBiasCardProps {
  culture: CultureData;
  kind: EntityKindData;
  axisById: Map<string, AxisDefData>;
  isFramework: boolean;
  handleSliderStart: (cultureId: string, kindId: string, axis: string, value: string) => void;
  handleSliderChange: (value: string) => void;
  handleSliderEnd: () => void;
  getDisplayValue: (cultureId: string, kindId: string, axis: string, storedValue: number) => number;
  draggingRef: React.RefObject<DraggingState | null>;
}

function KindBiasCard({ culture, kind, axisById, isFramework, handleSliderStart, handleSliderChange, handleSliderEnd, getDisplayValue, draggingRef }: Readonly<KindBiasCardProps>) {
  const axes = kind.semanticPlane?.axes;
  const biases = culture.axisBiases?.[kind.kind] || { x: 50, y: 50, z: 50 };

  return (
    <div className="cued-kind-card">
      <div className="cued-kind-header">
        <span className="cued-kind-name">{kind.description || kind.kind}</span>
        <span className="cued-kind-summary">
          {biases.x}/{biases.y}/{biases.z}
        </span>
      </div>
      {(["x", "y", "z"] as const).map((axis) => {
        const resolved = resolveAxisRow(axes, axis, axisById);
        const storedValue = biases[axis] ?? 50;
        const displayValue = getDisplayValue(culture.id, kind.kind, axis, storedValue);

        return (
          <div key={axis} className="cued-axis-row">
            <span className="cued-axis-label">{axis.toUpperCase()}</span>
            <span className="cued-tag-label" title={resolved.lowTitle}>
              {resolved.lowLabel}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={displayValue}
              disabled={isFramework}
              onMouseDown={(e) => handleSliderStart(culture.id, kind.kind, axis, (e.target as HTMLInputElement).value)}
              onTouchStart={(e) => handleSliderStart(culture.id, kind.kind, axis, (e.target as HTMLInputElement).value)}
              onChange={(e) => handleSliderChange(e.target.value)}
              onMouseUp={handleSliderEnd}
              onTouchEnd={handleSliderEnd}
              onMouseLeave={() => { if (draggingRef.current) handleSliderEnd(); }}
              className={`cued-slider${isFramework ? " cued-slider-disabled" : ""}`}
            />
            <span className="cued-tag-label-right" title={resolved.highTitle}>
              {resolved.highLabel}
            </span>
            <span className="cued-axis-value">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CultureEditor
// ---------------------------------------------------------------------------

interface CultureEditorProps {
  project: CultureEditorProject;
  onSave: (updates: Partial<CultureEditorProject>) => void;
}

// eslint-disable-next-line max-lines-per-function -- editor managing culture list with collapsible axis bias cards; line count from JSX structure per culture card
export default function CultureEditor({ project, onSave }: Readonly<CultureEditorProps>) {
  const { expanded: expandedCultures, toggle: toggleCulture } = useExpandSet();
  const [localSliderValue, setLocalSliderValue] = React.useState<number | null>(null);
  const draggingRef = useRef<DraggingState | null>(null);

  const cultures = useMemo(() => project?.cultures || [], [project?.cultures]);
  const entityKinds = useMemo(() => project?.entityKinds || [], [project?.entityKinds]);
  const axisDefinitions = useMemo(() => project?.axisDefinitions || [], [project?.axisDefinitions]);
  const axisById = useMemo(() => new Map(axisDefinitions.map((axis) => [axis.id, axis])), [axisDefinitions]);

  const updateCultures = useCallback(
    (newCultures: CultureData[]) => onSave({ cultures: newCultures }),
    [onSave],
  );

  const updateCulture = useCallback(
    (cultureId: string, updates: Partial<CultureData>) => {
      const existing = cultures.find((c) => c.id === cultureId);
      if (existing?.isFramework) return;
      updateCultures(cultures.map((c) => (c.id === cultureId ? { ...c, ...updates } : c)));
    },
    [cultures, updateCultures],
  );

  const commitAxisBias = useCallback(
    (cultureId: string, kindId: string, axis: string, value: number) => {
      const culture = cultures.find((c) => c.id === cultureId);
      if (!culture) return;
      const kindBiases = culture.axisBiases?.[kindId] || { x: 50, y: 50, z: 50 };
      updateCulture(cultureId, {
        axisBiases: { ...culture.axisBiases, [kindId]: { ...kindBiases, [axis]: value } },
      });
    },
    [cultures, updateCulture],
  );

  const handleSliderStart = useCallback((cultureId: string, kindId: string, axis: string, value: string) => {
    draggingRef.current = { cultureId, kindId, axis };
    setLocalSliderValue(parseInt(value, 10));
  }, []);

  const handleSliderChange = useCallback((value: string) => {
    if (draggingRef.current) setLocalSliderValue(parseInt(value, 10));
  }, []);

  const handleSliderEnd = useCallback(() => {
    if (draggingRef.current && localSliderValue !== null) {
      const { cultureId, kindId, axis } = draggingRef.current;
      commitAxisBias(cultureId, kindId, axis, localSliderValue);
    }
    draggingRef.current = null;
    setLocalSliderValue(null);
  }, [localSliderValue, commitAxisBias]);

  const getDisplayValue = useCallback(
    (cultureId: string, kindId: string, axis: string, storedValue: number): number => {
      const d = draggingRef.current;
      if (d && d.cultureId === cultureId && d.kindId === kindId && d.axis === axis && localSliderValue !== null) {
        return localSliderValue;
      }
      return storedValue;
    },
    [localSliderValue],
  );

  const getBiasSummary = useCallback((culture: CultureData) => {
    const biasCount = Object.keys(culture.axisBiases || {}).length;
    return `${biasCount} kind${biasCount !== 1 ? "s" : ""} configured`;
  }, []);

  return (
    <div className="cued-container">
      <div className="cued-header">
        <div className="cued-title">Culture Biases</div>
        <div className="cued-subtitle">
          Configure axis biases for each culture on each entity kind&apos;s semantic plane.
        </div>
      </div>

      {cultures.length === 0 ? (
        <div className="viewer-empty-state">
          No cultures defined yet. Add cultures in the Enumerist tab first.
        </div>
      ) : (
        <div className="cued-culture-list">
          {cultures.map((culture) => {
            const isExpanded = expandedCultures.has(culture.id);
            const isFramework = Boolean(culture.isFramework);

            return (
              <div key={culture.id} className="cued-culture-card">
                <div
                  className="cued-culture-header"
                  onClick={() => toggleCulture(culture.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <div className="cued-culture-header-left">
                    <span
                      className="viewer-expand-icon"
                      style={{ '--cued-expand-rotation': isExpanded ? "rotate(90deg)" : "rotate(0deg)" } as React.CSSProperties}
                    >
                      ▶
                    </span>
                    <div className="cued-color-dot" style={{ '--cued-color-dot-bg': culture.color } as React.CSSProperties} />
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
