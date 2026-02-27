/**
 * RoleAssignmentStep - Step 3: Assign entities to roles
 *
 * Features the Ensemble Constellation visualization:
 * - Graph showing candidates around entry point
 * - Role slots for click-to-assign workflow
 * - Entity detail card for selected entity
 * - Ensemble health bar showing diversity
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type {
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
  RoleDefinition,
} from "@canonry/world-schema";
import type { NarrativeLens } from "../../../lib/chronicleTypes";
import { useWizard } from "../WizardContext";
import {
  validateRoleAssignments,
  type EntitySelectionMetrics,
} from "../../../lib/chronicle/selectionWizard";
import { getEntityUsageStats } from "../../../lib/db/chronicleRepository";
import { getEraRanges } from "../../../lib/chronicle/timelineUtils";
import {
  EnsembleConstellation,
  RoleSlot,
  EntityDetailCard,
  EnsembleHealthBar,
  FilterChips,
} from "../visualizations";
import "./RoleAssignmentStep.css";

/** Get roles from either story or document style */
function getRoles(style: { format: string } | null | undefined): RoleDefinition[] {
  if (!style) return [];
  if (style.format === "story") {
    return (style as StoryNarrativeStyle).roles || [];
  }
  const docStyle = style as DocumentNarrativeStyle;
  return docStyle.roles || [];
}

function resolveEntityEraId(entity: { eraId?: string } | null): string | undefined {
  if (!entity) return undefined;
  return typeof entity.eraId === "string" && entity.eraId ? entity.eraId : undefined;
}

