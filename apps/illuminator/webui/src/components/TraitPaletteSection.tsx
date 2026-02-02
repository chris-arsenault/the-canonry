/**
 * TraitPaletteSection - Visual trait palette management
 *
 * Shows existing trait palettes per entity kind and allows
 * manual triggering of palette expansion via LLM through the
 * enrichment queue (so it appears in Activity panel).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPalette,
  exportPalettes,
  type TraitPalette,
  type PaletteItem,
} from '../lib/db/traitRepository';
import type { QueueItem, EnrichmentType } from '../lib/enrichmentTypes';
import type { EnrichedEntity } from '../hooks/useEnrichmentQueue';

interface CultureInfo {
  name: string;
  description?: string;
  visualIdentity?: Record<string, string>;
}

interface EraInfo {
  id: string;
  name: string;
  description?: string;
}

interface TraitPaletteSectionProps {
  projectId: string;
  simulationRunId?: string;
  worldContext: string;
  entityKinds: string[];
  /** Map of entity kind to its subtypes */
  subtypesByKind?: Record<string, string[]>;
  /** Available eras for era-specific categories */
  eras?: EraInfo[];
  /** Cultures with visual identities for grounding palettes in world lore */
  cultures?: CultureInfo[];
  // Queue integration
  enqueue: (items: Array<{
    entity: EnrichedEntity;
    type: EnrichmentType;
    prompt: string;
    paletteEntityKind?: string;
    paletteWorldContext?: string;
    paletteSubtypes?: string[];
    paletteEras?: EraInfo[];
    paletteCultureContext?: CultureInfo[];
  }>) => void;
  queue: QueueItem[];
  isWorkerReady: boolean;
}

