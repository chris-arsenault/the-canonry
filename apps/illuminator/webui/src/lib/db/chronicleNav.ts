/**
 * ChronicleNavItem — lightweight projection of ChronicleRecord for nav list rendering.
 *
 * Same two-layer pattern as entityNav.ts / entityStore.ts.
 * See entityNav.ts for the full architectural documentation.
 *
 * Chronicles are lighter than entities (~3KB vs ~10KB per record), so the memory
 * savings are less dramatic, but the pattern still matters for render performance:
 * the nav list only re-renders when nav item fields change, not when the full
 * record's heavy content (assembledContent, generationHistory, etc.) changes.
 */
import type { ChronicleRecord } from "./chronicleRepository";
import { isNoteActive } from "../historianTypes";
import { deriveStatus } from "../../hooks/useChronicleGeneration";
import { computeBackportProgress } from "../chronicleTypes";

export interface ChronicleNavItem {
  id: string;
  chronicleId: string;
  name: string;
  status: string;
  title?: string;
  format?: string;
  focusType?: string;
  primaryCount: number;
  supportingCount: number;
  narrativeStyleId?: string;
  narrativeStyleName?: string;
  perspectiveSynthesis: boolean;
  combineInstructions: boolean;
  coverImageComplete: boolean;
  backportDone: number;
  backportTotal: number;
  historianNoteCount: number;
  lens?: { entityName: string };
  imageRefCompleteCount: number;
  failureStep?: string;
  createdAt: number;
  updatedAt: number;
  // Fields needed for filtering/sorting in the nav list
  selectedEntityIds?: string[];
  roleAssignments?: ChronicleRecord["roleAssignments"];
  wordCount: number;
  focalEraName?: string;
  focalEraOrder?: number;
  focalEraStartTick?: number;
  eraYear?: number;
  hasTemporalNarrative: boolean;
  hasTemporalCheck: boolean;
  hasHistorianPrep: boolean;
  hasSummary: boolean;
  toneRanking?: [string, string, string];
  assignedTone?: string;
  eraNarrativeWeight?: "structural" | "contextual" | "flavor";
}

export function buildNavItem(record: ChronicleRecord): ChronicleNavItem {
  const primaryCount = record.roleAssignments?.filter((r) => r.isPrimary).length || 0;
  const supportingCount = (record.roleAssignments?.length || 0) - primaryCount;
  const historianNoteCount = (record.historianNotes || []).filter(isNoteActive).length;
  const displayName =
    record.title ||
    (record.roleAssignments?.length > 0
      ? record.roleAssignments
          .filter((r) => r.isPrimary)
          .map((r) => r.entityName)
          .join(" & ") || record.roleAssignments[0]?.entityName
      : "") ||
    "Untitled Chronicle";

  const backportProgress = computeBackportProgress(record);

  return {
    id: record.chronicleId,
    chronicleId: record.chronicleId,
    name: displayName,
    status: deriveStatus(record),
    title: record.title,
    format: record.format,
    focusType: record.focusType,
    primaryCount,
    supportingCount,
    narrativeStyleId: record.narrativeStyleId,
    narrativeStyleName: record.narrativeStyle?.name,
    perspectiveSynthesis: !!record.perspectiveSynthesis,
    combineInstructions: !!record.combineInstructions,
    coverImageComplete: record.coverImage?.status === "complete",
    backportDone: backportProgress.done,
    backportTotal: backportProgress.total,
    historianNoteCount,
    lens: record.lens ? { entityName: record.lens.entityName } : undefined,
    imageRefCompleteCount:
      record.imageRefs?.refs?.filter(
        (r: { type: string; status?: string }) =>
          r.type === "prompt_request" && r.status === "complete"
      ).length || 0,
    failureStep: record.failureStep,
    createdAt: record.createdAt || 0,
    updatedAt: record.updatedAt || 0,
    selectedEntityIds: record.selectedEntityIds,
    roleAssignments: record.roleAssignments,
    wordCount: (record.finalContent || record.assembledContent || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length,
    focalEraName: record.temporalContext?.focalEra?.name,
    focalEraOrder:
      typeof record.temporalContext?.focalEra?.order === "number"
        ? record.temporalContext.focalEra.order
        : typeof record.temporalContext?.focalEra?.startTick === "number"
          ? record.temporalContext.focalEra.startTick
          : undefined,
    focalEraStartTick: record.temporalContext?.focalEra?.startTick,
    eraYear: record.eraYear,
    hasTemporalNarrative: !!record.perspectiveSynthesis?.temporalNarrative,
    hasTemporalCheck: !!record.temporalCheckReport,
    hasHistorianPrep: !!record.historianPrep,
    hasSummary: !!record.summary,
    toneRanking: record.toneRanking?.ranking,
    assignedTone: record.assignedTone,
    eraNarrativeWeight: record.narrativeStyle?.eraNarrativeWeight,
  };
}
