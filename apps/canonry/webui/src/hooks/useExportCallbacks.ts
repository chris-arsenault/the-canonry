/**
 * useExportCallbacks - Export/import callbacks for the Canonry shell.
 *
 * Handles: slot download, viewer bundle export, slot/bundle import, example output loading.
 */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import {
  getSlot,
  saveSlot,
  generateSlotTitle,
  saveWorldContext,
  saveEntityGuidance,
  saveCultureIdentities,
} from "../storage/worldStore";
import { getStaticPagesForProject, importStaticPages } from "../storage/staticPageStorage";
import {
  getCompletedChroniclesForSimulation,
  getCompletedChroniclesForProject,
  importChronicles,
  getChronicleCountForProject,
} from "../storage/chronicleStorage";
import { getCompletedEraNarrativesForSimulation } from "../storage/eraNarrativeStorage";
import { importBundleImageReferences, getImageCountForProject } from "../storage/imageStorage";
import { importEntities, getEntityCountForRun } from "../storage/entityStorage";
import { importNarrativeEvents, getNarrativeEventCountForRun } from "../storage/eventStorage";
import { createS3Client, buildImageStorageConfig, syncProjectImagesToS3 } from "../aws/awsS3";
import { useCanonryAwsStore } from "../stores/useCanonryAwsStore";
import {
  isWorldOutput,
  mergeDefined,
  buildExportBase,
  normalizeWorldContextForExport,
  extractLoreDataWithCurrentImageRefs,
  hydrateWorldDataFromDexie,
  buildBundleImageAssets,
  throwIfExportCanceled,
  EXPORT_CANCEL_ERROR_NAME,
} from "../lib/bundleExportUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_EXPORT_FORMAT = "canonry-slot-export";
const SLOT_EXPORT_VERSION = 1;
const VIEWER_BUNDLE_FORMAT = "canonry-viewer-bundle";
const VIEWER_BUNDLE_VERSION = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchivistData {
  worldData: unknown;
  loreData: unknown;
}

interface SlotOperations {
  handleLoadSlot: (slotIndex: number) => Promise<void>;
  closeExportModal: () => void;
  openExportModal: (slotIndex: number) => void;
}

interface UseExportCallbacksParams {
  currentProject: unknown;
  slots: Record<number, Record<string, unknown>>;
  activeSlotIndex: number;
  archivistData: ArchivistData | null;
  awsConfig: Record<string, unknown>;
  exportCancelRef: MutableRefObject<boolean>;
  setExportBundleStatus: Dispatch<SetStateAction<{ state: "idle" | "working" | "error"; detail: string }>>;
  worldContext: unknown;
  entityGuidance: unknown;
  cultureIdentities: unknown;
  slotOps: SlotOperations;
}

// ---------------------------------------------------------------------------
// Slot import payload parsing
// ---------------------------------------------------------------------------

interface ParsedSlotPayload {
  worldData: unknown;
  simulationResults: unknown;
  simulationState: unknown;
  worldContext?: unknown;
  entityGuidance?: unknown;
  cultureIdentities?: unknown;
  slotTitle?: string;
  slotCreatedAt?: number;
  chronicles?: unknown[];
  staticPages?: unknown[];
  imageData?: unknown;
  images?: Record<string, string>;
}

