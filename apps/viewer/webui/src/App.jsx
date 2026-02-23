import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useImageStore, CDNBackend } from '@penguin-tales/image-store';
import { useNarrativeStore, FetchBackend } from '@penguin-tales/narrative-store';
import { getChronicles, getEntities, getSlotRecord, getStaticPages } from '@penguin-tales/world-store';
import { overwriteWorldDataInDexie } from './lib/illuminatorDbWriter';
import ChroniclerRemote from '@chronicler/ChroniclerRemote.tsx';
import parchmentTileUrl from '@chronicler/assets/textures/parchment-tile.jpg';

/**
 * HeaderSearch - Independent search component for the header bar
 * Has its own state and dropdown, navigates to Chronicler on selection
 */
function HeaderSearch({ projectId, slotIndex, dexieSeededAt, onNavigate }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPageIndex() {
      if (!projectId || typeof slotIndex !== 'number') {
        setPages([]);
        setIsIndexLoading(false);
        return;
      }

      setIsIndexLoading(true);
      try {
        const slot = await getSlotRecord(projectId, slotIndex);
        const simulationRunId = slot?.simulationRunId || null;
        if (!simulationRunId) {
          setPages([]);
          return;
        }

        const [entities, chronicles, staticPages] = await Promise.all([
          getEntities(simulationRunId),
          getChronicles(simulationRunId),
          getStaticPages(projectId),
        ]);

        if (cancelled) return;

        const result = [];

        for (const page of staticPages) {
          if (!page?.pageId) continue;
          const status = page.status || 'published';
          if (status !== 'published') continue;
          result.push({
            id: page.pageId,
            title: page.title || page.pageId,
            type: 'page',
            content: { summary: page.summary || '' },
          });
        }

        const completedChronicles = chronicles.filter(
          (chronicle) => chronicle?.status === 'complete' && Boolean(chronicle.acceptedAt)
        );
        for (const chronicle of completedChronicles) {
          if (!chronicle?.chronicleId) continue;
          result.push({
            id: chronicle.chronicleId,
            title: chronicle.title || chronicle.chronicleId,
            type: 'chronicle',
            content: { summary: chronicle.summary || '' },
          });
        }

        for (const entity of entities) {
          if (entity && entity.id && entity.name && entity.kind !== 'era') {
            result.push({
              id: entity.id,
              title: entity.name,
              type: entity.kind || 'entity',
              content: { summary: entity.description || entity.summary || '' },
            });
          }
        }

        setPages(result);
      } catch (err) {
        console.error('[viewer] Failed to build header search index:', err);
        if (!cancelled) {
          setPages([]);
        }
      } finally {
        if (!cancelled) {
          setIsIndexLoading(false);
        }
      }
    }

    loadPageIndex();

    return () => {
      cancelled = true;
    };
  }, [projectId, slotIndex, dexieSeededAt]);

  // Build Fuse.js search index
  const fuse = useMemo(() => {
    return new Fuse(pages, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'content.summary', weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [pages]);

  // Search results
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    return fuse.search(query).slice(0, 8);
  }, [fuse, query]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onNavigate(results[selectedIndex].item.id);
          setIsOpen(false);
          setQuery('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  return (
    <div className="header-search" ref={containerRef}>
      <input
        type="text"
        className="header-search-input"
        placeholder="Search wiki..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && query.length >= 2 && (
        <div className="header-search-dropdown">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.item.id}
                type="button"
                className={`header-search-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onNavigate(result.item.id);
                  setIsOpen(false);
                  setQuery('');
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="header-search-result-title">{result.item.title}</span>
                <span className="header-search-result-type">{result.item.type}</span>
              </button>
            ))
          ) : (
            <div className="header-search-no-results">
              {isIndexLoading ? 'Indexing pages...' : 'No results found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_BUNDLE_PATH = 'bundles/default/bundle.json';
const DEFAULT_BUNDLE_MANIFEST_PATH = 'bundles/default/bundle.manifest.json';

function resolveBaseUrl() {
  const base = import.meta.env.BASE_URL || './';
  const resolved = new URL(base, window.location.href);
  if (!resolved.pathname.endsWith('/')) {
    resolved.pathname = `${resolved.pathname}/`;
  }
  resolved.search = '';
  resolved.hash = '';
  return resolved.toString();
}

function resolveBundleUrl() {
  const baseUrl = resolveBaseUrl();
  return new URL(DEFAULT_BUNDLE_PATH, baseUrl).toString();
}

function resolveBundleManifestUrl() {
  const baseUrl = resolveBaseUrl();
  return new URL(DEFAULT_BUNDLE_MANIFEST_PATH, baseUrl).toString();
}

function resolveAssetUrl(value, bundleUrl) {
  if (!value || typeof value !== 'string') return value;
  try {
    return new URL(value, bundleUrl).toString();
  } catch {
    return value;
  }
}


function normalizeBundle(raw, bundleUrl) {
  if (!raw || typeof raw !== 'object') return null;

  const baseUrl = new URL('.', bundleUrl).toString();
  const resolveUrl = (value) => resolveAssetUrl(value, baseUrl);

  const imageResults = Array.isArray(raw.imageData?.results)
    ? raw.imageData.results.map((image) => ({
      ...image,
      localPath: resolveUrl(image.localPath),
      thumbPath: image.thumbPath ? resolveUrl(image.thumbPath) : undefined,
      fullPath: image.fullPath ? resolveUrl(image.fullPath) : undefined,
    }))
    : [];

  const images = raw.images && typeof raw.images === 'object'
    ? Object.fromEntries(
      Object.entries(raw.images).map(([imageId, path]) => [imageId, resolveUrl(path)])
    )
    : null;

  const imageData = raw.imageData
    ? {
      ...raw.imageData,
      results: imageResults,
      totalImages: Number.isFinite(raw.imageData.totalImages)
        ? raw.imageData.totalImages
        : imageResults.length,
    }
    : null;

  return {
    ...raw,
    chronicles: Array.isArray(raw.chronicles) ? raw.chronicles : [],
    staticPages: Array.isArray(raw.staticPages) ? raw.staticPages : [],
    images,
    imageData,
  };
}

async function fetchJson(url, { cache } = {}) {
  const response = await fetch(url, { cache: cache ?? 'default' });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  return response.json();
}

export default function App() {
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [bundleRequestUrl, setBundleRequestUrl] = useState(() => resolveBundleUrl());
  const [dexieSeededAt, setDexieSeededAt] = useState(0);
  const loadSequence = useRef(0);
  const lastDexieIngestRef = useRef(null);

  // Requested page for Chronicler (set by search or brand click, cleared after use)
  const [chroniclerRequestedPage, setChroniclerRequestedPage] = useState(null);

  const bundleManifestUrl = useMemo(() => resolveBundleManifestUrl(), []);
  const bundleFallbackUrl = useMemo(() => resolveBundleUrl(), []);

  const loadBundle = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setStatus('loading');
    setError(null);
    useNarrativeStore.getState().reset();

    try {
      setBundleRequestUrl(bundleManifestUrl);
      const manifest = await fetchJson(bundleManifestUrl, { cache: 'no-store' });
      if (sequence !== loadSequence.current) return;
      if (!manifest || manifest.format !== 'viewer-bundle-manifest') {
        throw new Error('Bundle manifest missing or invalid.');
      }

      const manifestBaseUrl = new URL('.', bundleManifestUrl).toString();
      const corePath = manifest.core;
      if (typeof corePath !== 'string') {
        throw new Error('Bundle manifest is missing core path.');
      }
      const coreUrl = resolveAssetUrl(corePath, manifestBaseUrl);
      setBundleRequestUrl(coreUrl);
      // Core bundle has content hash in filename - safe to cache aggressively
      const data = await fetchJson(coreUrl);
      if (sequence !== loadSequence.current) return;

      const normalized = normalizeBundle(data, coreUrl);
      if (!normalized?.worldData) {
        throw new Error('Bundle is missing worldData.');
      }
      if (!Array.isArray(normalized.worldData.narrativeHistory)) {
        normalized.worldData.narrativeHistory = [];
      }
      setBundle(normalized);
      setStatus('ready');

      // Configure on-demand per-entity timeline loading via FetchBackend
      const timelineFiles = manifest?.timelines?.files;
      if (timelineFiles && typeof timelineFiles === 'object') {
        const backend = new FetchBackend(manifestBaseUrl, timelineFiles);
        useNarrativeStore.getState().configureBackend(backend);
        const simulationRunId = normalized.worldData?.metadata?.simulationRunId;
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
      return;
    } catch (err) {
      console.warn('Viewer: failed to load bundle manifest, falling back to bundle.json.', err);
    }

    try {
      setBundleRequestUrl(bundleFallbackUrl);
      const data = await fetchJson(bundleFallbackUrl, { cache: 'no-store' });
      if (sequence !== loadSequence.current) return;
      const normalized = normalizeBundle(data, bundleFallbackUrl);
      if (!normalized?.worldData) {
        throw new Error('Bundle is missing worldData.');
      }
      if (!Array.isArray(normalized.worldData.narrativeHistory)) {
        normalized.worldData.narrativeHistory = [];
      }
      const totalEvents = normalized.worldData.narrativeHistory.length;
      setBundle(normalized);
      setStatus('ready');
      if (totalEvents > 0) {
        useNarrativeStore.getState().ingestChunk(normalized.worldData.narrativeHistory);
      }
      useNarrativeStore.getState().setStatus({
        loading: false,
        totalExpected: totalEvents,
        chunksLoaded: totalEvents ? 1 : 0,
        chunksTotal: totalEvents ? 1 : 0,
      });
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setStatus('error');
      setError(err);
    }
  }, [bundleManifestUrl, bundleFallbackUrl]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await loadBundle();
      if (cancelled) return;
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [loadBundle]);

  // Persist bundle data to Dexie so Chronicler reads from IndexedDB
  useEffect(() => {
    if (!bundle?.worldData || !bundle?.projectId) return;
    const simulationRunId = bundle.worldData?.metadata?.simulationRunId;
    if (!simulationRunId) return;

    const ingestKey = `${bundle.projectId}:${simulationRunId}`;
    if (lastDexieIngestRef.current === ingestKey) return;
    lastDexieIngestRef.current = ingestKey;

    overwriteWorldDataInDexie({
      projectId: bundle.projectId,
      slotIndex: typeof bundle.slot?.index === 'number' ? bundle.slot.index : 0,
      worldData: bundle.worldData,
      chronicles: bundle.chronicles,
      staticPages: bundle.staticPages,
      eraNarratives: bundle.eraNarratives,
    })
      .then(() => {
        setDexieSeededAt(Date.now());
      })
      .catch((err) => {
        console.warn('[Viewer] Failed to persist bundle to Dexie:', err);
      });
  }, [bundle]);

  // Pre-compute filtered chronicles and static pages for direct handoff to Chronicler
  // (bypasses Chronicler's IndexedDB read — data is already in memory from the bundle fetch)
  const preloadedChronicles = useMemo(() => {
    if (!bundle?.chronicles) return undefined;
    return bundle.chronicles.filter(
      (c) => c?.status === 'complete' && c.acceptedAt
    );
  }, [bundle]);

  const preloadedStaticPages = useMemo(() => {
    if (!bundle?.staticPages) return undefined;
    return bundle.staticPages.filter(
      (p) => p?.status === 'published'
    );
  }, [bundle]);

  const preloadedEraNarratives = useMemo(() => {
    if (!bundle?.eraNarratives) return undefined;
    return bundle.eraNarratives.filter(
      (n) => n?.status === 'complete' && n.content
    );
  }, [bundle]);

  // Configure CDN image backend when bundle loads
  useEffect(() => {
    if (!bundle) return;
    const backend = new CDNBackend(bundle.imageData || null, bundle.images || null);
    useImageStore.getState().configure(backend);
    return () => useImageStore.getState().cleanup();
  }, [bundle]);

  if (status === 'loading') {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Loading viewer bundle...</div>
            <div className="state-detail">Fetching {bundleRequestUrl}</div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title state-error">Bundle unavailable</div>
            <div className="state-detail">
              {error?.message || 'Failed to load the viewer bundle.'}
            </div>
            <div className="state-detail" style={{ marginTop: '12px' }}>
              Expected at: {bundleRequestUrl}
            </div>
            <div className="state-actions">
              <button className="button" onClick={loadBundle} type="button">
                Retry
              </button>
              <button className="button secondary" onClick={() => window.location.reload()} type="button">
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bundle?.worldData) {
    return (
      <div className="app">
        <div className="state-screen">
          <div className="state-card">
            <div className="state-title">Bundle is empty</div>
            <div className="state-detail">No world data found in {bundleRequestUrl}.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <button
          type="button"
          className="brand"
          onClick={() => {
            setChroniclerRequestedPage('home');
            window.location.hash = '#/';
          }}
        >
          <span className="brand-icon" aria-hidden="true">&#x2756;</span>
          <span className="brand-title">The Ice Remembers</span>
        </button>
        <HeaderSearch
          projectId={bundle.projectId}
          slotIndex={bundle.slot?.index ?? 0}
          dexieSeededAt={dexieSeededAt}
          onNavigate={setChroniclerRequestedPage}
        />
        <div className="header-spacer" />
      </header>
      <main className="app-main">
        <div className="panel chronicler-scope">
          <ChroniclerRemote
            projectId={bundle.projectId}
            activeSlotIndex={bundle.slot?.index ?? 0}
            requestedPageId={chroniclerRequestedPage}
            onRequestedPageConsumed={() => setChroniclerRequestedPage(null)}
            dexieSeededAt={dexieSeededAt}
            preloadedWorldData={bundle.worldData}
            preloadedChronicles={preloadedChronicles}
            preloadedStaticPages={preloadedStaticPages}
            preloadedEraNarratives={preloadedEraNarratives}
            prebakedParchmentUrl={parchmentTileUrl}
            precomputedPageIndex={bundle.precomputedPageIndex}
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>Copyright © 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  );
}
