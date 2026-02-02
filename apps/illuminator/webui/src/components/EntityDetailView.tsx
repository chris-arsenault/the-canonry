/**
 * EntityDetailView - Inline entity detail panel (replaces EntityDetailsModal lightbox)
 *
 * Two-column layout: main content (left) + metadata sidebar (right).
 * Rendered inside EntityBrowser, replacing the entity list when an entity is selected.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QueueItem, NetworkDebugInfo, DescriptionChainDebug, ChronicleBackref } from '../lib/enrichmentTypes';
import HistorianMarginNotes from './HistorianMarginNotes';
import HistorianToneSelector from './HistorianToneSelector';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  type ProminenceScale,
} from '@canonry/world-schema';
import BackrefImageEditor from './BackrefImageEditor';

interface EntityEnrichment {
  text?: {
    aliases: string[];
    visualThesis?: string;
    visualTraits: string[];
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    debug?: NetworkDebugInfo;
    chainDebug?: DescriptionChainDebug;
  };
  image?: {
    imageId: string;
    generatedAt: number;
    model: string;
  };
  chronicleBackrefs?: ChronicleBackref[];
  descriptionHistory?: Array<{
    description: string;
    source?: string;
    replacedAt?: number;
  }>;
}

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: number;
  culture?: string;
  status: string;
  summary?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  enrichment?: EntityEnrichment;
}

interface EntityDetailViewProps {
  entity: Entity;
  entities: Entity[];
  queue: QueueItem[];
  onBack: () => void;
  prominenceScale?: ProminenceScale;
  onUpdateBackrefs?: (entityId: string, backrefs: ChronicleBackref[]) => void;
  onUndoDescription?: (entityId: string) => void;
  onCopyEdit?: (entityId: string) => void;
  isCopyEditActive?: boolean;
  onHistorianReview?: (entityId: string, tone: string) => void;
  isHistorianActive?: boolean;
  historianConfigured?: boolean;
  onUpdateHistorianNote?: (targetType: string, targetId: string, noteId: string, updates: Record<string, unknown>) => void;
  onRename?: (entityId: string) => void;
  onPatchEvents?: (entityId: string) => void;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}

function formatCost(cost: number | undefined): string {
  if (!cost) return 'N/A';
  return `$${cost.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Sidebar sub-components
// ---------------------------------------------------------------------------

function MetadataRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function ExpandableSection({ title, content, charCount }: { title: string; content: string | undefined; charCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return null;

  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '6px 10px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '10px', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {charCount !== undefined && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{charCount} chars</span>
        )}
      </button>
      {expanded && (
        <div style={{
          marginTop: '6px',
          padding: '10px',
          background: 'var(--bg-primary)',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content sub-components
// ---------------------------------------------------------------------------

function VisualTraitsList({ traits }: { traits: string[] }) {
  if (!traits || traits.length === 0) return null;
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Visual Traits
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {traits.map((trait, i) => (
          <span
            key={i}
            style={{
              padding: '4px 10px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
          >
            {trait}
          </span>
        ))}
      </div>
    </div>
  );
}

function AliasesList({ aliases }: { aliases: string[] }) {
  if (!aliases || aliases.length === 0) return null;
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Aliases
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {aliases.map((alias, i) => (
          <span
            key={i}
            style={{
              padding: '4px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            {alias}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityDetailView
// ---------------------------------------------------------------------------

export default function EntityDetailView({
  entity,
  entities,
  queue,
  onBack,
  prominenceScale,
  onUpdateBackrefs,
  onUndoDescription,
  onCopyEdit,
  isCopyEditActive,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  onUpdateHistorianNote,
  onRename,
  onPatchEvents,
}: EntityDetailViewProps) {
  const effectiveProminenceScale = useMemo(() => {
    if (prominenceScale) return prominenceScale;
    return buildProminenceScale([], { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [prominenceScale]);

  const enrichment = entity.enrichment;
  const textEnrichment = enrichment?.text;

  // Chain debug (narrative -> thesis -> traits)
  const chainDebug: DescriptionChainDebug | undefined = textEnrichment?.chainDebug;

  // Legacy single debug
  let legacyDebug: NetworkDebugInfo | undefined = textEnrichment?.debug;
  if (!legacyDebug && !chainDebug) {
    const descriptionQueueItem = queue.find(
      (item) => item.entityId === entity.id && item.type === 'description' && item.debug
    );
    legacyDebug = descriptionQueueItem?.debug;
  }

  // Escape key goes back
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    },
    [onBack]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Description history
  const historyLen = enrichment?.descriptionHistory?.length || 0;
  const lastEntry = historyLen > 0 ? enrichment!.descriptionHistory![historyLen - 1] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {entity.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {entity.kind}/{entity.subtype} · {prominenceLabelFromScale(entity.prominence, effectiveProminenceScale)}
            {entity.culture && ` · ${entity.culture}`}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Esc to go back
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>
          {/* Summary */}
          {entity.summary && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Summary
              </div>
              <p style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.6', margin: 0 }}>
                {entity.summary}
              </p>
            </div>
          )}

          {/* Visual Thesis */}
          {textEnrichment?.visualThesis && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(139, 92, 246, 0.8)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Visual Thesis
              </div>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-primary)',
                lineHeight: '1.6',
                margin: 0,
                padding: '12px 16px',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px',
                fontStyle: 'italic',
              }}>
                {textEnrichment.visualThesis}
              </p>
            </div>
          )}

          {/* Full Description */}
          {entity.description && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Full Description
                {historyLen > 0 && (
                  <span style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '10px', opacity: 0.7 }}>
                    v{historyLen + 1} ({historyLen} previous)
                  </span>
                )}
                {historyLen > 0 && onUndoDescription && (
                  <button
                    onClick={() => onUndoDescription(entity.id)}
                    title={`Revert to previous version (from ${lastEntry?.source || 'unknown'}, ${lastEntry?.replacedAt ? new Date(lastEntry.replacedAt).toLocaleDateString() : 'unknown'})`}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    ↩ Undo
                  </button>
                )}
                {onCopyEdit && (
                  <button
                    onClick={() => onCopyEdit(entity.id)}
                    disabled={isCopyEditActive}
                    title="Run a readability copy edit on this description"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: isCopyEditActive ? 'var(--text-muted)' : 'var(--text-secondary)',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      cursor: isCopyEditActive ? 'not-allowed' : 'pointer',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      opacity: isCopyEditActive ? 0.5 : 1,
                    }}
                  >
                    Copy Edit
                  </button>
                )}
                {onRename && (
                  <button
                    onClick={() => onRename(entity.id)}
                    title="Rename this entity with full propagation across all references"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    Rename
                  </button>
                )}
                {onPatchEvents && (
                  <button
                    onClick={() => onPatchEvents(entity.id)}
                    title="Repair stale names in narrative event history for this entity"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    Patch Events
                  </button>
                )}
                {onHistorianReview && historianConfigured && (
                  <HistorianToneSelector
                    onSelect={(tone: string) => onHistorianReview(entity.id, tone)}
                    disabled={isHistorianActive}
                    hasNotes={enrichment?.historianNotes && enrichment.historianNotes.length > 0}
                  />
                )}
              </div>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: '1.7',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {entity.description}
              </p>
              {enrichment?.historianNotes && enrichment.historianNotes.length > 0 && (
                <HistorianMarginNotes
                  notes={enrichment.historianNotes}
                  sourceText={entity.description}
                  style={{ marginTop: '12px' }}
                  onUpdateNote={onUpdateHistorianNote
                    ? (noteId: string, updates: Record<string, unknown>) => onUpdateHistorianNote('entity', entity.id, noteId, updates)
                    : undefined}
                />
              )}
            </div>
          )}

          {/* Visual Traits */}
          <VisualTraitsList traits={textEnrichment?.visualTraits || []} />

          {/* Aliases */}
          <AliasesList aliases={textEnrichment?.aliases || []} />

          {/* Chronicle Images */}
          {onUpdateBackrefs && enrichment?.chronicleBackrefs && enrichment.chronicleBackrefs.length > 0 && (
            <>
              <div style={{
                borderTop: '1px solid var(--border-color)',
                margin: '8px 0 16px 0',
              }} />
              <BackrefImageEditor
                entity={entity}
                entities={entities}
                onUpdateBackrefs={onUpdateBackrefs}
                alwaysExpanded
              />
            </>
          )}

          {/* No enrichment fallback */}
          {!(entity.summary || entity.description) && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No description enrichment available. Queue a description task for this entity.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: '320px',
            flexShrink: 0,
            borderLeft: '1px solid var(--border-color)',
            overflowY: 'auto',
            padding: '20px 16px',
            background: 'var(--bg-secondary)',
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            Entity Metadata
          </h4>

          {/* Basic info */}
          <MetadataRow label="Entity ID" value={entity.id} />
          <MetadataRow label="Status" value={entity.status} />
          <MetadataRow label="Created" value={formatDate(entity.createdAt)} />
          <MetadataRow label="Updated" value={formatDate(entity.updatedAt)} />

          {/* Description generation info */}
          {textEnrichment && (
            <>
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Description Generation
              </div>
              <MetadataRow label="Model" value={textEnrichment.model} />
              <MetadataRow label="Generated" value={formatDate(textEnrichment.generatedAt)} />
              <MetadataRow label="Estimated Cost" value={formatCost(textEnrichment.estimatedCost)} />
              <MetadataRow label="Actual Cost" value={formatCost(textEnrichment.actualCost)} />
              {textEnrichment.inputTokens !== undefined && (
                <MetadataRow
                  label="Tokens"
                  value={`${textEnrichment.inputTokens} in / ${textEnrichment.outputTokens || 0} out`}
                />
              )}
            </>
          )}

          {/* Debug Info */}
          {(chainDebug || legacyDebug) && (
            <>
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Debug Info
              </div>

              {chainDebug && (
                <>
                  {chainDebug.narrative && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(59, 130, 246, 0.8)', marginBottom: '4px', fontWeight: 500 }}>
                        Step 1: Narrative
                      </div>
                      <ExpandableSection title="Request" content={chainDebug.narrative.request} charCount={chainDebug.narrative.request?.length} />
                      <ExpandableSection title="Response" content={chainDebug.narrative.response} charCount={chainDebug.narrative.response?.length} />
                    </div>
                  )}
                  {chainDebug.thesis && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(139, 92, 246, 0.8)', marginBottom: '4px', fontWeight: 500 }}>
                        Step 2: Visual Thesis
                      </div>
                      <ExpandableSection title="Request" content={chainDebug.thesis.request} charCount={chainDebug.thesis.request?.length} />
                      <ExpandableSection title="Response" content={chainDebug.thesis.response} charCount={chainDebug.thesis.response?.length} />
                    </div>
                  )}
                  {chainDebug.traits && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(34, 197, 94, 0.8)', marginBottom: '4px', fontWeight: 500 }}>
                        Step 3: Visual Traits
                      </div>
                      <ExpandableSection title="Request" content={chainDebug.traits.request} charCount={chainDebug.traits.request?.length} />
                      <ExpandableSection title="Response" content={chainDebug.traits.response} charCount={chainDebug.traits.response?.length} />
                    </div>
                  )}
                </>
              )}

              {!chainDebug && legacyDebug && (
                <>
                  <ExpandableSection title="Request" content={legacyDebug.request} charCount={legacyDebug.request?.length} />
                  <ExpandableSection title="Response" content={legacyDebug.response} charCount={legacyDebug.response?.length} />
                </>
              )}
            </>
          )}

          {!chainDebug && !legacyDebug && textEnrichment && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '12px' }}>
              Debug info not available. This entity may have been enriched before debug persistence was added.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
