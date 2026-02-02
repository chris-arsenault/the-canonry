/**
 * RoleAssignmentStep - Step 3: Assign entities to roles
 *
 * Features the Ensemble Constellation visualization:
 * - Graph showing candidates around entry point
 * - Role slots for click-to-assign workflow
 * - Entity detail card for selected entity
 * - Ensemble health bar showing diversity
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { StoryNarrativeStyle, DocumentNarrativeStyle, RoleDefinition } from '@canonry/world-schema';
import type { NarrativeLens } from '../../../lib/chronicleTypes';
import { useWizard } from '../WizardContext';
import {
  validateRoleAssignments,
  type EntitySelectionMetrics,
} from '../../../lib/chronicle/selectionWizard';
import { getEntityUsageStats } from '../../../lib/db/chronicleRepository';
import {
  EnsembleConstellation,
  RoleSlot,
  EntityDetailCard,
  EnsembleHealthBar,
  FilterChips,
} from '../visualizations';

/** Get roles from either story or document style */
function getRoles(style: { format: string } | null | undefined): RoleDefinition[] {
  if (!style) return [];
  if (style.format === 'story') {
    return (style as StoryNarrativeStyle).roles || [];
  }
  const docStyle = style as DocumentNarrativeStyle;
  return docStyle.roles || [];
}

