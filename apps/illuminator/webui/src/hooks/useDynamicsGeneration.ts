/**
 * useDynamicsGeneration - Hook for managing multi-turn dynamics generation
 *
 * Orchestrates the flow:
 * 1. Create run in IndexedDB with full world context upfront
 * 2. Dispatch worker task (one LLM turn)
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. Collect user feedback and dispatch next turn
 * 5. Import final dynamics into worldContext
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type {
  DynamicsRun,
  DynamicsMessage,
} from '../lib/dynamicsGenerationTypes';
import {
  createDynamicsRun,
  getDynamicsRun,
  updateDynamicsRun,
  generateRunId,
  deleteDynamicsRun,
} from '../lib/db/dynamicsRepository';
import type { EntityContext, RelationshipContext } from '../lib/chronicleTypes';

// ============================================================================
// Types
// ============================================================================

export interface DynamicsGenerationConfig {
  projectId: string;
  simulationRunId: string;
  /** Static pages content (primary context) */
  staticPagesContext: string;
  /** Schema context (secondary) */
  schemaContext: string;
  /** In-memory entity data for context assembly */
  entities: EntityContext[];
  relationships: RelationshipContext[];
}

export interface UseDynamicsGenerationReturn {
  /** Current run state */
  run: DynamicsRun | null;
  /** Whether a generation is active */
  isActive: boolean;
  /** Start a new dynamics generation session */
  startGeneration: (config: DynamicsGenerationConfig) => void;
  /** Submit user feedback and trigger next LLM turn */
  submitFeedback: (feedback: string) => void;
  /** Accept proposed dynamics and close the session */
  acceptDynamics: () => void;
  /** Cancel the current session */
  cancelGeneration: () => void;
}

// ============================================================================
// Hook
// ============================================================================

const POLL_INTERVAL_MS = 1000;

