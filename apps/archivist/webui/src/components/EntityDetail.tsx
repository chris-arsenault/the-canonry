import React, { useState, useCallback } from "react";
import type {
  WorldState,
  LoreData,
  HardState,
  Relationship,
  DescriptionLore,
  RelationshipBackstoryLore,
  ChainLinkLore,
  DiscoveryEventLore,
  Region,
} from "../types/world.ts";
import {
  getEntityById,
  getRelatedEntities,
  getRelationships,
  getTagsArray,
} from "../utils/dataTransform.ts";
import { useImageUrl } from "@the-canonry/image-store";
import { useExpandSet } from "@the-canonry/shared-components";
import LoreSection from "./LoreSection.tsx";
import RelationshipStoryModal from "./RelationshipStoryModal.tsx";
import ChainLinkSection from "./ChainLinkSection.tsx";
import DiscoveryStory from "./DiscoveryStory.tsx";
import "./archivist-section.css";
import "./EntityDetail.css";
import { prominenceLabelFromScale, type ProminenceScale } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";

interface EntityDetailProps {
  entityId: Optional<string>;
  worldData: WorldState;
  loreData: LoreData | null;
  onRelatedClick: (entityId: string) => void;
  prominenceScale: ProminenceScale;
}

// Parse selection ID - returns { type: 'entity', id } or { type: 'region', entityKind, regionId }
function parseSelectionId(
  selectionId: string
): { type: "entity"; id: string } | { type: "region"; entityKind: string; regionId: string } {
  if (selectionId.startsWith("region:")) {
    const parts = selectionId.split(":");
    return { type: "region", entityKind: parts[1], regionId: parts[2] };
  }
  return { type: "entity", id: selectionId };
}

// Find a region by entityKind and regionId
function findRegion(
  worldData: WorldState,
  entityKind: string,
  regionId: string
): Region | undefined {
  const kindDef = worldData.schema.entityKinds.find((kind) => kind.kind === entityKind);
  if (!kindDef?.semanticPlane) {
    throw new Error(`Archivist: entity kind "${entityKind}" is missing semanticPlane.`);
  }
  const seedRegions = kindDef.semanticPlane.regions;
  const emergentRegions = worldData.coordinateState?.emergentRegions?.[entityKind] ?? [];
  return [...seedRegions, ...emergentRegions].find((region) => region.id === regionId);
}

function MetaItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="entity-meta-item">
      <span className="entity-meta-label">{label}</span>
      <span className="entity-meta-value">{value}</span>
    </div>
  );
}