function resolveEntityEraId(entity: { eraId?: string } | null): string | undefined {
  if (!entity) return undefined;
  return typeof entity.eraId === 'string' && entity.eraId ? entity.eraId : undefined;
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
  const [connectionFilter, setConnectionFilter] = useState<string | null>(null);

  const style = state.narrativeStyle;
  const roles = getRoles(style);
  const maxCastSize = 10;

  // Load usage stats on mount
  useEffect(() => {
    if (!simulationRunId) {
      throw new Error('[Chronicle Wizard] simulationRunId is required to load entity usage stats.');
    }
    getEntityUsageStats(simulationRunId).then(stats => {
      setUsageStats(stats);
    }).catch((err) => {
      console.error('[Chronicle Wizard] Failed to load entity usage stats:', err);
    });
  }, [simulationRunId]);

  // Compute metrics when candidates or usage stats change
  useEffect(() => {
    if (state.candidates.length > 0 && state.entryPointId) {
      const metrics = computeMetrics(usageStats);
      setMetricsMap(metrics);
    }
  }, [state.candidates, state.entryPointId, usageStats, state.roleAssignments, computeMetrics]);

  // Get assigned entity IDs
  const assignedEntityIds = useMemo(() => {
    return new Set(state.roleAssignments.map(a => a.entityId));
  }, [state.roleAssignments]);

  // Validation
  const validation = useMemo(() => {
    if (!roles.length) return { valid: true, errors: [], warnings: [] };
    return validateRoleAssignments(state.roleAssignments, roles, maxCastSize);
  }, [state.roleAssignments, roles, maxCastSize]);

  // Get selected entity details
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    return state.candidates.find(e => e.id === selectedEntityId) || null;
  }, [selectedEntityId, state.candidates]);

  const selectedMetrics = useMemo(() => {
    if (!selectedEntityId) return undefined;
    return metricsMap.get(selectedEntityId);
  }, [selectedEntityId, metricsMap]);

  // Get era name for selected entity
  const selectedEntityEra = useMemo(() => {
    if (!selectedEntity || eras.length === 0) return undefined;
    const entityEraId = resolveEntityEraId(selectedEntity);
    const era = entityEraId ? eras.find(e => e.id === entityEraId) : undefined;
    return era?.name;
  }, [selectedEntity, eras]);

  // Handle role assignment
  const handleAssignToRole = useCallback((roleId: string) => {
    if (!selectedEntityId) return;

    const entity = state.candidates.find(e => e.id === selectedEntityId);
    if (!entity) return;

    addRoleAssignment({
      role: roleId,
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      isPrimary: false,
    });

    setSelectedEntityId(null);
  }, [selectedEntityId, state.candidates, addRoleAssignment]);

  // Handle remove from role
  const handleRemoveFromRole = useCallback((entityId: string, roleId: string) => {
    removeRoleAssignment(entityId, roleId);
  }, [removeRoleAssignment]);

  // Build kind-to-category map
  const kindToCategory = useMemo(() => {
    const map = new Map<string, string>();
    // Simple mapping - could be domain-specific
    for (const candidate of state.candidates) {
      map.set(candidate.kind, candidate.kind);
    }
    return map;
  }, [state.candidates]);

  const handleSetLens = useCallback((entity: typeof state.candidates[0]) => {
    const lens: NarrativeLens = {
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
    };
    setLens(lens);
  }, [setLens]);

  // Get available kinds for filter chips
  const availableKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const candidate of state.candidates) {
      kinds.add(candidate.kind);
    }
    return Array.from(kinds).sort();
  }, [state.candidates]);

  // Build connection maps for filtering
  const connectionMaps = useMemo(() => {
    // Map entity ID -> set of assigned entity IDs it connects to
    const connectedToAssigned = new Map<string, Set<string>>();

    for (const rel of state.candidateRelationships) {
      const srcAssigned = assignedEntityIds.has(rel.src);
      const dstAssigned = assignedEntityIds.has(rel.dst);

      if (srcAssigned && !dstAssigned) {
        if (!connectedToAssigned.has(rel.dst)) connectedToAssigned.set(rel.dst, new Set());
        connectedToAssigned.get(rel.dst)!.add(rel.src);
      }
      if (dstAssigned && !srcAssigned) {
        if (!connectedToAssigned.has(rel.src)) connectedToAssigned.set(rel.src, new Set());
        connectedToAssigned.get(rel.src)!.add(rel.dst);
      }
    }

    return { connectedToAssigned };
  }, [state.candidateRelationships, assignedEntityIds]);

  // Filter candidates by selected kinds and connection filter (always include assigned entities)
  const filteredCandidates = useMemo(() => {
    let candidates = state.candidates;

    // Apply kind filter
    if (selectedKinds.size > 0) {
      candidates = candidates.filter(c =>
        selectedKinds.has(c.kind) || assignedEntityIds.has(c.id)
      );
    }

    // Apply connection filter
    if (connectionFilter && assignedEntityIds.size > 0) {
      candidates = candidates.filter(c => {
        // Always include assigned entities
        if (assignedEntityIds.has(c.id)) return true;

        const connectedTo = connectionMaps.connectedToAssigned.get(c.id);
        const connectionCount = connectedTo?.size ?? 0;

        switch (connectionFilter) {
          case 'linked':
            // Connected to at least one assigned entity
            return connectionCount > 0;
          case 'bridges':
            // Connected to 2+ assigned entities (bridges/connectors)
            return connectionCount >= 2;
          default:
            return true;
        }
      });
    }

    return candidates;
  }, [state.candidates, selectedKinds, assignedEntityIds, connectionFilter, connectionMaps]);

  // Filter relationships to only include those between filtered candidates
  const filteredRelationships = useMemo(() => {
    const filteredIds = new Set(filteredCandidates.map(c => c.id));
    return state.candidateRelationships.filter(
      r => filteredIds.has(r.src) && filteredIds.has(r.dst)
    );
  }, [state.candidateRelationships, filteredCandidates]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0' }}>Build Your Ensemble</h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
            Click entities in the constellation to select, then click a role to assign.
          </p>
        </div>
        <button
          onClick={() => autoFillRoles(metricsMap)}
          className="illuminator-btn"
          style={{ fontSize: '12px' }}
        >
          Auto-fill Roles
        </button>
      </div>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {validation.errors.map((error, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '3px solid var(--error)',
              marginBottom: '4px',
              fontSize: '11px',
              color: 'var(--error)',
            }}>
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Main layout: Left (constellation + health) | Right (roles + detail) */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {/* Left: Constellation + Ensemble Health */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Kind filter chips */}
          <div style={{ marginBottom: '6px' }}>
            <FilterChips
              options={availableKinds}
              selected={selectedKinds}
              onSelectionChange={setSelectedKinds}
              label="Filter by Kind"
            />
          </div>
          {/* Connection filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
            fontSize: '10px',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Show:</span>
            {[
              { id: null, label: 'All' },
              { id: 'linked', label: 'Linked to ensemble' },
              { id: 'bridges', label: 'Bridges (2+ links)' },
            ].map(opt => (
              <button
                key={opt.id ?? 'all'}
                onClick={() => setConnectionFilter(opt.id)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  background: connectionFilter === opt.id ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                  color: connectionFilter === opt.id ? 'white' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: connectionFilter === opt.id ? 'var(--accent-color)' : 'var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <EnsembleConstellation
            entryPointId={state.entryPointId || ''}
            candidates={filteredCandidates}
            relationships={filteredRelationships}
            assignedEntityIds={assignedEntityIds}
            metricsMap={metricsMap}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
            width={400}
            height={300}
          />
          {/* Ensemble Health Bar */}
          <div style={{ marginTop: '8px' }}>
            <EnsembleHealthBar
              assignments={state.roleAssignments}
              candidates={state.candidates}
              kindToCategory={kindToCategory}
            />
          </div>
        </div>

        {/* Right: Roles + Entity Detail */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Roles header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Roles
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {state.roleAssignments.length}/{maxCastSize}
            </span>
          </div>

          {/* Role slots */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}>
            {roles.map(role => {
              const assignments = state.roleAssignments.filter(a => a.role === role.role);
              const isUnderMin = assignments.length < role.count.min;
              const isAtMax = assignments.length >= role.count.max;

              return (
                <RoleSlot
                  key={role.role}
                  role={role}
                  assignments={assignments}
                  hasSelection={selectedEntityId !== null && !assignedEntityIds.has(selectedEntityId)}
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
          <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Narrative Lens
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Optional context: a rule, occurrence, or ability that shapes this story without being a cast member.
            </div>
            <RoleSlot
              role={{ role: 'lens', count: { min: 0, max: 1 }, description: 'Contextual frame — not a character but a constraint, backdrop, or force that colors the narrative' }}
              assignments={state.lens ? [{ role: 'lens', entityId: state.lens.entityId, entityName: state.lens.entityName, entityKind: state.lens.entityKind, isPrimary: false }] : []}
              hasSelection={selectedEntityId !== null && !assignedEntityIds.has(selectedEntityId) && !(state.lens?.entityId === selectedEntityId)}
              isAtMax={state.lens !== null}
              isUnderMin={false}
              onAssign={() => {
                if (!selectedEntityId) return;
                const entity = state.candidates.find(e => e.id === selectedEntityId);
                if (entity) handleSetLens(entity);
              }}
              onRemove={() => clearLens()}
              onTogglePrimary={() => {}}
            />
          </div>

          {/* Entity detail - always visible */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Selected
            </div>
            <EntityDetailCard
              entity={selectedEntity}
              metrics={selectedMetrics}
              eraName={selectedEntityEra}
              isEntryPoint={selectedEntity?.id === state.entryPointId}
              isAssigned={selectedEntity ? assignedEntityIds.has(selectedEntity.id) : false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
