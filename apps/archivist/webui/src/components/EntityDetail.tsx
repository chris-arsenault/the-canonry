import { useState } from 'react';
import type { WorldState, LoreData, DescriptionLore, RelationshipBackstoryLore, ChainLinkLore, DiscoveryEventLore, Region } from '../types/world.ts';
import { getEntityById, getRelatedEntities, getRelationships, getTagsArray } from '../utils/dataTransform.ts';
import { useImageUrl } from '@penguin-tales/image-store';
import LoreSection from './LoreSection.tsx';
import RelationshipStoryModal from './RelationshipStoryModal.tsx';
import ChainLinkSection from './ChainLinkSection.tsx';
import DiscoveryStory from './DiscoveryStory.tsx';
import './EntityDetail.css';
import { prominenceLabelFromScale, type ProminenceScale } from '@canonry/world-schema';

interface EntityDetailProps {
  entityId?: string;
  worldData: WorldState;
  loreData: LoreData | null;
  onRelatedClick: (entityId: string) => void;
  prominenceScale: ProminenceScale;
}

// Parse selection ID - returns { type: 'entity', id } or { type: 'region', entityKind, regionId }
function parseSelectionId(selectionId: string): { type: 'entity'; id: string } | { type: 'region'; entityKind: string; regionId: string } {
  if (selectionId.startsWith('region:')) {
    const parts = selectionId.split(':');
    return { type: 'region', entityKind: parts[1], regionId: parts[2] };
  }
  return { type: 'entity', id: selectionId };
}

// Find a region by entityKind and regionId
function findRegion(worldData: WorldState, entityKind: string, regionId: string): Region | undefined {
  const kindDef = worldData.schema.entityKinds.find(kind => kind.kind === entityKind);
  if (!kindDef?.semanticPlane) {
    throw new Error(`Archivist: entity kind "${entityKind}" is missing semanticPlane.`);
  }
  const seedRegions = kindDef.semanticPlane.regions;
  const emergentRegions = worldData.coordinateState?.emergentRegions?.[entityKind] ?? [];
  return [...seedRegions, ...emergentRegions].find(region => region.id === regionId);
}

