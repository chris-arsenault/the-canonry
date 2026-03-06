/**
 * useChronicleBulkOperations - Bulk operation callbacks for ChroniclePanel.
 *
 * Handles tertiary detection, backport reset/reconcile, bulk temporal checks,
 * bulk summaries, and bulk historian prep — all extracted from the monolithic
 * ChroniclePanel to reduce cyclomatic complexity.
 */

import { useState, useCallback, type RefObject } from "react";
import type { ChronicleNavItem, OperationResult, ResetBackportResult, TertiaryDetectResult } from "./chroniclePanelTypes";
import { getEntitiesForRun, resetEntitiesToPreBackportState } from "../../lib/db/entityRepository";
import {
  resetAllBackportFlags,
  reconcileBackportStatusFromEntities,
  getChronicle,
  updateChronicleTertiaryCast,
} from "../../lib/db/chronicleRepository";
import { findEntityMentions } from "../../lib/wikiLinkService";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";

type WikiEntity = { id: string; name: string };

function buildWikiEntityList(entities: PersistedEntity[]): WikiEntity[] {
  const wikiEntities: WikiEntity[] = [];
  for (const entity of entities) {
    if (entity.kind === "era") continue;
    wikiEntities.push({ id: entity.id, name: entity.name });
    const aliases = entity.enrichment?.text?.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === "string" && alias.length >= 3) {
          wikiEntities.push({ id: entity.id, name: alias });
        }
      }
    }
  }
  return wikiEntities;
}

async function detectTertiaryForChronicle(
  navItem: ChronicleNavItem,
  wikiEntities: WikiEntity[],
  freshEntities: PersistedEntity[]
): Promise<boolean> {
  const record = await getChronicle(navItem.chronicleId);
  if (!record) return false;
  const content = record.finalContent || record.assembledContent;
  if (!content) return false;

  const mentions = findEntityMentions(content, wikiEntities);
  const declaredIds = new Set(record.selectedEntityIds || []);
  const prevDecisions = new Map(
    (record.tertiaryCast || []).map((e: { entityId: string; accepted: boolean }) => [e.entityId, e.accepted]),
  );
  const seen = new Set<string>();
  const entries: Array<Record<string, unknown>> = [];
  for (const m of mentions) {
    if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
    seen.add(m.entityId);
    const entity = freshEntities.find((e: { id: string }) => e.id === m.entityId);
    if (entity) {
      entries.push({
        entityId: entity.id, name: entity.name, kind: entity.kind,
        matchedAs: content.slice(m.start, m.end),
        matchStart: m.start, matchEnd: m.end,
        accepted: prevDecisions.get(entity.id) ?? true,
      });
    }
  }
  await updateChronicleTertiaryCast(navItem.chronicleId, entries);
  return true;
}

interface UseChronicleBulkOperationsParams {
  simulationRunId: string;
  chronicleItems: ChronicleNavItem[];
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  refresh: () => Promise<void>;
  historianConfigured: boolean;
  historianConfig: Record<string, unknown>;
  skipCompletedPrep: boolean;
  fullEntityMapRef: RefObject<Map<string, Record<string, unknown>>>;
}

