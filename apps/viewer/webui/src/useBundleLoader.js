import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useImageStore, CDNBackend } from "@penguin-tales/image-store";
import { useNarrativeStore } from "@penguin-tales/narrative-store";
import { overwriteWorldDataInDexie } from "./lib/illuminatorDbWriter";
import {
  resolveBundleUrl,
  resolveBundleManifestUrl,
  loadBundleViaManifest,
  loadBundleFallback,
} from "./bundleLoader";

function useLoadBundle() {
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [bundleRequestUrl, setBundleRequestUrl] = useState(() => resolveBundleUrl());
  const loadSequence = useRef(0);

  const bundleManifestUrl = useMemo(() => resolveBundleManifestUrl(), []);
  const bundleFallbackUrl = useMemo(() => resolveBundleUrl(), []);

  const loadBundle = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setStatus("loading");
    setError(null);
    useNarrativeStore.getState().reset();

    try {
      const normalized = await loadBundleViaManifest(bundleManifestUrl, setBundleRequestUrl);
      if (sequence !== loadSequence.current) return;
      setBundle(normalized);
      setStatus("ready");
      return;
    } catch (err) {
      console.warn("Viewer: failed to load bundle manifest, falling back to bundle.json.", err);
    }

    try {
      const normalized = await loadBundleFallback(bundleFallbackUrl, setBundleRequestUrl);
      if (sequence !== loadSequence.current) return;
      setBundle(normalized);
      setStatus("ready");
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setStatus("error");
      setError(err);
    }
  }, [bundleManifestUrl, bundleFallbackUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadBundle();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBundle]);

  return { bundle, status, error, bundleRequestUrl, loadBundle };
}

function useDexiePersistence(bundle) {
  const [dexieSeededAt, setDexieSeededAt] = useState(0);
  const lastDexieIngestRef = useRef(null);

  useEffect(() => {
    if (!bundle?.worldData || !bundle?.projectId) return;
    const simulationRunId = bundle.worldData?.metadata?.simulationRunId;
    if (!simulationRunId) return;

    const ingestKey = `${bundle.projectId}:${simulationRunId}`;
    if (lastDexieIngestRef.current === ingestKey) return;
    lastDexieIngestRef.current = ingestKey;

    let cancelled = false;
    (async () => {
      try {
        await overwriteWorldDataInDexie({
          projectId: bundle.projectId,
          slotIndex: typeof bundle.slot?.index === "number" ? bundle.slot.index : 0,
          worldData: bundle.worldData,
          chronicles: bundle.chronicles,
          staticPages: bundle.staticPages,
          eraNarratives: bundle.eraNarratives,
        });
        if (!cancelled) setDexieSeededAt(Date.now());
      } catch (err) {
        console.warn("[Viewer] Failed to persist bundle to Dexie:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  return dexieSeededAt;
}

function useBundlePreloads(bundle) {
  const preloadedChronicles = useMemo(() => {
    if (!bundle?.chronicles) return undefined;
    return bundle.chronicles.filter((c) => c?.status === "complete" && c.acceptedAt);
  }, [bundle]);

  const preloadedStaticPages = useMemo(() => {
    if (!bundle?.staticPages) return undefined;
    return bundle.staticPages.filter((p) => p?.status === "published");
  }, [bundle]);

  const preloadedEraNarratives = useMemo(() => {
    if (!bundle?.eraNarratives) return undefined;
    return bundle.eraNarratives.filter((n) => n?.status === "complete" && n.content);
  }, [bundle]);

  useEffect(() => {
    if (!bundle) return;
    const backend = new CDNBackend(bundle.imageData || null, bundle.images || null);
    useImageStore.getState().configure(backend);
    return () => useImageStore.getState().cleanup();
  }, [bundle]);

  return { preloadedChronicles, preloadedStaticPages, preloadedEraNarratives };
}

export default function useBundleLoader() {
  const { bundle, status, error, bundleRequestUrl, loadBundle } = useLoadBundle();
  const dexieSeededAt = useDexiePersistence(bundle);
  const preloads = useBundlePreloads(bundle);

  return { bundle, status, error, bundleRequestUrl, loadBundle, dexieSeededAt, ...preloads };
}
