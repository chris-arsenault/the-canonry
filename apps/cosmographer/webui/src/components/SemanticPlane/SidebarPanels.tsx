/**
 * SidebarPanels - Axis, Region, and Entity sidebar panels for the semantic plane editor.
 */

import React, { useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  SemanticPlaneData,
  AxisDefinition,
  Region,
  Culture,
  SeedEntity,
  EntityKind,
} from "./types.ts";
import { resolveAxis, AXIS_KEYS } from "./types.ts";

// ---------------------------------------------------------------------------
// AxisSidebar
// ---------------------------------------------------------------------------

interface AxisSidebarProps {
  semanticPlane: SemanticPlaneData;
  axisDefinitions: AxisDefinition[];
  isFrameworkKind: boolean;
  onEditAxis: (axisKey: string) => void;
}

export function AxisSidebar({ semanticPlane, axisDefinitions, isFrameworkKind, onEditAxis }: Readonly<AxisSidebarProps>) {
  return (
    <div>
      <div className="sp-sidebar-title">Axes (click to edit)</div>
      {AXIS_KEYS.map((axis) => {
        const rawConfig = semanticPlane.axes?.[axis];
        const resolved = resolveAxis(rawConfig, axisDefinitions);
        return (
          <div
            key={axis}
            className={`sp-axis-info${isFrameworkKind ? " sp-axis-info-disabled" : " sp-axis-info-interactive"}`}
            onClick={() => onEditAxis(axis)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <span className="sp-axis-label">{axis.toUpperCase()}</span>
            {resolved ? (
              <>
                <span className="sp-axis-name">{resolved.name}</span>
                <span className="sp-axis-range">
                  {resolved.lowTag} → {resolved.highTag}
                </span>
              </>
            ) : (
              <span className="sp-axis-unset">(not set)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RegionSidebar
// ---------------------------------------------------------------------------

interface RegionSidebarProps {
  regions: Region[];
  cultures: Culture[];
  selectedRegionId: string | null;
  isFrameworkKind: boolean;
  onSelectRegion: (regionId: string) => void;
  onEditRegion: (region: Region) => void;
  onDeleteRegion: (regionId: string) => void;
}

export function RegionSidebar({
  regions,
  cultures,
  selectedRegionId,
  isFrameworkKind,
  onSelectRegion,
  onEditRegion,
  onDeleteRegion,
}: Readonly<RegionSidebarProps>) {
  return (
    <div>
      <div className="sp-sidebar-title">Regions ({regions.length})</div>
      {regions.length === 0 ? (
        <div className="sp-empty-text">No regions defined</div>
      ) : (
        regions.map((region) => (
          <div
            key={region.id}
            className={`sp-region-item${selectedRegionId === region.id ? " sp-region-item-selected" : ""}`}
            onClick={() => onSelectRegion(region.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <div className="sp-region-row">
              <div className="sp-region-color" style={{ '--sp-region-color-bg': region.color } as React.CSSProperties} />
              <div className="sp-region-info">
                <span className="sp-region-label">{region.label}</span>
                {region.culture && (
                  <div className="sp-region-culture">
                    {cultures.find((c) => c.id === region.culture)?.name || region.culture}
                  </div>
                )}
              </div>
              <button
                className={`sp-region-edit-btn${isFrameworkKind ? " sp-region-edit-btn-disabled" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRegion(region);
                }}
                title="Edit region"
                disabled={isFrameworkKind}
              >
                ✎
              </button>
              <button
                className={`sp-delete-button${isFrameworkKind ? " sp-delete-button-disabled" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRegion(region.id);
                }}
                title="Delete region"
                disabled={isFrameworkKind}
              >
                ×
              </button>
            </div>
            {region.tags && region.tags.length > 0 && (
              <div className="sp-region-tags">
                {region.tags.map((tag) => (
                  <span key={tag} className="sp-region-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntitySidebar
// ---------------------------------------------------------------------------

interface EntitySidebarProps {
  entities: SeedEntity[];
  cultures: Culture[];
  selectedKind: Optional<EntityKind>;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}

export function EntitySidebar({
  entities,
  cultures,
  selectedKind,
  selectedEntityId,
  onSelectEntity,
}: Readonly<EntitySidebarProps>) {
  const getCultureColor = useCallback(
    (cultureId: string) => cultures.find((c) => c.id === cultureId)?.color || "#888",
    [cultures],
  );

  return (
    <div>
      <div className="sp-sidebar-title">Entities ({entities.length})</div>
      {entities.length === 0 ? (
        <div className="sp-empty-text">
          No {selectedKind?.description || selectedKind?.kind || "entities"} yet
        </div>
      ) : (
        <>
          {entities.slice(0, 15).map((entity) => (
            <div
              key={entity.id}
              className={`sp-entity-item${selectedEntityId === entity.id ? " sp-entity-item-selected" : ""}`}
              onClick={() => onSelectEntity(entity.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              <div
                className="sp-entity-dot"
                style={{ '--sp-entity-dot-bg': getCultureColor(entity.culture) } as React.CSSProperties}
              />
              <span className="sp-entity-name">{entity.name}</span>
              <span className="sp-entity-coords">
                ({Math.round(entity.coordinates?.x || 0)},{" "}
                {Math.round(entity.coordinates?.y || 0)})
              </span>
            </div>
          ))}
          {entities.length > 15 && (
            <div className="sp-more-text">
              +{entities.length - 15} more
            </div>
          )}
        </>
      )}
    </div>
  );
}