export function useChronicleBulkOperations({
  simulationRunId,
  chronicleItems,
  onEnqueue,
  refresh,
  historianConfigured,
  historianConfig,
  skipCompletedPrep,
}: UseChronicleBulkOperationsParams) {
  // Bulk image ref regeneration
  const [bulkImageRefResult, setBulkImageRefResult] = useState<OperationResult | null>(null);

  // Backport state
  const [showResetBackportModal, setShowResetBackportModal] = useState(false);
  const [resetBackportResult, setResetBackportResult] = useState<ResetBackportResult | null>(null);
  const [reconcileBackportResult, setReconcileBackportResult] = useState<OperationResult | null>(null);

  // Era summary
  const [eraSummaryRefreshResult, setEraSummaryRefreshResult] = useState<OperationResult | null>(null);

  // Temporal check
  const [temporalCheckResult, setTemporalCheckResult] = useState<OperationResult | null>(null);

  // Tertiary detect
  const [tertiaryDetectResult, setTertiaryDetectResult] = useState<TertiaryDetectResult | null>(null);

  // Bulk summary
  const [bulkSummaryResult, setBulkSummaryResult] = useState<OperationResult | null>(null);

  // ── Backport ──

  const handleOpenResetBackportModal = useCallback(() => {
    setShowResetBackportModal(true);
  }, []);

  const handleResetBackportConfirm = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      const chronicleCount = await resetAllBackportFlags(simulationRunId);
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const entityResult = await resetEntitiesToPreBackportState(simulationRunId, freshEntities);
      setResetBackportResult({
        success: true,
        chronicleCount,
        entityCount: entityResult.resetCount,
      });
      await refresh();
      if (entityResult.entityIds.length > 0) {
        window.dispatchEvent(
          new CustomEvent("entities-updated", {
            detail: { entityIds: entityResult.entityIds },
          }),
        );
      }
    } catch (err) {
      console.error("[Chronicle] Failed to reset backport state:", err);
      setResetBackportResult({ success: false, error: String(err) });
    }
    setShowResetBackportModal(false);
  }, [simulationRunId, refresh]);

  const handleResetBackportCancel = useCallback(() => {
    setShowResetBackportModal(false);
    setResetBackportResult(null);
  }, []);

  const handleReconcileBackports = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const count = await reconcileBackportStatusFromEntities(simulationRunId, freshEntities);
      setReconcileBackportResult({ success: true, count });
      await refresh();
      setTimeout(() => setReconcileBackportResult(null), 5000);
    } catch (err) {
      console.error("[Chronicle] Failed to reconcile backport status:", err);
      setReconcileBackportResult({ success: false, error: String(err) });
    }
  }, [simulationRunId, refresh]);

  // ── Tertiary detection ──

  const handleBulkDetectTertiary = useCallback(async () => {
    if (!simulationRunId) return;
    setTertiaryDetectResult({ running: true, count: 0 });
    try {
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const wikiEntities = buildWikiEntityList(freshEntities);
      const eligible = chronicleItems.filter(
        (c) => c.status === "complete" || c.status === "assembly_ready",
      );
      let updated = 0;
      for (const navItem of eligible) {
        const didUpdate = await detectTertiaryForChronicle(navItem, wikiEntities, freshEntities);
        if (didUpdate) updated++;
      }
      await refresh();
      setTertiaryDetectResult({ success: true, count: updated });
      setTimeout(() => setTertiaryDetectResult(null), 4000);
    } catch (err) {
      console.error("[Chronicle] Bulk tertiary detect failed:", err);
      setTertiaryDetectResult({ success: false, error: String(err) });
      setTimeout(() => setTertiaryDetectResult(null), 6000);
    }
  }, [simulationRunId, chronicleItems, refresh]);

  // ── Bulk temporal checks ──

  const handleBulkTemporalCheck = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        c.hasTemporalNarrative &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setTemporalCheckResult({ success: true, count: 0 });
      setTimeout(() => setTemporalCheckResult(null), 4000);
      return;
    }
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "temporal_check",
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
    setTemporalCheckResult({ success: true, count: eligible.length });
    setTimeout(() => setTemporalCheckResult(null), 4000);
  }, [chronicleItems, onEnqueue]);

  // ── Bulk summaries ──

  const handleBulkSummary = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        !c.hasSummary &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkSummaryResult({ success: true, count: 0 });
      setTimeout(() => setBulkSummaryResult(null), 4000);
      return;
    }
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "summary",
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
    setBulkSummaryResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkSummaryResult(null), 4000);
  }, [chronicleItems, onEnqueue]);

  // ── Bulk historian prep ──

  const handleBulkHistorianPrep = useCallback(() => {
    if (!historianConfigured) return;
    let eligible = chronicleItems.filter(
      (c) => (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (skipCompletedPrep) {
      eligible = eligible.filter((c) => !c.hasHistorianPrep);
    }
    if (eligible.length === 0) return;
    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "historianPrep",
        prompt: JSON.stringify({ historianConfig, tone: "weary" }),
        chronicleId: c.chronicleId,
      };
    });
    onEnqueue(items);
  }, [chronicleItems, onEnqueue, historianConfigured, historianConfig, skipCompletedPrep]);

  // ── Bulk image ref regeneration ──

  const handleBulkRegenerateImageRefs = useCallback(() => {
    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) {
      setBulkImageRefResult({ success: true, count: 0 });
      setTimeout(() => setBulkImageRefResult(null), 4000);
      return;
    }

    // Build visual identities from the full entity map
    const visualIdentities: Record<string, string> = {};
    for (const [id, entity] of fullEntityMapRef.current) {
      const enrichment = entity.enrichment as Record<string, unknown> | undefined;
      const text = enrichment?.text as Record<string, unknown> | undefined;
      const thesis = typeof text?.visualThesis === "string" ? text.visualThesis : undefined;
      if (thesis) {
        visualIdentities[id] = thesis;
      }
    }

    const items = eligible.map((c) => {
      const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
      const entity = buildQueueEntity(primaryRole, c);
      return {
        entity,
        type: "entityChronicle",
        prompt: "",
        chronicleStep: "regenerate_image_refs",
        chronicleId: c.chronicleId,
        visualIdentities,
      };
    });
    onEnqueue(items);
    setBulkImageRefResult({ success: true, count: eligible.length });
    setTimeout(() => setBulkImageRefResult(null), 4000);
  }, [chronicleItems, onEnqueue, fullEntityMapRef]);

  return {
    // Backport state & handlers
    showResetBackportModal,
    resetBackportResult,
    setResetBackportResult,
    reconcileBackportResult,
    setReconcileBackportResult,
    handleOpenResetBackportModal,
    handleResetBackportConfirm,
    handleResetBackportCancel,
    handleReconcileBackports,
    // Tertiary
    tertiaryDetectResult,
    setTertiaryDetectResult,
    handleBulkDetectTertiary,
    // Era summary
    eraSummaryRefreshResult,
    setEraSummaryRefreshResult,
    // Temporal check
    temporalCheckResult,
    setTemporalCheckResult,
    handleBulkTemporalCheck,
    // Bulk summary
    bulkSummaryResult,
    setBulkSummaryResult,
    handleBulkSummary,
    // Historian prep
    handleBulkHistorianPrep,
    // Bulk image ref regeneration
    bulkImageRefResult,
    setBulkImageRefResult,
    handleBulkRegenerateImageRefs,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RoleAssignment {
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

function buildQueueEntity(
  primaryRole: RoleAssignment | undefined,
  c: ChronicleNavItem,
): Record<string, unknown> {
  if (primaryRole) {
    return {
      id: primaryRole.entityId,
      name: primaryRole.entityName,
      kind: primaryRole.entityKind,
      subtype: "",
      prominence: "recognized",
      culture: "",
      status: "active",
      description: "",
      tags: {},
    };
  }
  return {
    id: c.chronicleId,
    name: c.title || "Chronicle",
    kind: "chronicle",
    subtype: "",
    prominence: "recognized",
    culture: "",
    status: "active",
    description: "",
    tags: {},
  };
}
