import { useNarrativeStore, FetchBackend } from "@penguin-tales/narrative-store";

const DEFAULT_BUNDLE_PATH = "bundles/default/bundle.json";
const DEFAULT_BUNDLE_MANIFEST_PATH = "bundles/default/bundle.manifest.json";

function resolveBaseUrl() {
  const base = import.meta.env.BASE_URL || "./";
  const resolved = new URL(base, window.location.href);
  if (!resolved.pathname.endsWith("/")) {
    resolved.pathname = `${resolved.pathname}/`;
  }
  resolved.search = "";
  resolved.hash = "";
  return resolved.toString();
}

export function resolveBundleUrl() {
  return new URL(DEFAULT_BUNDLE_PATH, resolveBaseUrl()).toString();
}

export function resolveBundleManifestUrl() {
  return new URL(DEFAULT_BUNDLE_MANIFEST_PATH, resolveBaseUrl()).toString();
}

function resolveAssetUrl(value, bundleUrl) {
  if (!value || typeof value !== "string") return value;
  try {
    return new URL(value, bundleUrl).toString();
  } catch {
    return value;
  }
}

function resolveImageResults(results, resolveUrl) {
  return results.map((image) => ({
    ...image,
    localPath: resolveUrl(image.localPath),
    thumbPath: image.thumbPath ? resolveUrl(image.thumbPath) : undefined,
    fullPath: image.fullPath ? resolveUrl(image.fullPath) : undefined,
  }));
}

function resolveImageMap(rawImages, resolveUrl) {
  if (!rawImages || typeof rawImages !== "object") return null;
  return Object.fromEntries(
    Object.entries(rawImages).map(([imageId, path]) => [imageId, resolveUrl(path)])
  );
}

function resolveImageData(rawImageData, resolveUrl) {
  if (!rawImageData) return null;
  const imageResults = Array.isArray(rawImageData.results)
    ? resolveImageResults(rawImageData.results, resolveUrl)
    : [];
  return {
    ...rawImageData,
    results: imageResults,
    totalImages: Number.isFinite(rawImageData.totalImages)
      ? rawImageData.totalImages
      : imageResults.length,
  };
}

export function normalizeBundle(raw, bundleUrl) {
  if (!raw || typeof raw !== "object") return null;

  const baseUrl = new URL(".", bundleUrl).toString();
  const resolveUrl = (value) => resolveAssetUrl(value, baseUrl);

  return {
    ...raw,
    chronicles: Array.isArray(raw.chronicles) ? raw.chronicles : [],
    staticPages: Array.isArray(raw.staticPages) ? raw.staticPages : [],
    images: resolveImageMap(raw.images, resolveUrl),
    imageData: resolveImageData(raw.imageData, resolveUrl),
  };
}

async function fetchJson(url, { cache } = {}) {
  const response = await fetch(url, { cache: cache ?? "default" });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}

function validateAndNormalizeBundle(data, sourceUrl) {
  const normalized = normalizeBundle(data, sourceUrl);
  if (!normalized?.worldData) {
    throw new Error("Bundle is missing worldData.");
  }
  if (!Array.isArray(normalized.worldData.narrativeHistory)) {
    normalized.worldData.narrativeHistory = [];
  }
  return normalized;
}

function configureNarrativeBackend(manifest, manifestBaseUrl, simulationRunId) {
  const timelineFiles = manifest?.timelines?.files;
  if (timelineFiles && typeof timelineFiles === "object") {
    const backend = new FetchBackend(manifestBaseUrl, timelineFiles);
    useNarrativeStore.getState().configureBackend(backend);
    if (simulationRunId) {
      useNarrativeStore.getState().setSimulationRunId(simulationRunId);
    }
  }
  useNarrativeStore.getState().setStatus({
    loading: false,
    totalExpected: manifest?.timelines?.totalEvents ?? 0,
    chunksLoaded: 0,
    chunksTotal: 0,
  });
}

export async function loadBundleViaManifest(manifestUrl, setBundleRequestUrl) {
  setBundleRequestUrl(manifestUrl);
  const manifest = await fetchJson(manifestUrl, { cache: "no-store" });
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
    normalized.worldData?.metadata?.simulationRunId
  );
  return normalized;
}

export async function loadBundleFallback(fallbackUrl, setBundleRequestUrl) {
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
