/**
 * useExportCallbacks - Export/import callbacks for the Canonry shell.
 *
 * Handles: slot download, viewer bundle export, slot/bundle import, example output loading.
 */

import { useCallback, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { getSlot, saveSlot } from "../storage/worldStore";
import { getStaticPagesForProject } from "../storage/staticPageStorage";
import {
  getCompletedChroniclesForSimulation,
  getCompletedChroniclesForProject,
} from "../storage/chronicleStorage";
import { getCompletedEraNarrativesForSimulation } from "../storage/eraNarrativeStorage";
import { createS3Client, buildImageStorageConfig, syncProjectImagesToS3 } from "../aws/awsS3";
import { useCanonryAwsStore } from "../stores/useCanonryAwsStore";
import {
  isWorldOutput,
  mergeDefined,
  buildExportBase,
  normalizeWorldContextForExport,
  extractLoreDataWithCurrentImageRefs,
  hydrateWorldDataFromDexie,
} from "../lib/bundleExportUtils";
import {
  buildBundleImageAssets,
  throwIfExportCanceled,
  EXPORT_CANCEL_ERROR_NAME,
} from "../lib/imageAssetBuilder";
import {
  SLOT_EXPORT_FORMAT,
  SLOT_EXPORT_VERSION,
  parseSlotImportPayload,
  extractSimulationRunId,
  resolveSlotTitle,
  resolveSlotCreatedAt,
  importDexieData,
  importProjectData,
  persistParsedContext,
} from "./slotPayloadParsing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportBundleStatus {
  state: "idle" | "working" | "error";
  detail: string;
}

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
  exportCancelRef: RefObject<boolean>;
  setExportBundleStatus: Dispatch<SetStateAction<ExportBundleStatus>>;
  worldContext: unknown;
  entityGuidance: unknown;
  cultureIdentities: unknown;
  slotOps: SlotOperations;
}

// ---------------------------------------------------------------------------
// Extracted helpers (reduce callback complexity)
// ---------------------------------------------------------------------------

function updateWorkingDetail(detail: string): (prev: ExportBundleStatus) => ExportBundleStatus {
  return (prev) => prev.state === "working" ? { ...prev, detail } : prev;
}

function handleBundleExportError(err: unknown): void {
  if ((err as Error)?.name === EXPORT_CANCEL_ERROR_NAME) return;
  console.error("Failed to export bundle:", err);
  alert((err as Error).message || "Failed to export bundle");
}

function pickBestWorldData(slotWd: unknown, liveWd: unknown): unknown {
  if (!isWorldOutput(liveWd)) return slotWd;
  const slotRunId = extractSimulationRunId(slotWd);
  const liveRunId = extractSimulationRunId(liveWd);
  if (!slotWd || !slotRunId || slotRunId === liveRunId) return liveWd;
  return slotWd;
}

interface GatheredExportData {
  exportWorldData: Record<string, unknown>;
  loreData: unknown;
  staticPages: unknown[];
  chronicles: unknown[];
  eraNarratives: unknown[];
  simRunId: Optional<string>;
}

async function gatherBundleExportData(
  projectId: string,
  worldData: unknown,
  shouldCancel: () => boolean,
): Promise<GatheredExportData> {
  const simRunId = extractSimulationRunId(worldData);
  const exportWorldData = await hydrateWorldDataFromDexie({
    worldData: worldData as Record<string, unknown>,
    projectId,
    simulationRunId: simRunId || "",
  });
  const loreData = extractLoreDataWithCurrentImageRefs(exportWorldData);
  const [staticPagesRaw, chroniclesRaw, eraNarrativesRaw] = await Promise.all([
    getStaticPagesForProject(projectId),
    simRunId
      ? getCompletedChroniclesForSimulation(simRunId)
      : getCompletedChroniclesForProject(projectId),
    simRunId ? getCompletedEraNarrativesForSimulation(simRunId) : Promise.resolve<unknown[]>([]),
  ]);
  throwIfExportCanceled(shouldCancel);
  const staticPages = (staticPagesRaw || []).filter(
    (page) => (page as Record<string, unknown>).status === "published",
  );
  return {
    exportWorldData, loreData,
    staticPages, chronicles: chroniclesRaw || [], eraNarratives: eraNarrativesRaw || [],
    simRunId,
  };
}

