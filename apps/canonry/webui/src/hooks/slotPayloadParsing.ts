/**
 * Slot payload parsing and import helpers.
 *
 * Handles: format detection, discriminated payload parsing, Dexie data import,
 * project data import (chronicles, static pages, images), and context persistence.
 */

import {
  saveWorldContext,
  saveEntityGuidance,
  saveCultureIdentities,
  generateSlotTitle,
} from "../storage/worldStore";
import { importStaticPages } from "../storage/staticPageStorage";
import { importChronicles } from "../storage/chronicleStorage";
import { importBundleImageReferences } from "../storage/imageStorage";
import { importEntities } from "../storage/entityStorage";
import { importNarrativeEvents } from "../storage/eventStorage";
import { isWorldOutput } from "../lib/bundleExportUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SLOT_EXPORT_FORMAT = "canonry-slot-export";
export const SLOT_EXPORT_VERSION = 1;
export const VIEWER_BUNDLE_FORMAT = "canonry-viewer-bundle";
export const VIEWER_BUNDLE_VERSION = 1;

// ---------------------------------------------------------------------------
// Discriminated union: three payload sources produce three shapes
// ---------------------------------------------------------------------------

interface ParsedSlotBase {
  worldData: unknown;
  simulationResults: unknown;
  simulationState: unknown;
}

interface ParsedSlotExport extends ParsedSlotBase {
  source: "slot-export";
  slotTitle: string;
  slotCreatedAt: number;
  worldContext: unknown;
  entityGuidance: unknown;
  cultureIdentities: unknown;
}

interface ParsedViewerBundle extends ParsedSlotBase {
  source: "viewer-bundle";
  slotTitle: string;
  slotCreatedAt: number;
  chronicles: unknown[];
  staticPages: unknown[];
  imageData: unknown;
  images: Record<string, string>;
}

interface ParsedRawOutput extends ParsedSlotBase {
  source: "raw-output";
}

export type ParsedSlotPayload = ParsedSlotExport | ParsedViewerBundle | ParsedRawOutput;

// ---------------------------------------------------------------------------
// Shared parse helpers
// ---------------------------------------------------------------------------

function extractSlotMetadata(payload: Record<string, unknown>): { slotTitle: string; slotCreatedAt: number } {
  const slot = payload.slot as Record<string, unknown> | undefined;
  const metadata = payload.metadata as Record<string, unknown> | undefined;
  const rawTitle = slot?.title || metadata?.title || "";
  return {
    slotTitle: typeof rawTitle === "string" ? rawTitle : "",
    slotCreatedAt: Number(slot?.createdAt) || 0,
  };
}