// Region detail component
function RegionDetail({ region, entityKind, worldData }: { region: Region; entityKind: string; worldData: WorldState }) {
  const culture = region.culture
    ? worldData.schema.cultures.find(c => c.id === region.culture)
    : undefined;

  return (
    <div className="entity-detail">
      {/* Header */}
      <div className="entity-detail-header">
        <h2 className="entity-detail-name">{region.label}</h2>
        <div className="entity-detail-badges">
          <span className={`entity-badge ${region.emergent ? 'entity-badge-emergent' : ''}`}>
            {region.emergent ? 'Emergent' : 'Seed'} Region
          </span>
          <span className="entity-badge entity-badge-kind">{entityKind}</span>
          {culture && (
            <span className="entity-badge entity-badge-culture" style={{ borderColor: culture.color, color: culture.color }}>
              {culture.name}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {region.description && (
        <div className="detail-card">
          <div className="section-header">Description</div>
          <p className="detail-card-content" style={{ fontSize: '13px', color: '#bfdbfe', margin: 0 }}>
            {region.description}
          </p>
        </div>
      )}

      {/* Region Properties */}
      <div className="entity-meta-grid">
        {region.bounds.shape === 'circle' && (
          <>
            <div className="entity-meta-item">
              <span className="entity-meta-label">Radius</span>
              <span className="entity-meta-value">{region.bounds.radius.toFixed(1)}</span>
            </div>
            <div className="entity-meta-item">
              <span className="entity-meta-label">Center X</span>
              <span className="entity-meta-value">{region.bounds.center.x.toFixed(1)}</span>
            </div>
            <div className="entity-meta-item">
              <span className="entity-meta-label">Center Y</span>
              <span className="entity-meta-value">{region.bounds.center.y.toFixed(1)}</span>
            </div>
          </>
        )}
      {region.emergent && region.createdAt !== undefined && (
        <div className="entity-meta-item">
          <span className="entity-meta-label">Created</span>
          <span className="entity-meta-value">Tick {region.createdAt}</span>
        </div>
      )}
      </div>

      {/* Tags */}
      {region.tags && region.tags.length > 0 && (
        <div className="entity-tags-section">
          <div className="section-header">Tags</div>
          <div className="tags-container">
            {region.tags.map((tag: string) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EntityDetail({
  entityId,
  worldData,
  loreData,
  onRelatedClick,
  prominenceScale
}: EntityDetailProps) {
  // Hooks must be called before any early returns
  const [selectedRelationshipLore, setSelectedRelationshipLore] = useState<RelationshipBackstoryLore | null>(null);
  const [expandedOutgoing, setExpandedOutgoing] = useState<Set<string>>(new Set());
  const [expandedIncoming, setExpandedIncoming] = useState<Set<string>>(new Set());

  // Look up entity to get imageId for the hook (must be before early returns)
  const selection = entityId ? parseSelectionId(entityId) : null;
  const entityForImage = selection?.type === 'entity' ? getEntityById(worldData, selection.id) : null;
  const imageId = entityForImage?.enrichment?.image?.imageId;
  const { url: imageUrl } = useImageUrl(imageId);

  if (!entityId) {
    return (
      <div className="entity-detail empty">
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))' }}>👈</div>
          <div className="text-blue-300 font-medium">Select a node to view details</div>
        </div>
      </div>
    );
  }

  // selection is guaranteed non-null here because entityId is truthy
  const sel = selection!;

  if (sel.type === 'region') {
    const region = findRegion(worldData, sel.entityKind, sel.regionId);
    if (!region) {
      return (
        <div className="entity-detail">
          <div className="text-red-400 font-medium">Region not found</div>
        </div>
      );
    }
    return <RegionDetail region={region} entityKind={sel.entityKind} worldData={worldData} />;
  }

  const entity = getEntityById(worldData, sel.id);

  if (!entity) {
    return (
      <div className="entity-detail">
        <div className="text-red-400 font-medium">Entity not found</div>
      </div>
    );
  }

  const prominenceLabel = prominenceLabelFromScale(entity.prominence, prominenceScale);

  const relatedEntities = getRelatedEntities(worldData, entityId);
  const relationships = getRelationships(worldData, entityId);

  // Look up culture info
  const entityCulture = entity.culture
    ? worldData.schema.cultures.find(c => c.id === entity.culture)
    : undefined;

  // Find lore for this entity
  const descriptionLore = loreData?.records.find(
    record => record.type === 'description' && record.targetId === entityId
  ) as DescriptionLore | undefined;

  const chainLinkLore = loreData?.records.find(
    record => record.type === 'chain_link' && record.targetId === entityId
  ) as ChainLinkLore | undefined;

  const discoveryEventLore = loreData?.records.find(
    record => record.type === 'discovery_event' && record.targetId === entityId
  ) as DiscoveryEventLore | undefined;

  // Image URL loaded via useImageUrl hook (called above, before early returns)

  // Helper to find relationship lore
  const findRelationshipLore = (srcId: string, dstId: string, kind: string): RelationshipBackstoryLore | undefined => {
    return loreData?.records.find(
      record => {
        if (record.type !== 'relationship_backstory') return false;
        const relLore = record as RelationshipBackstoryLore;
        return relLore.relationship.src === srcId &&
               relLore.relationship.dst === dstId &&
               relLore.relationship.kind === kind;
      }
    ) as RelationshipBackstoryLore | undefined;
  };

  const outgoingRels = relationships.filter(r => r.src === entityId);
  const incomingRels = relationships.filter(r => r.dst === entityId);

  // Debug: Check if distance is present
  const relsWithDistance = relationships.filter(r => r.distance !== undefined);
  if (relsWithDistance.length > 0) {
    console.log(`Entity ${entityId} has ${relsWithDistance.length} relationships with distance:`, relsWithDistance[0]);
  }

  const getRelatedEntity = (relId: string) => getEntityById(worldData, relId);

  // Group relationships by kind
  const groupByKind = (rels: typeof relationships) => {
    const groups = new Map<string, typeof relationships>();
    rels.forEach(rel => {
      const kind = rel.kind;
      if (!groups.has(kind)) {
        groups.set(kind, []);
      }
      groups.get(kind)!.push(rel);
    });
    return groups;
  };

  const outgoingGroups = groupByKind(outgoingRels);
  const incomingGroups = groupByKind(incomingRels);

  const toggleOutgoing = (kind: string) => {
    const newExpanded = new Set(expandedOutgoing);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedOutgoing(newExpanded);
  };

  const toggleIncoming = (kind: string) => {
    const newExpanded = new Set(expandedIncoming);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedIncoming(newExpanded);
  };

  return (
    <div className="entity-detail">
      {/* Header */}
      <div className="entity-detail-header">
        <h2 className="entity-detail-name">{entity.name}</h2>
        <div className="entity-detail-badges">
          <span className={`entity-badge prominence-${prominenceLabel}`}>
            {prominenceLabel}
          </span>
          <span className="entity-badge entity-badge-kind">{entity.kind}</span>
          <span className="entity-badge entity-badge-subtype">{entity.subtype}</span>
          {entityCulture && (
            <span className="entity-badge entity-badge-culture" style={{ borderColor: entityCulture.color, color: entityCulture.color }}>
              {entityCulture.name}
            </span>
          )}
        </div>
      </div>

      {/* Entity Image */}
      {imageUrl && (
        <div className="mb-6">
          <div className="entity-image-container">
            <img
              src={imageUrl}
              alt={entity.name}
              className="entity-image"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Summary or Lore */}
      {descriptionLore ? (
        <LoreSection lore={descriptionLore} />
      ) : (
        <div className="detail-card">
          <div className="section-header">
            Summary
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('canonry:navigate', {
                  detail: { tab: 'chronicler', pageId: entity.id }
                }));
              }}
              className="chronicler-link"
              title="View full article in Chronicler"
            >
              (view in chronicler)
            </button>
          </div>
          <p className="text-sm text-blue-100 leading-relaxed break-words detail-card-content">
            {(entity as any).summary || 'No summary available'}
          </p>
        </div>
      )}

      {/* Chain Link */}
      {chainLinkLore && <ChainLinkSection lore={chainLinkLore} />}

      {/* Discovery Story */}
      {discoveryEventLore && (
        <DiscoveryStory
          lore={discoveryEventLore}
          onExplorerClick={onRelatedClick}
        />
      )}

      {/* Status & Timeline */}
      <div className="entity-meta-grid">
        <div className="entity-meta-item">
          <span className="entity-meta-label">Status</span>
          <span className="entity-meta-value">{entity.status}</span>
        </div>
        <div className="entity-meta-item">
          <span className="entity-meta-label">Created</span>
          <span className="entity-meta-value">Tick {entity.createdAt}</span>
        </div>
        <div className="entity-meta-item">
          <span className="entity-meta-label">Updated</span>
          <span className="entity-meta-value">Tick {entity.updatedAt}</span>
        </div>
      </div>

      {/* Tags */}
      {getTagsArray(entity.tags).length > 0 && (
        <div className="entity-tags-section">
          <div className="section-header">Tags</div>
          <div className="tags-container">
            {getTagsArray(entity.tags).map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Relationships */}
      {outgoingRels.length > 0 && (
        <div className="mb-6">
          <div className="section-header">
            Relationships ({outgoingRels.length})
          </div>
          <div className="accordion-container">
            {Array.from(outgoingGroups.entries()).map(([kind, rels]) => {
              const isExpanded = expandedOutgoing.has(kind);
              return (
                <div key={kind} className="accordion-item">
                  <button onClick={() => toggleOutgoing(kind)} className="accordion-header">
                    <div className="accordion-header-left">
                      <span className="accordion-icon">{isExpanded ? '−' : '+'}</span>
                      <span className="accordion-title">{kind.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="accordion-badge">{rels.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="accordion-content">
                      {rels.map((rel, i) => {
                        const target = getRelatedEntity(rel.dst);
                        const relLore = findRelationshipLore(rel.src, rel.dst, rel.kind);
                        const strength = rel.strength ?? 0.5;
                        const distance = rel.distance;
                        const isHistorical = rel.status === 'historical';
                        return target ? (
                          <div key={i} className={`accordion-row ${i % 2 === 0 ? 'even' : 'odd'} ${isHistorical ? 'historical' : ''}`}>
                            <button
                              onClick={() => onRelatedClick(target.id)}
                              className="accordion-row-button"
                              style={isHistorical ? { opacity: 0.6 } : undefined}
                            >
                              <div className="accordion-row-name">
                                {isHistorical && <span style={{ color: '#9ca3af', marginRight: '0.5rem' }}>📜</span>}
                                {target.name}
                              </div>
                              <div className="accordion-row-kind">
                                ({target.kind}) <span style={{ color: isHistorical ? '#9ca3af' : '#93c5fd', fontWeight: 'bold' }}>
                                  [S:{strength.toFixed(2)}{distance !== undefined ? ` D:${distance.toFixed(2)}` : ''}]
                                </span>
                                {isHistorical && rel.archivedAt && (
                                  <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                    archived @{rel.archivedAt}
                                  </span>
                                )}
                              </div>
                            </button>
                            {relLore && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRelationshipLore(relLore);
                                }}
                                className="lore-indicator"
                                title="View relationship story"
                              >
                                📜
                              </button>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming Relationships */}
      {incomingRels.length > 0 && (
        <div className="mb-6">
          <div className="section-header">
            Referenced By ({incomingRels.length})
          </div>
          <div className="accordion-container">
            {Array.from(incomingGroups.entries()).map(([kind, rels]) => {
              const isExpanded = expandedIncoming.has(kind);
              return (
                <div key={kind} className="accordion-item incoming">
                  <button onClick={() => toggleIncoming(kind)} className="accordion-header">
                    <div className="accordion-header-left">
                      <span className="accordion-icon">{isExpanded ? '−' : '+'}</span>
                      <span className="accordion-title">{kind.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="accordion-badge">{rels.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="accordion-content">
                      {rels.map((rel, i) => {
                        const source = getRelatedEntity(rel.src);
                        const relLore = findRelationshipLore(rel.src, rel.dst, rel.kind);
                        const strength = rel.strength ?? 0.5;
                        const distance = rel.distance;
                        const isHistorical = rel.status === 'historical';
                        return source ? (
                          <div key={i} className={`accordion-row ${i % 2 === 0 ? 'even' : 'odd'} ${isHistorical ? 'historical' : ''}`}>
                            <button
                              onClick={() => onRelatedClick(source.id)}
                              className="accordion-row-button"
                              style={isHistorical ? { opacity: 0.6 } : undefined}
                            >
                              <div className="accordion-row-name">
                                {isHistorical && <span style={{ color: '#9ca3af', marginRight: '0.5rem' }}>📜</span>}
                                {source.name}
                              </div>
                              <div className="accordion-row-kind">
                                ({source.kind}) <span style={{ color: isHistorical ? '#9ca3af' : '#93c5fd', fontWeight: 'bold' }}>
                                  [S:{strength.toFixed(2)}{distance !== undefined ? ` D:${distance.toFixed(2)}` : ''}]
                                </span>
                                {isHistorical && rel.archivedAt && (
                                  <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                    archived @{rel.archivedAt}
                                  </span>
                                )}
                              </div>
                            </button>
                            {relLore && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRelationshipLore(relLore);
                                }}
                                className="lore-indicator"
                                title="View relationship story"
                              >
                                📜
                              </button>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection Summary */}
      <div className="pt-6 border-t border-blue-500-20">
        <div className="section-header">Connection Summary</div>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Connections</div>
            <div className="summary-value">{relationships.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Entities</div>
            <div className="summary-value">{relatedEntities.length}</div>
          </div>
        </div>
      </div>

      {/* Relationship Story Modal */}
      {selectedRelationshipLore && (
        <RelationshipStoryModal
          lore={selectedRelationshipLore}
          worldData={worldData}
          onClose={() => setSelectedRelationshipLore(null)}
        />
      )}
    </div>
  );
}