// eslint-disable-next-line complexity -- conditional JSX sections (badges, description, bounds, tags) each add a branch but are independent visual concerns
function RegionDetail({ region, entityKind, worldData }: Readonly<{ region: Region; entityKind: string; worldData: WorldState }>) {
  const culture = region.culture ? worldData.schema.cultures.find((c) => c.id === region.culture) : undefined;
  const circleBounds = region.bounds.shape === "circle" ? region.bounds : null;
  return (
    <div className="entity-detail">
      <div className="entity-detail-header">
        <h2 className="entity-detail-name">{region.label}</h2>
        <div className="entity-detail-badges">
          <span className={`entity-badge ${region.emergent ? "entity-badge-emergent" : ""}`}>{region.emergent ? "Emergent" : "Seed"} Region</span>
          <span className="entity-badge entity-badge-kind">{entityKind}</span>
          {culture && <span className="entity-badge entity-badge-culture ed-culture-badge" style={{ '--ed-culture-color': culture.color } as React.CSSProperties}>{culture.name}</span>}
        </div>
      </div>
      {region.description && <div className="detail-card"><div className="section-header">Description</div><p className="detail-card-content ed-region-description">{region.description}</p></div>}
      <div className="entity-meta-grid">
        {circleBounds && <><MetaItem label="Radius" value={circleBounds.radius.toFixed(1)} /><MetaItem label="Center X" value={circleBounds.center.x.toFixed(1)} /><MetaItem label="Center Y" value={circleBounds.center.y.toFixed(1)} /></>}
        {region.emergent && region.createdAt !== undefined && <MetaItem label="Created" value={`Tick ${region.createdAt}`} />}
      </div>
      {region.tags && region.tags.length > 0 && <div className="entity-tags-block"><div className="section-header">Tags</div><div className="tags-container">{region.tags.map((tag: string) => <span key={tag} className="tag">{tag}</span>)}</div></div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared relationship rendering
// ---------------------------------------------------------------------------

function RelationshipRow({ rel, entity, relLore, onRelatedClick, onShowLore }: Readonly<{
  rel: Relationship; entity: HardState; relLore: Optional<RelationshipBackstoryLore>;
  onRelatedClick: (id: string) => void; onShowLore: (lore: RelationshipBackstoryLore) => void;
}>) {
  const strength = rel.strength ?? 0.5;
  const isHistorical = rel.status === "historical";
  return (
    <div className={`accordion-row ${isHistorical ? "historical" : ""}`}>
      <button onClick={() => onRelatedClick(entity.id)} className={`accordion-row-button ${isHistorical ? "ed-row-historical" : ""}`}>
        <div className="accordion-row-name">{isHistorical && <span className="ed-historical-icon">📜</span>}{entity.name}</div>
        <div className="accordion-row-kind">
          ({entity.kind}) <span className={isHistorical ? "ed-rel-metric-historical" : "ed-rel-metric"}>[S:{strength.toFixed(2)}{rel.distance !== undefined ? ` D:${rel.distance.toFixed(2)}` : ""}]</span>
          {isHistorical && rel.archivedAt && <span className="ed-archived-label">archived @{rel.archivedAt}</span>}
        </div>
      </button>
      {relLore && <button onClick={(e) => { e.stopPropagation(); onShowLore(relLore); }} className="lore-indicator" title="View relationship story">📜</button>}
    </div>
  );
}

function RelationshipAccordion({ title, groups, expanded, onToggle, resolveEntity, findLore, onRelatedClick, onShowLore, className }: Readonly<{
  title: string; groups: Map<string, Relationship[]>; expanded: Set<string>;
  onToggle: (kind: string) => void; resolveEntity: (id: string) => HardState | undefined;
  findLore: (src: string, dst: string, kind: string) => RelationshipBackstoryLore | undefined;
  onRelatedClick: (id: string) => void; onShowLore: (lore: RelationshipBackstoryLore) => void;
  className: string;
}>) {
  const totalCount = Array.from(groups.values()).reduce((sum, rels) => sum + rels.length, 0);
  if (totalCount === 0) return null;
  return (
    <div className="mb-6">
      <div className="section-header">{title} ({totalCount})</div>
      <div className="accordion-container">
        {Array.from(groups.entries()).map(([kind, rels]) => {
          const isExpanded = expanded.has(kind);
          return (
            <div key={kind} className={`accordion-item ${className}`}>
              <button onClick={() => onToggle(kind)} className="accordion-header">
                <div className="accordion-header-left">
                  <span className="accordion-icon">{isExpanded ? "−" : "+"}</span>
                  <span className="accordion-title">{kind.replace(/_/g, " ")}</span>
                </div>
                <span className="accordion-badge">{rels.length}</span>
              </button>
              {isExpanded && <div className="accordion-content">
                {rels.map((rel) => {
                  const peer = resolveEntity(className === "incoming" ? rel.src : rel.dst);
                  const relLore = findLore(rel.src, rel.dst, rel.kind);
                  return peer ? <RelationshipRow key={`${rel.src}-${rel.dst}-${rel.kind}`} rel={rel} entity={peer} relLore={relLore} onRelatedClick={onRelatedClick} onShowLore={onShowLore} /> : null;
                })}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity lookup helpers
// ---------------------------------------------------------------------------

function findLoreRecord<T>(loreData: LoreData | null, type: string, targetId: string): T | undefined {
  return loreData?.records.find((r) => r.type === type && r.targetId === targetId) as T | undefined;
}

function findRelationshipLore(loreData: LoreData | null, src: string, dst: string, kind: string): RelationshipBackstoryLore | undefined {
  return loreData?.records.find((r) => r.type === "relationship_backstory" && r.relationship.src === src && r.relationship.dst === dst && r.relationship.kind === kind) as RelationshipBackstoryLore | undefined;
}

function groupByKind(rels: Relationship[]): Map<string, Relationship[]> {
  const groups = new Map<string, Relationship[]>();
  for (const rel of rels) {
    const arr = groups.get(rel.kind);
    if (arr) { arr.push(rel); } else { groups.set(rel.kind, [rel]); }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- renders 8 optional detail sections (image, lore, chain-link, discovery, tags, etc.) with independent visibility guards
export default function EntityDetail({ entityId, worldData, loreData, onRelatedClick, prominenceScale }: Readonly<EntityDetailProps>) {
  const [selectedRelationshipLore, setSelectedRelationshipLore] = useState<RelationshipBackstoryLore | null>(null);
  const clearRelationshipLore = useCallback(() => setSelectedRelationshipLore(null), []);
  const expandOutgoing = useExpandSet();
  const expandIncoming = useExpandSet();

  const selection = entityId ? parseSelectionId(entityId) : null;
  const entityForImage = selection?.type === "entity" ? getEntityById(worldData, selection.id) : null;
  const { url: imageUrl } = useImageUrl(entityForImage?.enrichment?.image?.imageId);
  const onShowLore = useCallback((lore: RelationshipBackstoryLore) => setSelectedRelationshipLore(lore), []);
  const resolveLore = useCallback((src: string, dst: string, kind: string) => findRelationshipLore(loreData, src, dst, kind), [loreData]);
  const resolveEntity = useCallback((id: string) => getEntityById(worldData, id), [worldData]);

  if (!entityId) {
    return <div className="entity-detail empty"><div className="text-center"><div className="text-5xl mb-4 ed-empty-icon">👈</div><div className="text-blue-300 font-medium">Select a node to view details</div></div></div>;
  }

  const sel = selection!;
  if (sel.type === "region") {
    const region = findRegion(worldData, sel.entityKind, sel.regionId);
    if (!region) return <div className="entity-detail"><div className="text-red-400 font-medium">Region not found</div></div>;
    return <RegionDetail region={region} entityKind={sel.entityKind} worldData={worldData} />;
  }

  const entity = getEntityById(worldData, sel.id);
  if (!entity) return <div className="entity-detail"><div className="text-red-400 font-medium">Entity not found</div></div>;

  const prominenceLabel = prominenceLabelFromScale(entity.prominence, prominenceScale);
  const relationships = getRelationships(worldData, entityId);
  const relatedEntities = getRelatedEntities(worldData, entityId);
  const entityCulture = entity.culture ? worldData.schema.cultures.find((c) => c.id === entity.culture) : undefined;
  const descriptionLore = findLoreRecord<DescriptionLore>(loreData, "description", entityId);
  const chainLinkLore = findLoreRecord<ChainLinkLore>(loreData, "chain_link", entityId);
  const discoveryEventLore = findLoreRecord<DiscoveryEventLore>(loreData, "discovery_event", entityId);
  const outgoingGroups = groupByKind(relationships.filter((r) => r.src === entityId));
  const incomingGroups = groupByKind(relationships.filter((r) => r.dst === entityId));
  const tags = getTagsArray(entity.tags);

  return (
    <div className="entity-detail">
      <div className="entity-detail-header">
        <h2 className="entity-detail-name">{entity.name}</h2>
        <div className="entity-detail-badges">
          <span className={`entity-badge prominence-${prominenceLabel}`}>{prominenceLabel}</span>
          <span className="entity-badge entity-badge-kind">{entity.kind}</span>
          <span className="entity-badge entity-badge-subtype">{entity.subtype}</span>
          {entityCulture && <span className="entity-badge entity-badge-culture ed-culture-badge" style={{ '--ed-culture-color': entityCulture.color } as React.CSSProperties}>{entityCulture.name}</span>}
        </div>
      </div>
      {imageUrl && <div className="mb-6"><div className="entity-image-container"><img src={imageUrl} alt={entity.name} className="entity-image" loading="lazy" /></div></div>}
      {descriptionLore ? <LoreSection lore={descriptionLore} /> : (
        <div className="detail-card">
          <div className="section-header">Summary<button onClick={() => { window.dispatchEvent(new CustomEvent("canonry:navigate", { detail: { tab: "chronicler", pageId: entity.id } })); }} className="chronicler-link" title="View full article in Chronicler">(view in chronicler)</button></div>
          <p className="text-sm text-blue-100 leading-relaxed break-words detail-card-content">{entity.summary || "No summary available"}</p>
        </div>
      )}
      {chainLinkLore && <ChainLinkSection lore={chainLinkLore} />}
      {discoveryEventLore && <DiscoveryStory lore={discoveryEventLore} onExplorerClick={onRelatedClick} />}
      <div className="entity-meta-grid">
        <MetaItem label="Status" value={entity.status} />
        <MetaItem label="Created" value={`Tick ${entity.createdAt}`} />
        <MetaItem label="Updated" value={`Tick ${entity.updatedAt}`} />
      </div>
      {tags.length > 0 && <div className="entity-tags-block"><div className="section-header">Tags</div><div className="tags-container">{tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div></div>}
      <RelationshipAccordion title="Relationships" groups={outgoingGroups} expanded={expandOutgoing.expanded} onToggle={expandOutgoing.toggle} resolveEntity={resolveEntity} findLore={resolveLore} onRelatedClick={onRelatedClick} onShowLore={onShowLore} className="" />
      <RelationshipAccordion title="Referenced By" groups={incomingGroups} expanded={expandIncoming.expanded} onToggle={expandIncoming.toggle} resolveEntity={resolveEntity} findLore={resolveLore} onRelatedClick={onRelatedClick} onShowLore={onShowLore} className="incoming" />
      <div className="pt-6 border-t border-blue-500-20">
        <div className="section-header">Connection Summary</div>
        <div className="summary-grid">
          <div className="summary-card"><div className="summary-label">Connections</div><div className="summary-value">{relationships.length}</div></div>
          <div className="summary-card"><div className="summary-label">Entities</div><div className="summary-value">{relatedEntities.length}</div></div>
        </div>
      </div>
      {selectedRelationshipLore && <RelationshipStoryModal lore={selectedRelationshipLore} worldData={worldData} onClose={clearRelationshipLore} />}
    </div>
  );
}