export function useDynamicsGeneration(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
  onDynamicsAccepted?: (dynamics: DynamicsRun['proposedDynamics']) => void
): UseDynamicsGenerationReturn {
  const [run, setRun] = useState<DynamicsRun | null>(null);
  const [isActive, setIsActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Poll IndexedDB for run state changes
  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getDynamicsRun(runId);
      if (!updated) return;

      setRun(updated);

      // Stop polling on terminal states
      if (updated.status === 'awaiting_review' || updated.status === 'complete' || updated.status === 'failed') {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Dispatch a worker task for one LLM turn
  const dispatchWorkerTask = useCallback((runId: string) => {
    const sentinelEntity = {
      id: '__dynamics__',
      name: 'World Dynamics',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };

    onEnqueue([{
      entity: sentinelEntity,
      type: 'dynamicsGeneration' as EnrichmentType,
      prompt: '',
      chronicleId: runId, // Repurpose chronicleId for runId
    }]);
  }, [onEnqueue]);

  // Start a new generation session
  const startGeneration = useCallback(async (config: DynamicsGenerationConfig) => {
    const runId = generateRunId();

    // Create run with full world context as system message
    const initialMessage: DynamicsMessage = {
      role: 'system',
      content: buildInitialContext(config),
      timestamp: Date.now(),
    };

    const newRun = await createDynamicsRun(runId, config.projectId, config.simulationRunId);
    await updateDynamicsRun(runId, {
      messages: [initialMessage],
      status: 'pending',
    });

    const updatedRun = await getDynamicsRun(runId);
    setRun(updatedRun || newRun);
    setIsActive(true);

    // Dispatch first worker turn
    dispatchWorkerTask(runId);

    // Start polling
    startPolling(runId);
  }, [dispatchWorkerTask, startPolling]);

  // Submit user feedback and trigger next turn
  const submitFeedback = useCallback(async (feedback: string) => {
    if (!run) return;

    await updateDynamicsRun(run.runId, {
      userFeedback: feedback,
      status: 'pending',
    });

    // Dispatch next worker turn
    dispatchWorkerTask(run.runId);

    // Resume polling
    startPolling(run.runId);
  }, [run, dispatchWorkerTask, startPolling]);

  // Accept proposed dynamics
  const acceptDynamics = useCallback(() => {
    if (!run?.proposedDynamics) return;

    onDynamicsAccepted?.(run.proposedDynamics);
    setIsActive(false);
    stopPolling();

    // Clean up the run record
    if (run.runId) {
      deleteDynamicsRun(run.runId).catch(() => {});
    }
  }, [run, onDynamicsAccepted, stopPolling]);

  // Cancel
  const cancelGeneration = useCallback(() => {
    setIsActive(false);
    stopPolling();
    if (run?.runId) {
      deleteDynamicsRun(run.runId).catch(() => {});
    }
    setRun(null);
  }, [run, stopPolling]);

  return {
    run,
    isActive,
    startGeneration,
    submitFeedback,
    acceptDynamics,
    cancelGeneration,
  };
}

// ============================================================================
// Context Assembly
// ============================================================================

function buildInitialContext(config: DynamicsGenerationConfig): string {
  const sections: string[] = [];

  // Primary: Static pages (lore bible)
  if (config.staticPagesContext) {
    sections.push(`=== LORE BIBLE (PRIMARY SOURCE) ===\n${config.staticPagesContext}`);
  }

  // Secondary: Schema
  if (config.schemaContext) {
    sections.push(`=== WORLD SCHEMA ===\n${config.schemaContext}`);
  }

  // World state: Entity summaries grouped by kind
  // Sort by prominence so the most important entities appear first
  const prominenceOrder: Record<string, number> = { mythic: 0, renowned: 1, recognized: 2, marginal: 3, forgotten: 4 };
  const sortedEntities = [...config.entities].sort((a, b) =>
    (prominenceOrder[a.prominence] ?? 5) - (prominenceOrder[b.prominence] ?? 5)
  );

  const byKind = new Map<string, EntityContext[]>();
  for (const e of sortedEntities) {
    const list = byKind.get(e.kind) || [];
    list.push(e);
    byKind.set(e.kind, list);
  }

  const formatEntity = (e: EntityContext, kind: string): string => {
    const parts = [`${e.name}`];
    if (e.subtype) parts[0] += ` (${e.subtype})`;
    if (kind === 'era') parts.push(`id: ${e.id}`);
    parts.push(`prominence: ${e.prominence}`);
    if (e.culture) parts.push(`culture: ${e.culture}`);
    if (e.status && e.status !== 'active') parts.push(`status: ${e.status}`);
    const text = e.summary || e.description || '';
    if (text) parts.push(text);
    return `- ${parts.join(' | ')}`;
  };

  // Prominent entities get full summaries; marginal/forgotten get name-only lists
  const entitySections: string[] = [];
  for (const [kind, entities] of byKind.entries()) {
    const prominent = entities.filter((e) => e.prominence !== 'marginal' && e.prominence !== 'forgotten');
    const minor = entities.filter((e) => e.prominence === 'marginal' || e.prominence === 'forgotten');

    const lines: string[] = [];
    if (prominent.length > 0) {
      lines.push(...prominent.map((e) => formatEntity(e, kind)));
    }
    if (minor.length > 0) {
      const names = minor.map((e) => e.name).join(', ');
      lines.push(`- [${minor.length} minor]: ${names}`);
    }
    entitySections.push(`### ${kind} (${entities.length})\n${lines.join('\n')}`);
  }

  if (entitySections.length > 0) {
    sections.push(`=== WORLD STATE: ALL ENTITIES ===\n${entitySections.join('\n\n')}`);
  }

  // Relationship patterns: summarize by kind with counts
  if (config.relationships.length > 0) {
    const relByKind = new Map<string, { count: number; examples: string[] }>();
    for (const r of config.relationships) {
      const entry = relByKind.get(r.kind) || { count: 0, examples: [] };
      entry.count++;
      if (entry.examples.length < 5) {
        entry.examples.push(`${r.srcName || r.src} → ${r.dstName || r.dst}`);
      }
      relByKind.set(r.kind, entry);
    }

    const relLines = Array.from(relByKind.entries()).map(([kind, data]) => {
      const examples = data.examples.join('; ');
      return `- ${kind}: ${data.count} relationships (e.g., ${examples})`;
    });
    sections.push(`=== WORLD STATE: RELATIONSHIP PATTERNS ===\n${relLines.join('\n')}`);
  }

  // Quick overview
  const kindCounts: Record<string, number> = {};
  for (const e of config.entities) {
    kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
  }
  const breakdown = Object.entries(kindCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  sections.push(`=== WORLD STATE OVERVIEW ===\nEntity breakdown: ${breakdown}\nTotal entities: ${config.entities.length}\nTotal relationships: ${config.relationships.length}`);

  return sections.join('\n\n');
}
