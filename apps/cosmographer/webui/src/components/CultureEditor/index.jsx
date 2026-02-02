/**
 * CultureEditor - Create and manage cultures with collapsible per-entity-kind axis biases.
 *
 * Schema v2: Each culture has axisBiases keyed by entityKindId, where each
 * contains x, y, z values corresponding to that kind's semantic plane axes.
 */

import React, { useState, useRef, useMemo } from 'react';

const styles = {
  container: {
    maxWidth: '1200px'
  },
  header: {
    marginBottom: '16px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  subtitle: {
    color: '#888',
    fontSize: '13px'
  },
  cultureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  cultureCard: {
    backgroundColor: '#16213e',
    borderRadius: '6px',
    border: '1px solid #0f3460',
    overflow: 'hidden'
  },
  cultureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer'
  },
  cultureHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  expandIcon: {
    fontSize: '10px',
    color: '#888',
    transition: 'transform 0.2s',
    width: '14px'
  },
  colorDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid #0f3460'
  },
  cultureName: {
    fontWeight: 500,
    fontSize: '14px'
  },
  cultureId: {
    color: '#666',
    fontSize: '11px'
  },
  cultureSummary: {
    fontSize: '11px',
    color: '#666'
  },
  cultureBody: {
    padding: '12px',
    borderTop: '1px solid #0f3460'
  },
  kindsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '8px'
  },
  kindCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    padding: '10px 12px'
  },
  kindHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  kindName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#ccc'
  },
  kindSummary: {
    fontSize: '10px',
    color: '#666'
  },
  axisRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px'
  },
  axisLabel: {
    width: '14px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#e94560'
  },
  tagLabel: {
    fontSize: '9px',
    color: '#666',
    width: '50px',
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  tagLabelRight: {
    fontSize: '9px',
    color: '#666',
    width: '50px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  slider: {
    flex: 1,
    height: '4px',
    WebkitAppearance: 'none',
    background: 'linear-gradient(to right, #0f3460, #e94560)',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer'
  },
  axisValue: {
    width: '24px',
    textAlign: 'right',
    fontSize: '10px',
    color: '#888',
    fontFamily: 'monospace'
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px'
  },
  noKindsWarning: {
    color: '#f0a500',
    fontSize: '12px',
    padding: '12px',
    backgroundColor: 'rgba(240, 165, 0, 0.1)',
    borderRadius: '4px'
  }
};

