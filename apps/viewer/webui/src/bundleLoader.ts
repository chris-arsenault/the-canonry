import type { BundleImageResult } from "@the-canonry/image-store";
import { useNarrativeStore, FetchBackend } from "@the-canonry/narrative-store";
import type { WorldOutput, NarrativeEvent } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";

const DEFAULT_BUNDLE_PATH = "bundles/default/bundle.json";
const DEFAULT_BUNDLE_MANIFEST_PATH = "bundles/default/bundle.manifest.json";

interface ViewerImageData {
  results: BundleImageResult[];
  totalImages: number;
  [key: string]: unknown;
}

type ValidatedWorldData = WorldOutput & { narrativeHistory: NarrativeEvent[] };

export interface ViewerBundle {
  projectId: string;
  slot: Optional<{ index: number }>;
  worldData: ValidatedWorldData;
  chronicles: Record<string, unknown>[];
  staticPages: Record<string, unknown>[];
  eraNarratives: Optional<Record<string, unknown>[]>;
  images: Record<string, string> | null;
  imageData: ViewerImageData | null;
  precomputedPageIndex: Optional<unknown>;
  [key: string]: unknown;
}

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL || "./";
  const resolved = new URL(base, window.location.href);
  if (!resolved.pathname.endsWith("/")) {
    resolved.pathname = `${resolved.pathname}/`;
  }
  resolved.search = "";
  resolved.hash = "";
  return resolved.toString();
}

export function resolveBundleUrl(): string {
  return new URL(DEFAULT_BUNDLE_PATH, resolveBaseUrl()).toString();
}

export function resolveBundleManifestUrl(): string {
  return new URL(DEFAULT_BUNDLE_MANIFEST_PATH, resolveBaseUrl()).toString();
}

function resolveAssetUrl(value: string, bundleUrl: string): string {
  try {
    return new URL(value, bundleUrl).toString();
  } catch {
    return value;
  }
}

function resolveImageResults(
  results: BundleImageResult[],
  resolveUrl: (value: string) => string,
): BundleImageResult[] {
  return results.map((image) => ({
    ...image,
    localPath: image.localPath ? resolveUrl(image.localPath) : image.localPath,
    thumbPath: image.thumbPath ? resolveUrl(image.thumbPath) : undefined,
    fullPath: image.fullPath ? resolveUrl(image.fullPath) : undefined,
  }));
}

function resolveImageMap(
  rawImages: unknown,
  resolveUrl: (value: string) => string,
): Record<string, string> | null {
  if (!rawImages || typeof rawImages !== "object") return null;
  return Object.fromEntries(
    Object.entries(rawImages as Record<string, string>).map(([imageId, path]) => [imageId, resolveUrl(path)])
  );
}

function resolveImageData(
  rawImageData: unknown,
  resolveUrl: (value: string) => string,
): ViewerImageData | null {
  if (!rawImageData || typeof rawImageData !== "object") return null;
  const data = rawImageData as Record<string, unknown>;
  const imageResults = Array.isArray(data.results)
    ? resolveImageResults(data.results as BundleImageResult[], resolveUrl)
    : [];
  return {
    ...(data as ViewerImageData),
    results: imageResults,
    totalImages: Number.isFinite(data.totalImages)
      ? (data.totalImages as number)
      : imageResults.length,
  };
}

export function normalizeBundle(raw: unknown, bundleUrl: string): ViewerBundle | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const baseUrl = new URL(".", bundleUrl).toString();
  const resolveUrl = (value: string) => resolveAssetUrl(value, baseUrl);

  return {
    ...obj,
    chronicles: Array.isArray(obj.chronicles) ? (obj.chronicles as Record<string, unknown>[]) : [],
    staticPages: Array.isArray(obj.staticPages) ? (obj.staticPages as Record<string, unknown>[]) : [],
    images: resolveImageMap(obj.images, resolveUrl),
    imageData: resolveImageData(obj.imageData, resolveUrl),
  } as ViewerBundle;
}

async function fetchJson(url: string, options?: { cache: Optional<RequestCache> }): Promise<unknown> {
  const response = await fetch(url, { cache: options?.cache ?? "default" });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}

function validateAndNormalizeBundle(data: unknown, sourceUrl: string): ViewerBundle {
  const normalized = normalizeBundle(data, sourceUrl);
  if (!normalized?.worldData) {
    throw new Error("Bundle is missing worldData.");
  }
  if (!Array.isArray(normalized.worldData.narrativeHistory)) {
    (normalized.worldData as Record<string, unknown>).narrativeHistory = [];
  }
  return normalized;
}

interface ManifestTimelines {
  files: Optional<Record<string, { path: string; eventCount: number }>>;
  totalEvents: Optional<number>;
}

function configureNarrativeBackend(
  manifest: Record<string, unknown>,
  manifestBaseUrl: string,
  simulationRunId: string | undefined,
): void {
  const timelines = manifest.timelines as ManifestTimelines | undefined;
  const timelineFiles = timelines?.files;
  if (timelineFiles && typeof timelineFiles === "object") {
    const backend = new FetchBackend(manifestBaseUrl, timelineFiles);
    useNarrativeStore.getState().configureBackend(backend);
    if (simulationRunId) {
      useNarrativeStore.getState().setSimulationRunId(simulationRunId);
    }
  }
  useNarrativeStore.getState().setStatus({
    loading: false,
    totalExpected: timelines?.totalEvents ?? 0,
    chunksLoaded: 0,
    chunksTotal: 0,
  });
}

export async function loadBundleViaManifest(
  manifestUrl: string,
  setBundleRequestUrl: (url: string) => void,
): Promise<ViewerBundle> {
  setBundleRequestUrl(manifestUrl);
  const manifest = await fetchJson(manifestUrl, { cache: "no-store" }) as Record<string, unknown>;
  if (!manifest || manifest.format !== "viewer-bundle-manifest") {
    throw new Error("Bundle manifest missing or invalid.");
  }

  const manifestBaseUrl = new URL(".", manifestUrl).toString();
  const corePath = manifest.core;
  if (typeof corePath !== "string") {
    throw new Error("Bundle manifest is missing core path.");
  }
  const coreUrl = resolveAssetUrl(corePath, manifestBaseUrl);
  setBundleRequestUrl(coreUrl);
  const data = await fetchJson(coreUrl);

  const normalized = validateAndNormalizeBundle(data, coreUrl);
  configureNarrativeBackend(
    manifest,
    manifestBaseUrl,
    normalized.worldData?.metadata?.simulationRunId,
  );
  return normalized;
}

export async function loadBundleFallback(
  fallbackUrl: string,
  setBundleRequestUrl: (url: string) => void,
): Promise<ViewerBundle> {
  setBundleRequestUrl(fallbackUrl);
  const data = await fetchJson(fallbackUrl, { cache: "no-store" });
  const normalized = validateAndNormalizeBundle(data, fallbackUrl);
  const totalEvents = normalized.worldData.narrativeHistory.length;

  if (totalEvents > 0) {
    useNarrativeStore.getState().ingestChunk(normalized.worldData.narrativeHistory);
  }
  useNarrativeStore.getState().setStatus({
    loading: false,
    totalExpected: totalEvents,
    chunksLoaded: totalEvents ? 1 : 0,
    chunksTotal: totalEvents ? 1 : 0,
  });

  return normalized;
}