function patchWorldDataMetadata(worldData: Record<string, unknown>, metadata: Record<string, unknown> | undefined): void {
  if (!worldData?.metadata && metadata?.simulationRunId) {
    worldData.metadata = {
      ...(worldData.metadata as Record<string, unknown>),
      simulationRunId: metadata.simulationRunId,
    };
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseSlotExport(payload: Record<string, unknown>): ParsedSlotExport {
  const worldData = payload.worldData || payload.simulationResults;
  if (!isWorldOutput(worldData)) {
    throw new Error("Slot export is missing a valid world output.");
  }
  const { slotTitle, slotCreatedAt } = extractSlotMetadata(payload);
  return {
    source: "slot-export",
    worldData,
    simulationResults: payload.simulationResults ?? worldData,
    simulationState: payload.simulationState ?? null,
    worldContext: payload.worldContext,
    entityGuidance: payload.entityGuidance,
    cultureIdentities: payload.cultureIdentities,
    slotTitle,
    slotCreatedAt,
  };
}

function parseViewerBundle(payload: Record<string, unknown>): ParsedViewerBundle {
  const worldData = payload.worldData as Record<string, unknown>;
  if (!isWorldOutput(worldData)) {
    throw new Error("Viewer bundle is missing a valid world output.");
  }
  patchWorldDataMetadata(worldData, payload.metadata as Record<string, unknown> | undefined);
  const { slotTitle, slotCreatedAt } = extractSlotMetadata(payload);
  return {
    source: "viewer-bundle",
    worldData,
    simulationResults: worldData,
    simulationState: null,
    slotTitle,
    slotCreatedAt,
    chronicles: Array.isArray(payload.chronicles) ? payload.chronicles : [],
    staticPages: Array.isArray(payload.staticPages) ? payload.staticPages : [],
    imageData: payload.imageData ?? null,
    images: (payload.images as Record<string, string>) ?? {},
  };
}

export function parseSlotImportPayload(payload: Record<string, unknown>): ParsedSlotPayload {
  if (payload?.format === SLOT_EXPORT_FORMAT && payload?.version === SLOT_EXPORT_VERSION) {
    return parseSlotExport(payload);
  }
  if (payload?.format === VIEWER_BUNDLE_FORMAT && payload?.version === VIEWER_BUNDLE_VERSION) {
    return parseViewerBundle(payload);
  }
  if (isWorldOutput(payload)) {
    return { source: "raw-output", worldData: payload, simulationResults: payload, simulationState: null };
  }
  throw new Error(
    "Unsupported import format. Expected a Canonry slot export, viewer bundle, or world output JSON.",
  );
}

// ---------------------------------------------------------------------------
// Slot metadata resolution
// ---------------------------------------------------------------------------

export function extractSimulationRunId(worldData: unknown): string | undefined {
  const metadata = (worldData as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined;
  return metadata?.simulationRunId as string | undefined;
}

export function resolveSlotTitle(
  parsed: ParsedSlotPayload, existingTitle: string, defaultTitle: string,
  slotIndex: number, now: number,
): string {
  const parsedTitle = parsed.source !== "raw-output" ? parsed.slotTitle : "";
  return parsedTitle || existingTitle || defaultTitle || (slotIndex === 0 ? "Scratch" : generateSlotTitle(slotIndex, now));
}

export function resolveSlotCreatedAt(parsed: ParsedSlotPayload, existingCreatedAt: number, now: number): number {
  if (parsed.source !== "raw-output" && parsed.slotCreatedAt) return parsed.slotCreatedAt;
  return existingCreatedAt || now;
}

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------

function hasNonEmptyArray(data: Record<string, unknown>, key: string): boolean {
  const arr = data[key];
  return Array.isArray(arr) && arr.length > 0;
}

export async function importDexieData(
  simulationRunId: string | undefined,
  worldData: Record<string, unknown>,
): Promise<void> {
  if (!simulationRunId) {
    if (hasNonEmptyArray(worldData, "hardState")) {
      console.warn("[Canonry] Import skipped Dexie entity merge: missing simulationRunId");
    }
    return;
  }
  if (hasNonEmptyArray(worldData, "hardState")) {
    const entityResult = await importEntities(simulationRunId, worldData.hardState);
    console.log("[Canonry] Import entities (Dexie)", entityResult);
  }
  if (hasNonEmptyArray(worldData, "narrativeHistory")) {
    const eventResult = await importNarrativeEvents(simulationRunId, worldData.narrativeHistory);
    console.log("[Canonry] Import narrative events (Dexie)", eventResult);
  }
}

export async function importProjectData(
  projectId: string,
  parsed: ParsedSlotPayload,
  simulationRunId: string | undefined,
): Promise<void> {
  if (parsed.source !== "viewer-bundle") return;
  if (parsed.staticPages.length > 0) {
    await importStaticPages(projectId, parsed.staticPages, { preserveIds: true });
  }
  if (parsed.chronicles.length > 0) {
    const chronicleResult = await importChronicles(projectId, parsed.chronicles, { simulationRunId });
    console.log("[Canonry] Import chronicles", chronicleResult);
  }
  if (parsed.imageData) {
    const imageResult = await importBundleImageReferences({
      projectId, imageData: parsed.imageData, images: parsed.images,
    });
    console.log("[Canonry] Import image references", imageResult);
  }
}

export async function persistParsedContext(
  projectId: string,
  parsed: ParsedSlotPayload,
): Promise<void> {
  if (parsed.source !== "slot-export") return;
  if (parsed.worldContext !== undefined) {
    await saveWorldContext(projectId, parsed.worldContext);
  }
  if (parsed.entityGuidance !== undefined) {
    await saveEntityGuidance(projectId, parsed.entityGuidance);
  }
  if (parsed.cultureIdentities !== undefined) {
    await saveCultureIdentities(projectId, parsed.cultureIdentities);
  }
}