export default function RoleAssignmentStep() {
  const {
    state,
    eras,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    setLens,
    clearLens,
    computeMetrics,
    simulationRunId,
  } = useWizard();

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<Map<string, { usageCount: number }>>(new Map());
  const [metricsMap, setMetricsMap] = useState<Map<string, EntitySelectionMetrics>>(new Map());
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [selectedEras, setSelectedEras] = useState<Set<string>>(new Set());
  const [connectionFilter, setConnectionFilter] = useState<string | null>(null);

  const style = state.narrativeStyle;
  const roles = getRoles(style);
  const maxCastSize = 10;

  // Load usage stats on mount
  useEffect(() => {
    if (!simulationRunId) {
      throw new Error("[Chronicle Wizard] simulationRunId is required to load entity usage stats.");
    }
    getEntityUsageStats(simulationRunId)
      .then((stats) => {
        setUsageStats(stats);
      })
      .catch((err) => {
        console.error("[Chronicle Wizard] Failed to load entity usage stats:", err);
      });
  }, [simulationRunId]);

  const metricsKey = `${state.candidates.length}|${state.entryPointId}|${usageStats.size}|${state.roleAssignments.length}`;
  useEffect(() => {
    if (state.candidates.length === 0 || !state.entryPointId) return;
    const metrics = computeMetrics(usageStats);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recompute local metrics cache when candidate inputs change
    setMetricsMap(metrics);
  }, [metricsKey, state.candidates.length, state.entryPointId, usageStats]);

  // Get assigned entity IDs
  const assignedEntityIds = useMemo(() => {
    return new Set(state.roleAssignments.map((a) => a.entityId));
  }, [state.roleAssignments]);

  // Validation
  const validation = useMemo(() => {
    if (!roles.length) return { valid: true, errors: [], warnings: [] };
    return validateRoleAssignments(state.roleAssignments, roles, maxCastSize);
  }, [state.roleAssignments, roles, maxCastSize]);

  // Get selected entity details
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    return state.candidates.find((e) => e.id === selectedEntityId) || null;
  }, [selectedEntityId, state.candidates]);

  const selectedMetrics = useMemo(() => {
    if (!selectedEntityId) return undefined;
    return metricsMap.get(selectedEntityId);
  }, [selectedEntityId, metricsMap]);

  // Era color map: eraId -> hex color (same palette as timeline)
  const eraColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const range of getEraRanges(eras)) {
      map.set(range.id, range.color);
    }
    return map;
  }, [eras]);

  // Get era name and color for selected entity
  const selectedEntityEra = useMemo(() => {
    if (!selectedEntity || eras.length === 0) return undefined;
    const entityEraId = resolveEntityEraId(selectedEntity);
    const era = entityEraId ? eras.find((e) => e.id === entityEraId) : undefined;
    if (!era) return undefined;
    return { name: era.name, color: eraColorMap.get(era.id) };
  }, [selectedEntity, eras, eraColorMap]);

  // Handle role assignment
  const handleAssignToRole = useCallback(
    (roleId: string) => {
      if (!selectedEntityId) return;

      const entity = state.candidates.find((e) => e.id === selectedEntityId);
      if (!entity) return;

      addRoleAssignment({
        role: roleId,
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        isPrimary: false,
      });

      setSelectedEntityId(null);
    },
    [selectedEntityId, state.candidates, addRoleAssignment]
  );

  // Handle remove from role
  const handleRemoveFromRole = useCallback(
    (entityId: string, roleId: string) => {
      removeRoleAssignment(entityId, roleId);
    },
    [removeRoleAssignment]
  );

  // Build kind-to-category map
  const kindToCategory = useMemo(() => {
    const map = new Map<string, string>();
    // Simple mapping - could be domain-specific
    for (const candidate of state.candidates) {
      map.set(candidate.kind, candidate.kind);
    }
    return map;
  }, [state.candidates]);

  const handleSetLens = useCallback(
    (entity: { id: string; name: string; kind: string }) => {
      const lens: NarrativeLens = {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
      };
      setLens(lens);
    },
    [setLens]
  );

  // Get available kinds for filter chips
  const availableKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const candidate of state.candidates) {
      kinds.add(candidate.kind);
    }
    return Array.from(kinds).sort((a, b) => a.localeCompare(b));
  }, [state.candidates]);

  // Available eras from candidates (in era order, only eras with entities)
  const availableEras = useMemo(() => {
    const eraIds = new Set<string>();
    for (const c of state.candidates) {
      const eraId = resolveEntityEraId(c);
      if (eraId) eraIds.add(eraId);
    }
    return eras.filter((e) => eraIds.has(e.id)).map((e) => e.id);
  }, [state.candidates, eras]);

  // Build connection maps for filtering
  const connectionMaps = useMemo(() => {
    // Map entity ID -> set of assigned entity IDs it connects to
    const connectedToAssigned = new Map<string, Set<string>>();

    for (const rel of state.candidateRelationships) {
      const srcAssigned = assignedEntityIds.has(rel.src);
      const dstAssigned = assignedEntityIds.has(rel.dst);

      if (srcAssigned && !dstAssigned) {
        if (!connectedToAssigned.has(rel.dst)) connectedToAssigned.set(rel.dst, new Set());
        connectedToAssigned.get(rel.dst).add(rel.src);
      }
      if (dstAssigned && !srcAssigned) {
        if (!connectedToAssigned.has(rel.src)) connectedToAssigned.set(rel.src, new Set());
        connectedToAssigned.get(rel.src).add(rel.dst);
      }
    }

    return { connectedToAssigned };
  }, [state.candidateRelationships, assignedEntityIds]);

  // Filter candidates by selected kinds and connection filter (always include assigned entities)
  const filteredCandidates = useMemo(() => {
    let candidates = state.candidates;

    // Apply kind filter
    if (selectedKinds.size > 0) {
      candidates = candidates.filter(
        (c) => selectedKinds.has(c.kind) || assignedEntityIds.has(c.id)
      );
    }

    // Apply era filter
    if (selectedEras.size > 0) {
      candidates = candidates.filter((c) => {
        const eraId = resolveEntityEraId(c);
        return (eraId !== undefined && selectedEras.has(eraId)) || assignedEntityIds.has(c.id);
      });
    }

    // Apply connection filter
    if (connectionFilter && assignedEntityIds.size > 0) {
      candidates = candidates.filter((c) => {
        // Always include assigned entities
        if (assignedEntityIds.has(c.id)) return true;

        const connectedTo = connectionMaps.connectedToAssigned.get(c.id);
        const connectionCount = connectedTo?.size ?? 0;

        switch (connectionFilter) {
          case "linked":
            // Connected to at least one assigned entity
            return connectionCount > 0;
          case "bridges":
            // Connected to 2+ assigned entities (bridges/connectors)
            return connectionCount >= 2;
          default:
            return true;
        }
      });
    }

    return candidates;
  }, [
    state.candidates,
    selectedKinds,
    selectedEras,
    assignedEntityIds,
    connectionFilter,
    connectionMaps,
  ]);

  // Filter relationships to only include those between filtered candidates
  const filteredRelationships = useMemo(() => {
    const filteredIds = new Set(filteredCandidates.map((c) => c.id));
    return state.candidateRelationships.filter(
      (r) => filteredIds.has(r.src) && filteredIds.has(r.dst)
    );
  }, [state.candidateRelationships, filteredCandidates]);

  return (
    <div>
      {/* Header */}
      <div className="ras-header">
        <div>
          <h4 className="ras-title">Build Your Ensemble</h4>
          <p className="ras-subtitle">
            Click entities in the constellation to select, then click a role to assign.
          </p>
        </div>
        <button
          onClick={() => autoFillRoles(metricsMap)}
          className="illuminator-btn ras-autofill-btn"
        >
          Auto-fill Roles
        </button>
      </div>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <div className="ras-errors">
          {validation.errors.map((error, i) => (
            <div key={i} className="ras-error">
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Main layout: Left (constellation + health) | Right (roles + detail) */}
      <div className="ras-layout">
        {/* Left: Constellation + Ensemble Health */}
        <div className="ras-left">
          {/* Kind filter chips */}
          <div className="ras-filter-gap">
            <FilterChips
              options={availableKinds}
              selected={selectedKinds}
              onSelectionChange={setSelectedKinds}
              label="Filter by Kind"
            />
          </div>
          {/* Era filter chips */}
          {availableEras.length > 1 && (
            <div className="ras-filter-gap">
              <FilterChips
                options={availableEras}
                selected={selectedEras}
                onSelectionChange={setSelectedEras}
                label="Filter by Era"
                formatLabel={(eraId) => eras.find((e) => e.id === eraId)?.name ?? eraId}
                getColor={(eraId) => eraColorMap.get(eraId) ?? "var(--text-muted)"}
              />
            </div>
          )}
          {/* Connection filter */}
          <div className="ras-conn-filter">
            <span className="ras-conn-label">Show:</span>
            {[
              { id: null, label: "All" },
              { id: "linked", label: "Linked to ensemble" },
              { id: "bridges", label: "Bridges (2+ links)" },
            ].map((opt) => (
              <button
                key={opt.id ?? "all"}
                onClick={() => setConnectionFilter(opt.id)}
                style={{
                  '--ras-conn-bg': connectionFilter === opt.id ? "var(--accent-color)" : "var(--bg-tertiary)",
                  '--ras-conn-color': connectionFilter === opt.id ? "white" : "var(--text-muted)",
                  '--ras-conn-border': connectionFilter === opt.id ? "var(--accent-color)" : "var(--border-color)",
                } as React.CSSProperties}
                className="ras-conn-btn"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <EnsembleConstellation
            entryPointId={state.entryPointId || ""}
            candidates={filteredCandidates}
            relationships={filteredRelationships}
            assignedEntityIds={assignedEntityIds}
            metricsMap={metricsMap}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
            eraColorMap={eraColorMap}
            width={400}
            height={300}
          />
          {/* Ensemble Health Bar */}
          <div className="ras-health-gap">
            <EnsembleHealthBar
              assignments={state.roleAssignments}
              candidates={state.candidates}
              kindToCategory={kindToCategory}
            />
          </div>
        </div>

        {/* Right: Roles + Entity Detail */}
        <div className="ras-right">
          {/* Roles header */}
          <div className="ras-roles-header">
            <span className="ras-section-label">
              Roles
            </span>
            <span className="ras-roles-count">
              {state.roleAssignments.length}/{maxCastSize}
            </span>
          </div>

          {/* Role slots */}
          <div className="ras-role-list">
            {roles.map((role) => {
              const assignments = state.roleAssignments.filter((a) => a.role === role.role);
              const isUnderMin = assignments.length < role.count.min;
              const isAtMax = assignments.length >= role.count.max;

              return (
                <RoleSlot
                  key={role.role}
                  role={role}
                  assignments={assignments}
                  hasSelection={
                    selectedEntityId !== null && !assignedEntityIds.has(selectedEntityId)
                  }
                  isAtMax={isAtMax}
                  isUnderMin={isUnderMin}
                  onAssign={() => handleAssignToRole(role.role)}
                  onRemove={(entityId) => handleRemoveFromRole(entityId, role.role)}
                  onTogglePrimary={(entityId) => togglePrimary(entityId, role.role)}
                />
              );
            })}
          </div>

          {/* Narrative Lens */}
          <div className="ras-lens-section">
            <div className="ras-lens-label">
              Narrative Lens
            </div>
            <div className="ras-lens-desc">
              Optional context: a rule, occurrence, or ability that shapes this story without being
              a cast member.
            </div>
            <RoleSlot
              role={{
                role: "lens",
                count: { min: 0, max: 1 },
                description:
                  "Contextual frame — not a character but a constraint, backdrop, or force that colors the narrative",
              }}
              assignments={
                state.lens
                  ? [
                      {
                        role: "lens",
                        entityId: state.lens.entityId,
                        entityName: state.lens.entityName,
                        entityKind: state.lens.entityKind,
                        isPrimary: false,
                      },
                    ]
                  : []
              }
              hasSelection={
                selectedEntityId !== null &&
                !assignedEntityIds.has(selectedEntityId) &&
                state.lens?.entityId !== selectedEntityId
              }
              isAtMax={state.lens !== null}
              isUnderMin={false}
              onAssign={() => {
                if (!selectedEntityId) return;
                const entity = state.candidates.find((e) => e.id === selectedEntityId);
                if (entity) handleSetLens(entity);
              }}
              onRemove={() => clearLens()}
              onTogglePrimary={() => {}}
            />
          </div>

          {/* Entity detail - always visible */}
          <div className="ras-detail-gap">
            <div className="ras-detail-label">
              Selected
            </div>
            <EntityDetailCard
              entity={selectedEntity}
              metrics={selectedMetrics}
              eraName={selectedEntityEra?.name}
              eraColor={selectedEntityEra?.color}
              isEntryPoint={selectedEntity?.id === state.entryPointId}
              isAssigned={selectedEntity ? assignedEntityIds.has(selectedEntity.id) : false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
