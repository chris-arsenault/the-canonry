/**
 * Template detail panel - shows entity creation details for a selected template event.
 */

import React from "react";
import { getEntityKindColor } from "./traceConstants";
import type { TemplateApplication, CreatedEntity } from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateDetailPanelProps {
  template: TemplateApplication | null;
  isLocked: boolean;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PlacementGridProps {
  entity: CreatedEntity;
}

function PlacementGrid({ entity }: PlacementGridProps) {
  const placement = entity.placement;

  return (
    <div className="lw-trace-view-entity-placement">
      <div className="lw-trace-view-entity-section-label">Placement</div>
      <div className="lw-trace-view-entity-placement-grid">
        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Anchor</span>
          <span className="lw-trace-view-entity-placement-value">
            <span className={`lw-trace-view-anchor-badge ${placement?.anchorType ?? "unknown"}`}>
              {placement?.anchorType ?? entity.placementStrategy}
            </span>
          </span>
        </div>

        <div className="lw-trace-view-entity-placement-row">
          <span className="lw-trace-view-entity-placement-label">Resolved Via</span>
          <span className="lw-trace-view-entity-placement-value">
            <span
              className={`lw-trace-view-resolved-badge ${(placement?.resolvedVia ?? "unknown").replace(/_/g, "-")}`}
            >
              {placement?.resolvedVia ?? entity.placementStrategy}
            </span>
            {placement?.resolvedVia === "random" && (
              <span className="lw-trace-view-fallback-badge">fallback</span>
            )}
          </span>
        </div>

        {placement?.anchorEntity && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Near Entity</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-anchor-entity">
                {placement.anchorEntity.name}
              </span>
              <span className="lw-trace-view-anchor-entity-kind">
                ({placement.anchorEntity.kind})
              </span>
            </span>
          </div>
        )}

        {placement?.anchorCulture && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Culture</span>
            <span className="lw-trace-view-entity-placement-value">
              {placement.anchorCulture}
            </span>
          </div>
        )}

        {(placement?.seedRegionsAvailable?.length ?? 0) > 0 && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Seed Regions</span>
            <span className="lw-trace-view-entity-placement-value">
              {placement!.seedRegionsAvailable!.length} available
            </span>
          </div>
        )}

        {placement?.emergentRegionCreated && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Emergent Region</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-emergent-badge">
                + {placement.emergentRegionCreated.label}
              </span>
            </span>
          </div>
        )}

        {entity.coordinates && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Coordinates</span>
            <span className="lw-trace-view-entity-placement-value mono">
              ({entity.coordinates.x.toFixed(1)}, {entity.coordinates.y.toFixed(1)},{" "}
              {entity.coordinates.z?.toFixed(1) ?? "0.0"})
            </span>
          </div>
        )}

        {entity.regionId && (
          <div className="lw-trace-view-entity-placement-row">
            <span className="lw-trace-view-entity-placement-label">Region</span>
            <span className="lw-trace-view-entity-placement-value">
              <span className="lw-trace-view-region-badge">{entity.regionId}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface TagSectionProps {
  tags: Record<string, string | boolean>;
  label: string;
  cssClass: string;
  tagModifier?: string;
}

function TagSection({ tags, label, cssClass, tagModifier }: TagSectionProps) {
  const entries = Object.entries(tags);
  if (entries.length === 0) return null;

  return (
    <div className={cssClass}>
      <div className="lw-trace-view-entity-section-label">{label}</div>
      <div className="lw-trace-view-entity-tags">
        {entries.map(([tag, val]) => (
          <span key={tag} className={`lw-trace-view-tag ${tagModifier ?? ""}`}>
            {tag}
            {val !== true ? `:${val}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

interface EntityCardProps {
  entity: CreatedEntity;
}

function EntityCard({ entity }: EntityCardProps) {
  return (
    <div className="lw-trace-view-entity-card">
      <div className="lw-trace-view-entity-identity">
        <span className="lw-trace-view-entity-name">{entity.name}</span>
        <span className="lw-trace-view-entity-kind">
          {entity.kind}/{entity.subtype}
        </span>
      </div>

      <div className="lw-trace-view-entity-attrs">
        <div className="lw-trace-view-entity-attr">
          <span className="lw-trace-view-entity-attr-label">Culture</span>
          <span className="lw-trace-view-entity-attr-value">{entity.culture}</span>
        </div>
        <div className="lw-trace-view-entity-attr">
          <span className="lw-trace-view-entity-attr-label">Prominence</span>
          <span className="lw-trace-view-entity-attr-value">{entity.prominence}</span>
        </div>
      </div>

      <PlacementGrid entity={entity} />

      <TagSection
        tags={entity.tags ?? {}}
        label="Tags"
        cssClass="lw-trace-view-entity-tag-group"
      />
      <TagSection
        tags={entity.derivedTags ?? {}}
        label="Derived from Placement"
        cssClass="lw-trace-view-entity-derived-group"
        tagModifier="derived"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TemplateDetailPanel({
  template,
  isLocked,
  onClear,
}: TemplateDetailPanelProps) {
  if (!template) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">{"\u25B2"}</div>
          <div>Hover over a template icon to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const app = template;
  const firstEntityKind = app.entitiesCreated?.[0]?.kind ?? null;
  const markerColor = getEntityKindColor(firstEntityKind);

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span
            className="st-detail-marker"
            style={{ "--st-marker-color": markerColor } as React.CSSProperties}
          >
            {"\u25B2"}
          </span>
          Tick {app.tick} / Epoch {app.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{app.templateId}</span>
            <span className="lw-trace-view-template-target">
              to {app.targetEntityName} ({app.targetEntityKind})
            </span>
          </div>

          {app.description && (
            <div className="lw-trace-view-template-desc">{app.description}</div>
          )}

          {(app.entitiesCreated?.length ?? 0) > 0 && (
            <div className="lw-trace-view-template-entities">
              <div className="lw-trace-view-detail-sub-header">
                Entities Created ({app.entitiesCreated!.length})
              </div>
              {app.entitiesCreated!.map((entity, j) => (
                <EntityCard key={j} entity={entity} />
              ))}
            </div>
          )}

          {(app.relationshipsCreated?.length ?? 0) > 0 && (
            <div className="lw-trace-view-template-rels">
              <div className="lw-trace-view-detail-sub-header">
                Relationships ({app.relationshipsCreated!.length})
              </div>
              {app.relationshipsCreated!.slice(0, 5).map((rel, j) => (
                <div key={j} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-rel-kind">{rel.kind}</span>
                  <span className="lw-trace-view-rel-ids">
                    {rel.srcId?.slice(0, 8)}... {"\u2192"} {rel.dstId?.slice(0, 8)}...
                  </span>
                </div>
              ))}
              {app.relationshipsCreated!.length > 5 && (
                <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                  +{app.relationshipsCreated!.length - 5} more
                </div>
              )}
            </div>
          )}

          {Object.keys(app.pressureChanges ?? {}).length > 0 && (
            <div className="lw-trace-view-template-pressures">
              <div className="lw-trace-view-detail-sub-header">Pressure Changes</div>
              {Object.entries(app.pressureChanges!).map(([pressureId, delta]) => (
                <div key={pressureId} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-detail-label">{pressureId}</span>
                  <span className={delta >= 0 ? "positive" : "negative"}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