function parseSlotImportPayload(payload: Record<string, unknown>): ParsedSlotPayload {
  if (payload?.format === SLOT_EXPORT_FORMAT && payload?.version === SLOT_EXPORT_VERSION) {
    const worldData = payload.worldData || payload.simulationResults;
    if (!isWorldOutput(worldData)) {
      throw new Error("Slot export is missing a valid world output.");
    }
    return {
      worldData,
      simulationResults: payload.simulationResults ?? worldData,
      simulationState: payload.simulationState ?? null,
      worldContext: payload.worldContext as unknown,
      entityGuidance: payload.entityGuidance as unknown,
      cultureIdentities: payload.cultureIdentities as unknown,
      slotTitle: (payload.slot as Record<string, unknown>)?.title as string,
      slotCreatedAt: (payload.slot as Record<string, unknown>)?.createdAt as number,
    };
  }
  if (payload?.format === VIEWER_BUNDLE_FORMAT && payload?.version === VIEWER_BUNDLE_VERSION) {
    const worldData = payload.worldData as Record<string, unknown>;
    if (!isWorldOutput(worldData)) {
      throw new Error("Viewer bundle is missing a valid world output.");
    }
    const metadata = payload.metadata as Record<string, unknown> | undefined;
    if (!worldData?.metadata && metadata?.simulationRunId) {
      (worldData as Record<string, unknown>).metadata = {
        ...(worldData.metadata as Record<string, unknown>),
        simulationRunId: metadata.simulationRunId,
      };
    }
    return {
      worldData,
      simulationResults: worldData,
      simulationState: null,
      slotTitle: (payload.slot as Record<string, unknown>)?.title as string || metadata?.title as string,
      slotCreatedAt: (payload.slot as Record<string, unknown>)?.createdAt as number,
      chronicles: Array.isArray(payload.chronicles) ? payload.chronicles : [],
      staticPages: Array.isArray(payload.staticPages) ? payload.staticPages : [],
      imageData: payload.imageData ?? null,
      images: (payload.images as Record<string, string>) ?? undefined,
    };
  }
  if (isWorldOutput(payload)) {
    return { worldData: payload, simulationResults: payload, simulationState: null };
  }
  throw new Error(
    "Unsupported import format. Expected a Canonry slot export, viewer bundle, or world output JSON.",
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExportCallbacks(params: UseExportCallbacksParams) {
  const {
    currentProject, slots, activeSlotIndex, archivistData,
    awsConfig, exportCancelRef, setExportBundleStatus,
    worldContext, entityGuidance, cultureIdentities, slotOps,
  } = params;

  const projectId = (currentProject as Record<string, unknown>)?.id as string | undefined;
  const projectName = (currentProject as Record<string, unknown>)?.name as string | undefined;
  const awsTokens = useCanonryAwsStore((s) => s.tokens);
  const s3Client = createS3Client(awsConfig, awsTokens);

  // -------------------------------------------------------------------------
  // Slot import (shared logic for file import and example output)
  // -------------------------------------------------------------------------

  const importSlotPayload = useCallback(
    async (slotIndex: number, payload: Record<string, unknown>, options: { defaultTitle?: string } = {}) => {
      if (!projectId) return;
      const parsed = parseSlotImportPayload(payload);
      const now = Date.now();
      const existingSlot = ((await getSlot(projectId, slotIndex)) || {}) as Record<string, unknown>;
      const title =
        parsed.slotTitle ||
        (existingSlot.title as string) ||
        options.defaultTitle ||
        (slotIndex === 0 ? "Scratch" : generateSlotTitle(slotIndex, now));
      const createdAt = parsed.slotCreatedAt ?? (existingSlot.createdAt as number) ?? now;
      const worldData = mergeDefined(parsed.worldData, existingSlot.worldData ?? null);
      const simResults = mergeDefined(
        parsed.simulationResults ?? parsed.worldData,
        existingSlot.simulationResults ?? null,
      );
      const simState = mergeDefined(parsed.simulationState, existingSlot.simulationState ?? null);

      const slotData = {
        ...existingSlot,
        title,
        createdAt,
        savedAt: now,
        simulationResults: simResults,
        simulationState: simState,
        worldData,
      };
      await saveSlot(projectId, slotIndex, slotData);

      const simulationRunId = (worldData as Record<string, unknown>)?.metadata
        ? ((worldData as Record<string, unknown>).metadata as Record<string, unknown>)?.simulationRunId as string
        : undefined;

      await importDexieData(simulationRunId, worldData as Record<string, unknown>, parsed);
      await importProjectData(projectId, parsed, simulationRunId);
      await persistParsedContext(projectId, parsed, params);
      await slotOps.handleLoadSlot(slotIndex);
    },
    [projectId, slotOps, params],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  // -------------------------------------------------------------------------
  // Standard slot export (JSON download)
  // -------------------------------------------------------------------------

  const handleExportSlotDownload = useCallback(
    (slotIndex: number) => {
      const slot = slots[slotIndex];
      if (!slot) { alert("Slot is empty."); return; }
      const wd = slot.worldData || slot.simulationResults;
      if (!isWorldOutput(wd)) { alert("Slot does not contain a valid world output."); return; }
      const exportWc = normalizeWorldContextForExport(worldContext as Record<string, unknown>);
      const exportPayload = {
        format: SLOT_EXPORT_FORMAT, version: SLOT_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        slot: {
          index: slotIndex,
          title: (slot.title as string) || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`),
          createdAt: slot.createdAt || null, savedAt: slot.savedAt || null,
        },
        worldData: wd, simulationResults: slot.simulationResults || null,
        simulationState: slot.simulationState || null,
        worldContext: exportWc, entityGuidance: entityGuidance ?? null,
        cultureIdentities: cultureIdentities ?? null,
      };
      const slotFallback = `slot-${slotIndex}`;
      const safeBase = buildExportBase(exportPayload.slot.title, slotFallback);
      const filename = `${safeBase || slotFallback}.canonry-slot.json`;
      downloadJson(exportPayload, filename);
    },
    [slots, worldContext, entityGuidance, cultureIdentities],
  );

  // -------------------------------------------------------------------------
  // Viewer bundle export
  // -------------------------------------------------------------------------

  const handleExportBundle = useCallback(
    async (slotIndex: number) => {
      if (!projectId) return;
      const slot = slots[slotIndex];
      if (!slot) { alert("Slot is empty."); return; }
      const slotWd = slot.worldData || slot.simulationResults;
      const liveWd = slotIndex === activeSlotIndex ? archivistData?.worldData : null;
      const worldData = pickBestWorldData(slotWd, liveWd);
      if (!isWorldOutput(worldData)) { alert("Slot does not contain a valid world output."); return; }

      const shouldCancel = () => exportCancelRef.current;
      exportCancelRef.current = false;
      setExportBundleStatus({ state: "working", detail: "Gathering run data..." });

      try {
        const simRunId = (worldData as Record<string, unknown>)?.metadata
          ? ((worldData as Record<string, unknown>).metadata as Record<string, unknown>)?.simulationRunId as string
          : undefined;
        const exportWorldData = await hydrateWorldDataFromDexie({
          worldData: worldData as Record<string, unknown>,
          projectId,
          simulationRunId: simRunId || "",
        });
        const [loreData, staticPagesRaw, chroniclesRaw, eraNarrativesRaw] = await Promise.all([
          extractLoreDataWithCurrentImageRefs(exportWorldData),
          getStaticPagesForProject(projectId),
          simRunId
            ? getCompletedChroniclesForSimulation(simRunId)
            : getCompletedChroniclesForProject(projectId),
          simRunId ? getCompletedEraNarrativesForSimulation(simRunId) : Promise.resolve([]),
        ]);
        throwIfExportCanceled(shouldCancel);

        const staticPages = (staticPagesRaw || []).filter(
          (page: Record<string, unknown>) => page.status === "published",
        );
        const chronicles = chroniclesRaw || [];
        const eraNarratives = eraNarrativesRaw || [];

        const useS3Images = Boolean(awsConfig?.useS3Images && awsConfig?.imageBucket);
        const imageStorage = useS3Images ? buildImageStorageConfig(awsConfig, projectId) : null;
        if (useS3Images) {
          if (!s3Client) throw new Error("S3 sync is enabled but AWS credentials are not ready.");
          setExportBundleStatus((prev) =>
            prev.state === "working" ? { ...prev, detail: "Syncing images to S3..." } : prev,
          );
          await syncProjectImagesToS3({
            projectId, s3: s3Client, config: awsConfig,
            onProgress: ({ processed, total, uploaded }: { processed: number; total: number; uploaded: number }) => {
              setExportBundleStatus((prev) =>
                prev.state === "working"
                  ? { ...prev, detail: `Syncing images to S3 (${processed}/${total}, uploaded ${uploaded})...` }
                  : prev,
              );
            },
          });
        }

        const { imageData, images, imageFiles } = await buildBundleImageAssets({
          projectId, worldData: exportWorldData, chronicles, staticPages, eraNarratives,
          shouldCancel,
          onProgress: ({ phase, processed, total }) => {
            if (phase !== "images") return;
            setExportBundleStatus((prev) =>
              prev.state === "working"
                ? { ...prev, detail: `Collecting images (${processed}/${total})...` }
                : prev,
            );
          },
          mode: useS3Images ? "s3" : "local",
          storage: imageStorage,
        });

        throwIfExportCanceled(shouldCancel);
        setExportBundleStatus((prev) =>
          prev.state === "working" ? { ...prev, detail: "Packaging bundle..." } : prev,
        );

        const exportTitle = (slot.title as string) || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`);
        const safeBase = buildExportBase(exportTitle, `slot-${slotIndex}`);
        const exportedAt = new Date().toISOString();
        const bundle = {
          format: "canonry-viewer-bundle", version: 1,
          metadata: {
            title: exportTitle, exportedAt, projectId,
            projectName: projectName || null,
            simulationRunId: simRunId || null,
          },
          projectId,
          slot: { index: slotIndex, title: exportTitle, createdAt: slot.createdAt || null, savedAt: slot.savedAt || null },
          worldData: exportWorldData, loreData, staticPages, chronicles, eraNarratives, imageData, images,
        };
        const bundleJson = JSON.stringify(bundle, null, 2);
        throwIfExportCanceled(shouldCancel);

        await downloadBundleOrZip(imageFiles, bundleJson, safeBase, slotIndex, exportedAt);
        slotOps.closeExportModal();
      } catch (err) {
        if ((err as Error)?.name === EXPORT_CANCEL_ERROR_NAME) return;
        console.error("Failed to export bundle:", err);
        alert((err as Error).message || "Failed to export bundle");
      } finally {
        exportCancelRef.current = false;
        setExportBundleStatus({ state: "idle", detail: "" });
      }
    },
    [activeSlotIndex, archivistData?.worldData, awsConfig, projectId, projectName, s3Client, slots, slotOps, exportCancelRef, setExportBundleStatus],
  );

  const handleExportSlot = useCallback(
    (slotIndex: number) => {
      const slot = slots[slotIndex];
      if (!slot) { alert("Slot is empty."); return; }
      slotOps.openExportModal(slotIndex);
    },
    [slots, slotOps],
  );

  const handleImportSlot = useCallback(
    async (slotIndex: number, file: File) => {
      if (!projectId || !file) return;
      try {
        const payload = await readImportFile(file);
        await importSlotPayload(slotIndex, payload, { defaultTitle: "Imported Output" });
      } catch (err) {
        console.error("Failed to import slot:", err);
        alert((err as Error).message || "Failed to import slot data");
      }
    },
    [projectId, importSlotPayload],
  );

  const handleLoadExampleOutput = useCallback(async () => {
    if (!projectId) return;
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const response = await fetch(`${baseUrl}default-project/worldOutput.json`);
      if (!response.ok) throw new Error("Example output not found.");
      const payload = await response.json();
      await importSlotPayload(0, payload, { defaultTitle: "Example Output" });
    } catch (err) {
      console.error("Failed to load example output:", err);
      alert((err as Error).message || "Failed to load example output");
    }
  }, [projectId, importSlotPayload]);

  return {
    handleExportSlotDownload,
    handleExportBundle,
    handleExportSlot,
    handleImportSlot,
    handleLoadExampleOutput,
  };
}

// ---------------------------------------------------------------------------
// Helpers (kept outside the hook to avoid closure complexity)
// ---------------------------------------------------------------------------

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadBundleOrZip(
  imageFiles: Array<{ path: string; blob: Blob }>,
  bundleJson: string,
  safeBase: string,
  slotIndex: number,
  exportedAt: string,
): Promise<void> {
  if (imageFiles.length === 0) {
    const timestamp = exportedAt.replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
    const bundleBase = safeBase || `slot-${slotIndex}`;
    downloadJson(JSON.parse(bundleJson), `${bundleBase}.bundle.${timestamp}.json`);
  } else {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file("bundle.json", bundleJson);
    for (const file of imageFiles) zip.file(file.path, file.blob);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    const zipBase = safeBase || `slot-${slotIndex}`;
    link.download = `${zipBase}.canonry-bundle.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

async function readImportFile(file: File): Promise<Record<string, unknown>> {
  const isZip = file.type === "application/zip" || file.name?.toLowerCase().endsWith(".zip");
  if (isZip) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    const bundleFile = zip.file("bundle.json");
    if (!bundleFile) throw new Error("Bundle zip is missing bundle.json.");
    const text = await bundleFile.async("string");
    return JSON.parse(text);
  }
  const text = await file.text();
  return JSON.parse(text);
}

function pickBestWorldData(slotWd: unknown, liveWd: unknown): unknown {
  const slotRunId = (slotWd as Record<string, unknown>)?.metadata
    ? ((slotWd as Record<string, unknown>).metadata as Record<string, unknown>)?.simulationRunId
    : undefined;
  const liveRunId = (liveWd as Record<string, unknown>)?.metadata
    ? ((liveWd as Record<string, unknown>).metadata as Record<string, unknown>)?.simulationRunId
    : undefined;
  if (isWorldOutput(liveWd) && (!slotWd || !slotRunId || slotRunId === liveRunId)) {
    return liveWd;
  }
  return slotWd;
}

async function importDexieData(
  simulationRunId: string | undefined,
  worldData: Record<string, unknown>,
  parsed: ParsedSlotPayload,
): Promise<void> {
  if (simulationRunId && Array.isArray(worldData?.hardState) && (worldData.hardState as unknown[]).length > 0) {
    const entityResult = await importEntities(simulationRunId, worldData.hardState);
    console.log("[Canonry] Import entities (Dexie)", entityResult);
  }
  if (simulationRunId && Array.isArray(worldData?.narrativeHistory) && (worldData.narrativeHistory as unknown[]).length > 0) {
    const eventResult = await importNarrativeEvents(simulationRunId, worldData.narrativeHistory);
    console.log("[Canonry] Import narrative events (Dexie)", eventResult);
  }
  if (!simulationRunId && (worldData?.hardState as unknown[])?.length) {
    console.warn("[Canonry] Import skipped Dexie entity merge: missing simulationRunId");
  }
}

async function importProjectData(
  projectId: string,
  parsed: ParsedSlotPayload,
  simulationRunId: string | undefined,
): Promise<void> {
  if (Array.isArray(parsed.staticPages) && parsed.staticPages.length > 0) {
    await importStaticPages(projectId, parsed.staticPages, { preserveIds: true });
  }
  if (Array.isArray(parsed.chronicles) && parsed.chronicles.length > 0) {
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

async function persistParsedContext(
  projectId: string,
  parsed: ParsedSlotPayload,
  params: UseExportCallbacksParams,
): Promise<void> {
  if (parsed.worldContext !== undefined) {
    // We can't call React setters here directly since this is a pure function.
    // The parent hook handles this through the slotOps.handleLoadSlot call.
    await saveWorldContext(projectId, parsed.worldContext);
  }
  if (parsed.entityGuidance !== undefined) {
    await saveEntityGuidance(projectId, parsed.entityGuidance);
  }
  if (parsed.cultureIdentities !== undefined) {
    await saveCultureIdentities(projectId, parsed.cultureIdentities);
  }
}