async function maybeSyncS3Images(
  useS3Images: boolean,
  s3Client: unknown,
  projectId: string,
  awsConfig: Record<string, unknown>,
  setExportBundleStatus: Dispatch<SetStateAction<ExportBundleStatus>>,
): Promise<void> {
  if (!useS3Images) return;
  if (!s3Client) throw new Error("S3 sync is enabled but AWS credentials are not ready.");
  setExportBundleStatus(updateWorkingDetail("Syncing images to S3..."));
  await syncProjectImagesToS3({
    projectId, s3: s3Client, config: awsConfig,
    onProgress: ({ processed, total, uploaded }: { processed: number; total: number; uploaded: number }) => {
      setExportBundleStatus(updateWorkingDetail(`Syncing images to S3 (${processed}/${total}, uploaded ${uploaded})...`));
    },
  });
}

async function processBundleImages(
  projectId: string,
  gathered: GatheredExportData,
  shouldCancel: () => boolean,
  awsConfig: Record<string, unknown>,
  s3Client: unknown,
  setExportBundleStatus: Dispatch<SetStateAction<ExportBundleStatus>>,
): Promise<{ imageData: unknown; images: unknown; imageFiles: Array<{ path: string; blob: Blob }> }> {
  const useS3Images = Boolean(awsConfig?.useS3Images && awsConfig?.imageBucket);
  await maybeSyncS3Images(useS3Images, s3Client, projectId, awsConfig, setExportBundleStatus);
  return buildBundleImageAssets({
    projectId, worldData: gathered.exportWorldData,
    chronicles: gathered.chronicles, staticPages: gathered.staticPages, eraNarratives: gathered.eraNarratives,
    shouldCancel,
    onProgress: ({ phase, processed, total }) => {
      if (phase !== "images") return;
      setExportBundleStatus(updateWorkingDetail(`Collecting images (${processed}/${total})...`));
    },
    mode: useS3Images ? "s3" : "local",
    storage: useS3Images ? buildImageStorageConfig(awsConfig, projectId) : null,
  });
}

function buildSlotExportPayload(
  slot: Record<string, unknown>,
  slotIndex: number,
  worldData: unknown,
  worldContext: unknown,
  entityGuidance: unknown,
  cultureIdentities: unknown,
): Record<string, unknown> {
  const exportWc = normalizeWorldContextForExport(worldContext as Record<string, unknown>);
  const title = (slot.title as string) || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`);
  return {
    format: SLOT_EXPORT_FORMAT, version: SLOT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    slot: {
      index: slotIndex, title,
      createdAt: slot.createdAt || null, savedAt: slot.savedAt || null,
    },
    worldData, simulationResults: slot.simulationResults || null,
    simulationState: slot.simulationState || null,
    worldContext: exportWc, entityGuidance: entityGuidance ?? null,
    cultureIdentities: cultureIdentities ?? null,
  };
}

function assembleBundlePayload(
  slot: Record<string, unknown>,
  slotIndex: number,
  exportWorldData: Record<string, unknown>,
  loreData: unknown,
  staticPages: unknown[],
  chronicles: unknown[],
  eraNarratives: unknown[],
  imageData: unknown,
  images: unknown,
  projectId: string,
  projectName: string | undefined,
  simRunId: string | undefined,
): { bundle: Record<string, unknown>; safeBase: string; exportedAt: string } {
  const exportTitle = (slot.title as string) || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`);
  const exportedAt = new Date().toISOString();
  const safeBase = buildExportBase(exportTitle, `slot-${slotIndex}`);
  return {
    bundle: {
      format: "canonry-viewer-bundle", version: 1,
      metadata: {
        title: exportTitle, exportedAt, projectId,
        projectName: projectName || null,
        simulationRunId: simRunId || null,
      },
      projectId,
      slot: { index: slotIndex, title: exportTitle, createdAt: slot.createdAt || null, savedAt: slot.savedAt || null },
      worldData: exportWorldData, loreData, staticPages, chronicles, eraNarratives, imageData, images,
    },
    safeBase,
    exportedAt,
  };
}