export default function CultureEditor({ project, onSave }) {
  const [expandedCultures, setExpandedCultures] = useState({});
  // Track local slider value during drag to avoid expensive state updates
  const [localSliderValue, setLocalSliderValue] = useState(null);
  const draggingRef = useRef(null); // { cultureId, kindId, axis }

  const cultures = project?.cultures || [];
  const entityKinds = project?.entityKinds || [];
  const axisDefinitions = project?.axisDefinitions || [];
  const axisById = useMemo(() => {
    return new Map(axisDefinitions.map(axis => [axis.id, axis]));
  }, [axisDefinitions]);

  const toggleCulture = (cultureId) => {
    setExpandedCultures(prev => ({ ...prev, [cultureId]: !prev[cultureId] }));
  };

  const updateCultures = (newCultures) => {
    onSave({ cultures: newCultures });
  };

  const updateCulture = (cultureId, updates) => {
    const existing = cultures.find(c => c.id === cultureId);
    if (existing?.isFramework) return;
    updateCultures(cultures.map(c =>
      c.id === cultureId ? { ...c, ...updates } : c
    ));
  };

  const commitAxisBias = (cultureId, kindId, axis, value) => {
    const culture = cultures.find(c => c.id === cultureId);
    if (!culture) return;

    const kindBiases = culture.axisBiases?.[kindId] || { x: 50, y: 50, z: 50 };

    updateCulture(cultureId, {
      axisBiases: {
        ...culture.axisBiases,
        [kindId]: {
          ...kindBiases,
          [axis]: parseInt(value, 10)
        }
      }
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
    return `${biasCount} kind${biasCount !== 1 ? 's' : ''} configured`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Culture Biases</div>
        <div style={styles.subtitle}>
          Configure axis biases for each culture on each entity kind's semantic plane.
        </div>
      </div>

      {cultures.length === 0 ? (
        <div style={styles.emptyState}>
          No cultures defined yet. Add cultures in the Enumerist tab first.
        </div>
      ) : (
        <div style={styles.cultureList}>
          {cultures.map((culture) => {
            const isExpanded = expandedCultures[culture.id];
            const isFramework = Boolean(culture.isFramework);

            return (
              <div key={culture.id} style={styles.cultureCard}>
                <div
                  style={styles.cultureHeader}
                  onClick={() => toggleCulture(culture.id)}
                >
                  <div style={styles.cultureHeaderLeft}>
                    <span style={{
                      ...styles.expandIcon,
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                    <div style={{ ...styles.colorDot, backgroundColor: culture.color }} />
                    <span style={styles.cultureName}>{culture.name}</span>
                    <span style={styles.cultureId}>({culture.id})</span>
                    {isFramework && (
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>framework</span>
                    )}
                  </div>
                  <div style={styles.cultureSummary}>
                    {getBiasSummary(culture)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.cultureBody}>
                    {entityKinds.length === 0 ? (
                      <div style={styles.noKindsWarning}>
                        Define entity kinds in the Enumerist tab first to configure axis biases.
                      </div>
                    ) : (
                      <div style={styles.kindsGrid}>
                        {entityKinds.map((kind) => {
                          const axes = kind.semanticPlane?.axes || {};
                          const biases = culture.axisBiases?.[kind.kind] || { x: 50, y: 50, z: 50 };

                          return (
                            <div key={kind.kind} style={styles.kindCard}>
                              <div style={styles.kindHeader}>
                                <span style={styles.kindName}>{kind.description || kind.kind}</span>
                                <span style={styles.kindSummary}>
                                  {biases.x}/{biases.y}/{biases.z}
                                </span>
                              </div>
                              {['x', 'y', 'z'].map((axis) => {
                                const axisRef = axes[axis];
                                const axisConfig = axisRef?.axisId ? axisById.get(axisRef.axisId) : undefined;
                                const axisPlaceholder = axisRef?.axisId && !axisConfig
                                  ? `Missing axis (${axisRef.axisId})`
                                  : 'Unassigned';
                                const storedValue = biases[axis] ?? 50;
                                const displayValue = getDisplayValue(culture.id, kind.kind, axis, storedValue);

                                return (
                                  <div key={axis} style={styles.axisRow}>
                                    <span style={styles.axisLabel}>{axis.toUpperCase()}</span>
                                    <span style={styles.tagLabel} title={axisConfig?.lowTag || axisPlaceholder}>
                                      {axisConfig?.lowTag || '—'}
                                    </span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={displayValue}
                                      disabled={isFramework}
                                      onMouseDown={(e) => handleSliderStart(culture.id, kind.kind, axis, e.target.value)}
                                      onTouchStart={(e) => handleSliderStart(culture.id, kind.kind, axis, e.target.value)}
                                      onChange={(e) => handleSliderChange(e.target.value)}
                                      onMouseUp={handleSliderEnd}
                                      onTouchEnd={handleSliderEnd}
                                      onMouseLeave={() => {
                                        if (draggingRef.current) handleSliderEnd();
                                      }}
                                      style={{
                                        ...styles.slider,
                                        opacity: isFramework ? 0.5 : 1,
                                        pointerEvents: isFramework ? 'none' : 'auto'
                                      }}
                                    />
                                    <span style={styles.tagLabelRight} title={axisConfig?.highTag || axisPlaceholder}>
                                      {axisConfig?.highTag || '—'}
                                    </span>
                                    <span style={styles.axisValue}>{displayValue}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
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