export default function TraitPaletteSection({
  projectId,
  simulationRunId,
  worldContext,
  entityKinds: rawEntityKinds = [],
  subtypesByKind = {},
  eras = [],
  cultures = [],
  enqueue,
  queue,
  isWorkerReady,
}: TraitPaletteSectionProps) {
  // Filter to valid, unique entity kinds
  const entityKinds = useMemo(
    () => [...new Set((rawEntityKinds || []).filter(k => k && typeof k === 'string'))],
    // Use joined string as stable key since parent creates new array each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(rawEntityKinds || []).join(',')]
  );

  const [palettes, setPalettes] = useState<Record<string, TraitPalette | null>>({});
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);

  // Stable key for entityKinds to use in dependencies
  const entityKindsKey = entityKinds.join(',');

  // Track which kinds have pending/running tasks
  const expandingKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const item of queue) {
      if (
        item.type === 'paletteExpansion' &&
        item.paletteEntityKind &&
        (item.status === 'queued' || item.status === 'running')
      ) {
        kinds.add(item.paletteEntityKind);
      }
    }
    return kinds;
  }, [queue]);

  // Track completed tasks to refresh palettes
  const completedPaletteTaskIds = useMemo(() => {
    return queue
      .filter(item => item.type === 'paletteExpansion' && item.status === 'complete')
      .map(item => item.id);
  }, [queue]);

  // Load all palettes
  const loadPalettes = useCallback(async () => {
    setLoading(true);
    try {
      const loaded: Record<string, TraitPalette | null> = {};
      for (const kind of entityKinds) {
        loaded[kind] = await getPalette(projectId, kind);
      }
      setPalettes(loaded);
    } catch (err) {
      console.error('Failed to load palettes:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, entityKindsKey]);

  useEffect(() => {
    loadPalettes();
  }, [loadPalettes]);

  // Refresh palettes when a palette expansion task completes
  const lastCompletedRef = useMemo(() => ({ ids: new Set<string>() }), []);
  useEffect(() => {
    const newCompletions = completedPaletteTaskIds.filter(id => !lastCompletedRef.ids.has(id));
    if (newCompletions.length > 0) {
      for (const id of newCompletions) {
        lastCompletedRef.ids.add(id);
      }
      loadPalettes();
    }
  }, [completedPaletteTaskIds, lastCompletedRef, loadPalettes]);

  // Expand palette for a specific kind via queue
  const handleExpand = useCallback((entityKind: string) => {
    if (!isWorkerReady) {
      alert('Worker not ready. Please wait...');
      return;
    }

    // Create a synthetic entity for the queue (palette expansion is not entity-specific)
    const syntheticEntity: EnrichedEntity = {
      id: `palette_${entityKind}`,
      name: `Palette: ${entityKind}`,
      kind: entityKind,
      subtype: '',
      prominence: 'recognized',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };

    // Filter cultures to those with visual identities (more useful for grounding)
    const cultureContext = cultures
      .filter(c => c.name && (c.visualIdentity || c.description))
      .map(c => ({
        name: c.name,
        description: c.description,
        visualIdentity: c.visualIdentity,
      }));

    // Get subtypes for this kind
    const subtypes = subtypesByKind[entityKind] || [];

    enqueue([{
      entity: syntheticEntity,
      type: 'paletteExpansion',
      prompt: '', // Not used - worker builds prompt from paletteEntityKind + paletteWorldContext
      paletteEntityKind: entityKind,
      paletteWorldContext: worldContext || 'A fantasy world with diverse entities.',
      paletteSubtypes: subtypes.length > 0 ? subtypes : undefined,
      paletteEras: eras.length > 0 ? eras : undefined,
      paletteCultureContext: cultureContext.length > 0 ? cultureContext : undefined,
    }]);
  }, [isWorkerReady, enqueue, worldContext, subtypesByKind, eras, cultures]);

  // Export all palettes
  const handleExport = useCallback(async () => {
    try {
      const allPalettes = await exportPalettes(projectId);
      const json = JSON.stringify(allPalettes, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trait-palettes-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export palettes:', err);
      alert('Failed to export palettes');
    }
  }, [projectId]);

  // Count total categories
  const totalCategories = Object.values(palettes).reduce(
    (sum, p) => sum + (p?.items.length || 0),
    0
  );

  // Find recent errors for palette expansion
  const recentErrors = useMemo(() => {
    return queue
      .filter(item =>
        item.type === 'paletteExpansion' &&
        item.status === 'error' &&
        item.paletteEntityKind
      )
      .slice(-3); // Show last 3 errors
  }, [queue]);

  if (loading) {
    return (
      <div className="illuminator-card">
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading trait palettes...
        </div>
      </div>
    );
  }

  if (entityKinds.length === 0) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Trait Palettes</h2>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No entity kinds available. Load a world with entity kinds defined to use trait palettes.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">Trait Palettes</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExport}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
            disabled={totalCategories === 0}
          >
            Export
          </button>
          <button
            onClick={loadPalettes}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Refresh
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Trait palettes provide diverse visual directions for entity descriptions.
        Expand palettes to generate new trait categories and reduce repetition.
      </p>

      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            padding: '10px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 600 }}>{entityKinds.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Entity Kinds</div>
        </div>
        <div
          style={{
            padding: '10px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 600 }}>{totalCategories}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Categories</div>
        </div>
      </div>

      {/* Per-kind palettes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {entityKinds.map((kind) => {
          const palette = palettes[kind];
          const isExpanding = expandingKinds.has(kind);
          const isSelected = selectedKind === kind;

          return (
            <div
              key={kind}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedKind(isSelected ? null : kind)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <code
                    style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      padding: '2px 8px',
                      background: 'var(--accent-color)',
                      color: 'white',
                      borderRadius: '4px',
                    }}
                  >
                    {kind || '(unknown)'}
                  </code>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {palette?.items.length || 0} categories
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!kind) {
                        alert('Invalid entity kind');
                        return;
                      }
                      handleExpand(kind);
                    }}
                    className="illuminator-button illuminator-button-primary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    disabled={isExpanding || !isWorkerReady || !kind}
                    title={!isWorkerReady ? 'Worker not ready' : `Generate trait categories for ${kind}`}
                  >
                    {isExpanding ? 'Expanding...' : 'Expand'}
                  </button>
                  <span
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-muted)',
                      transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {isSelected && (
                <div style={{ padding: '12px' }}>
                  {!palette || palette.items.length === 0 ? (
                    <div
                      style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                      }}
                    >
                      No palette categories yet. Click "Expand Palette" to generate some.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {palette.items.map((item: PaletteItem) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '6px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '6px',
                            }}
                          >
                            <span style={{ fontWeight: 500, fontSize: '13px' }}>
                              {item.category}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 5px',
                                background: item.timesUsed > 0 ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: item.timesUsed > 0 ? 'white' : 'var(--text-muted)',
                                borderRadius: '3px',
                              }}
                            >
                              used {item.timesUsed}x
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              marginBottom: '6px',
                            }}
                          >
                            {item.description}
                          </div>
                          {item.examples.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              <em>Examples:</em> {item.examples.join(' · ')}
                            </div>
                          )}
                          {/* Binding tags: subtypes and era */}
                          {(item.subtypes?.length || item.era) && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                                marginTop: '8px',
                              }}
                            >
                              {item.era && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    background: 'rgba(168, 85, 247, 0.2)',
                                    color: '#a855f7',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                  }}
                                >
                                  era: {item.era}
                                </span>
                              )}
                              {item.subtypes?.map((st) => (
                                <span
                                  key={st}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    color: '#3b82f6',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                  }}
                                >
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show recent errors */}
      {recentErrors.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#ef4444' }}>
            <strong>Recent errors:</strong>
            {recentErrors.map(err => (
              <div key={err.id} style={{ marginTop: '4px' }}>
                {err.paletteEntityKind}: {err.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