// ---------------------------------------------------------------------------
// Download helpers
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
    return JSON.parse(text) as Record<string, unknown>;
  }
  const text = await file.text();
  return JSON.parse(text) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function -- coordination hook returning 5 useCallback wrappers that delegate to extracted helpers; structurally uniform thin callbacks, not complex logic
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

  const importSlotPayload = useCallback(
    async (slotIndex: number, payload: Record<string, unknown>, defaultTitle: string) => {
      if (!projectId) return;
      const parsed = parseSlotImportPayload(payload);
      const now = Date.now();
      const existingSlot = ((await getSlot(projectId, slotIndex)) || {}) as Record<string, unknown>;
      const title = resolveSlotTitle(parsed, existingSlot.title as string, defaultTitle, slotIndex, now);
      const createdAt = resolveSlotCreatedAt(parsed, existingSlot.createdAt as number, now);
      const worldData = mergeDefined(parsed.worldData, existingSlot.worldData ?? null);
      const simResults = mergeDefined(parsed.simulationResults ?? parsed.worldData, existingSlot.simulationResults ?? null);
      const simState = mergeDefined(parsed.simulationState, existingSlot.simulationState ?? null);

      await saveSlot(projectId, slotIndex, {
        ...existingSlot, title, createdAt, savedAt: now,
        simulationResults: simResults, simulationState: simState, worldData,
      });
      const simulationRunId = extractSimulationRunId(worldData);
      await importDexieData(simulationRunId, worldData as Record<string, unknown>);
      await importProjectData(projectId, parsed, simulationRunId);
      await persistParsedContext(projectId, parsed);
      await slotOps.handleLoadSlot(slotIndex);
    },
    [projectId, slotOps],
  );

  const handleExportSlotDownload = useCallback(
    (slotIndex: number) => {
      const slot = slots[slotIndex];
      if (!slot) { alert("Slot is empty."); return; }
      const wd = slot.worldData || slot.simulationResults;
      if (!isWorldOutput(wd)) { alert("Slot does not contain a valid world output."); return; }
      const exportPayload = buildSlotExportPayload(slot, slotIndex, wd, worldContext, entityGuidance, cultureIdentities);
      const slotFallback = `slot-${slotIndex}`;
      const safeBase = buildExportBase((exportPayload.slot as Record<string, unknown>).title as string, slotFallback);
      downloadJson(exportPayload, `${safeBase || slotFallback}.canonry-slot.json`);
    },
    [slots, worldContext, entityGuidance, cultureIdentities],
  );

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
        const gathered = await gatherBundleExportData(projectId, worldData, shouldCancel);
        const { imageData, images, imageFiles } = await processBundleImages(
          projectId, gathered, shouldCancel, awsConfig, s3Client, setExportBundleStatus,
        );

        throwIfExportCanceled(shouldCancel);
        setExportBundleStatus(updateWorkingDetail("Packaging bundle..."));

        const { bundle, safeBase, exportedAt } = assembleBundlePayload(
          slot, slotIndex, gathered.exportWorldData, gathered.loreData,
          gathered.staticPages, gathered.chronicles, gathered.eraNarratives,
          imageData, images, projectId, projectName, gathered.simRunId,
        );
        const bundleJson = JSON.stringify(bundle, null, 2);
        throwIfExportCanceled(shouldCancel);

        await downloadBundleOrZip(imageFiles, bundleJson, safeBase, slotIndex, exportedAt);
        slotOps.closeExportModal();
      } catch (err) {
        handleBundleExportError(err);
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
        await importSlotPayload(slotIndex, payload, "Imported Output");
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
      const baseUrl = ((import.meta as unknown as { env: Record<string, string> }).env.BASE_URL) || "/";
      const response = await fetch(`${baseUrl}default-project/worldOutput.json`);
      if (!response.ok) throw new Error("Example output not found.");
      const payload = (await response.json()) as Record<string, unknown>;
      await importSlotPayload(0, payload, "Example Output");
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
