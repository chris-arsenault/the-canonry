import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { useImageStore, CDNBackend } from '@penguin-tales/image-store';
import { useNarrativeStore } from '@penguin-tales/narrative-store';
import ArchivistHost from './remotes/ArchivistHost.jsx';
import ChroniclerHost from './remotes/ChroniclerHost.jsx';

/**
 * HeaderSearch - Independent search component for the header bar
 * Has its own state and dropdown, navigates to Chronicler on selection
 */
function HeaderSearch({ worldData, chronicles, staticPages, onNavigate }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);

  // Build searchable pages from world data
  const pages = useMemo(() => {
    const result = [];

    // Add static pages (use pageId as the page ID)
    if (staticPages) {
      for (const page of staticPages) {
        if (page.pageId) {
          result.push({
            id: page.pageId,
            title: page.title || page.pageId,
            type: 'page',
            content: { summary: page.summary || '' },
          });
        }
      }
    }

    // Add chronicles (use chronicleId as the page ID)
    if (chronicles) {
      for (const chronicle of chronicles) {
        if (chronicle.chronicleId) {
          result.push({
            id: chronicle.chronicleId,
            title: chronicle.title || chronicle.chronicleId,
            type: 'chronicle',
            content: { summary: chronicle.summary || '' },
          });
        }
      }
    }

    // Add entities from hardState (use entity.id directly)
    if (worldData?.hardState) {
      for (const entity of worldData.hardState) {
        if (entity && entity.id && entity.name && entity.kind !== 'era') {
          result.push({
            id: entity.id,
            title: entity.name,
            type: entity.kind || 'entity',
            content: { summary: entity.description || entity.summary || '' },
          });
        }
      }
    }

    return result;
  }, [worldData, chronicles, staticPages]);

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
            <div className="header-search-no-results">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

const VIEW_OPTIONS = [
  { value: 'chronicler', label: 'Chronicler', icon: '📜', description: 'Wiki & Lore' },
  { value: 'archivist', label: 'Archivist', icon: '🗺️', description: 'Graph Explorer' },
];

function ViewSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = VIEW_OPTIONS.find(opt => opt.value === value) || VIEW_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (optionValue !== value) {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  return (
    <div className="view-selector" ref={containerRef}>
      <button
        type="button"
        className={`view-selector-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="view-selector-icon">{selectedOption.icon}</span>
        <span className="view-selector-label">{selectedOption.label}</span>
        <span className="view-selector-caret" aria-hidden="true">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>
      {isOpen && (
        <div className="view-selector-dropdown" role="listbox">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`view-selector-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              <span className="view-selector-option-icon">{option.icon}</span>
              <div className="view-selector-option-text">
                <span className="view-selector-option-label">{option.label}</span>
                <span className="view-selector-option-desc">{option.description}</span>
              </div>
              {option.value === value && (
                <span className="view-selector-option-check">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_BUNDLE_PATH = 'bundles/default/bundle.json';
const DEFAULT_BUNDLE_MANIFEST_PATH = 'bundles/default/bundle.manifest.json';
const CHRONICLER_HASH_PREFIX = '#/page/';
const ARCHIVIST_HASH_PREFIX = '#/entity/';

function deriveViewFromHash(hash) {
  if (!hash || hash === '#/' || hash === '#') return 'chronicler';
  if (hash.startsWith(CHRONICLER_HASH_PREFIX)) return 'chronicler';
  if (hash === '#/chronicler') return 'chronicler';
  if (hash.startsWith(ARCHIVIST_HASH_PREFIX)) return 'archivist';
  if (hash === '#/archivist') return 'archivist';
  return 'chronicler';
}

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

function extractChunkItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function App() {
  const [activeView, setActiveView] = useState(() => deriveViewFromHash(window.location.hash));
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [bundleRequestUrl, setBundleRequestUrl] = useState(() => resolveBundleUrl());
  const [chunkPlan, setChunkPlan] = useState(null);
  const loadSequence = useRef(0);
  const chunkLoadStarted = useRef(false);
  const lastChroniclerHashRef = useRef(
    window.location.hash.startsWith(CHRONICLER_HASH_PREFIX) ? window.location.hash : null
  );

  // Requested page for Chronicler (set by cross-MFE navigation, cleared after use)
  const [chroniclerRequestedPage, setChroniclerRequestedPage] = useState(null);

  // Track narrative history chunk loading status for features that depend on complete data
  const [narrativeHistoryStatus, setNarrativeHistoryStatus] = useState({
    loading: false,
    totalExpected: 0,
    chunksLoaded: 0,
    chunksTotal: 0,
  });

  // Listen for cross-MFE navigation events (e.g., Archivist -> Chronicler)
  useEffect(() => {
    const handleCrossNavigation = (e) => {
      const { tab, pageId } = e.detail || {};
      if (tab === 'chronicler') {
        if (pageId) {
          setChroniclerRequestedPage(pageId);
        }
        setActiveView('chronicler');
      } else if (tab === 'archivist') {
        setActiveView('archivist');
      }
    };
    window.addEventListener('canonry:navigate', handleCrossNavigation);
    return () => window.removeEventListener('canonry:navigate', handleCrossNavigation);
  }, []);

  const bundleManifestUrl = useMemo(() => resolveBundleManifestUrl(), []);
  const bundleFallbackUrl = useMemo(() => resolveBundleUrl(), []);

  const loadBundle = useCallback(async () => {
    const sequence = ++loadSequence.current;
    chunkLoadStarted.current = false;
    setChunkPlan(null);
    setStatus('loading');
    setError(null);
    useNarrativeStore.getState().reset();
    setNarrativeHistoryStatus({
      loading: false,
      totalExpected: 0,
      chunksLoaded: 0,
      chunksTotal: 0,
    });

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

      const chunkFiles = Array.isArray(manifest?.chunks?.narrativeHistory?.files)
        ? manifest.chunks.narrativeHistory.files
        : [];
      if (chunkFiles.length > 0) {
        setChunkPlan({ baseUrl: manifestBaseUrl, files: chunkFiles });
        // Initialize loading status for features that depend on complete narrative history
        const totalExpected = manifest?.chunks?.narrativeHistory?.totalEvents ?? 0;
        setNarrativeHistoryStatus({
          loading: true,
          totalExpected,
          chunksLoaded: 0,
          chunksTotal: chunkFiles.length,
        });
        useNarrativeStore.getState().setStatus({
          loading: true,
          totalExpected,
          chunksLoaded: 0,
          chunksTotal: chunkFiles.length,
        });
      } else {
        useNarrativeStore.getState().setStatus({
          loading: false,
          totalExpected: 0,
          chunksLoaded: 0,
          chunksTotal: 0,
        });
      }
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
      setNarrativeHistoryStatus({
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

  // Load narrative history chunks after initial bundle is ready
  // Note: bundle is intentionally NOT in the dependency array - we only want to start
  // chunk loading once when chunkPlan becomes available, not restart when bundle updates
  const bundleReady = bundle?.worldData != null;
  useEffect(() => {
    if (!chunkPlan || chunkLoadStarted.current) return;
    if (!bundleReady) return;
    if (!chunkPlan.files.length) return;

    chunkLoadStarted.current = true;
    const sequence = loadSequence.current;

    const loadChunks = async () => {
      let chunksLoaded = 0;
      const chunksTotal = chunkPlan.files.length;

      for (const file of chunkPlan.files) {
        // Only check sequence (not cancelled) - we want to complete loading even across re-renders
        if (sequence !== loadSequence.current) return;
        const chunkPath = typeof file?.path === 'string' ? file.path : null;
        if (!chunkPath) continue;
        const chunkUrl = resolveAssetUrl(chunkPath, chunkPlan.baseUrl);
        try {
          // Chunk files have content hash in filename - safe to cache aggressively
          const response = await fetch(chunkUrl);
          if (!response.ok) {
            console.warn(`Viewer: narrativeHistory chunk fetch failed (${response.status}).`, chunkUrl);
            chunksLoaded++;
            continue;
          }
          const payload = await response.json();
          const items = extractChunkItems(payload);
          chunksLoaded++;
          if (!items.length) continue;
          if (sequence !== loadSequence.current) return;
          useNarrativeStore.getState().ingestChunk(items);

          // Update loading progress
          setNarrativeHistoryStatus((prev) => ({
            ...prev,
            chunksLoaded,
          }));
          useNarrativeStore.getState().setStatus({ chunksLoaded });
        } catch (chunkError) {
          console.warn('Viewer: failed to load narrativeHistory chunk.', chunkError);
          chunksLoaded++;
          setNarrativeHistoryStatus((prev) => ({
            ...prev,
            chunksLoaded,
          }));
          useNarrativeStore.getState().setStatus({ chunksLoaded });
        }
      }

      // Mark loading complete
      setNarrativeHistoryStatus((prev) => ({
        ...prev,
        loading: false,
        chunksLoaded: chunksTotal,
      }));
      useNarrativeStore.getState().setStatus({
        loading: false,
        chunksLoaded: chunksTotal,
        chunksTotal,
      });

      const allEvents = useNarrativeStore.getState().getAllEvents();
      if (allEvents.length > 0) {
        setBundle((prev) => {
          if (!prev?.worldData) return prev;
          return {
            ...prev,
            worldData: {
              ...prev.worldData,
              narrativeHistory: allEvents,
            },
          };
        });
      }
    };

    const scheduleIdle = window.requestIdleCallback
      ? window.requestIdleCallback.bind(window)
      : (cb) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 250);
    const idleHandle = scheduleIdle(() => {
      loadChunks();
    });

    // Only cancel idle callback scheduling, not in-flight chunk loading
    return () => {
      window.cancelIdleCallback
        ? window.cancelIdleCallback(idleHandle)
        : window.clearTimeout(idleHandle);
    };
  }, [bundleReady, chunkPlan]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith(CHRONICLER_HASH_PREFIX)) {
        lastChroniclerHashRef.current = hash;
      }
      const nextView = deriveViewFromHash(hash);
      if (nextView !== activeView) {
        setActiveView(nextView);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeView]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView === activeView) return;

    if (nextView === 'chronicler') {
      if (window.location.hash.startsWith(CHRONICLER_HASH_PREFIX)) {
        setActiveView(nextView);
        return;
      }
      const targetHash = lastChroniclerHashRef.current || '#/chronicler';
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else {
        setActiveView(nextView);
      }
      return;
    }

    if (window.location.hash !== '#/archivist') {
      window.location.hash = '#/archivist';
    } else {
      setActiveView(nextView);
    }
  }, [activeView]);

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
        <ViewSelector value={activeView} onChange={handleViewChange} />
        <button
          type="button"
          className="brand"
          onClick={() => {
            setChroniclerRequestedPage('home');
            setActiveView('chronicler');
            window.location.hash = '#/';
          }}
        >
          <span className="brand-icon">🐧</span>
          <span className="brand-title">Penguin Tales</span>
        </button>
        <HeaderSearch
          worldData={bundle.worldData}
          chronicles={bundle.chronicles}
          staticPages={bundle.staticPages}
          onNavigate={(pageId) => {
            setChroniclerRequestedPage(pageId);
            setActiveView('chronicler');
          }}
        />
        <div className="header-spacer" />
      </header>
      <main className="app-main">
        <div className="panel" style={{ display: activeView === 'archivist' ? 'block' : 'none' }}>
          <ArchivistHost
            worldData={bundle.worldData}
            loreData={bundle.loreData || null}
          />
        </div>
        <div className="panel" style={{ display: activeView === 'chronicler' ? 'block' : 'none' }}>
          <ChroniclerHost
            projectId={bundle.projectId}
            worldData={bundle.worldData}
            loreData={bundle.loreData || null}
            chronicles={bundle.chronicles}
            staticPages={bundle.staticPages}
            requestedPageId={chroniclerRequestedPage}
            onRequestedPageConsumed={() => setChroniclerRequestedPage(null)}
            narrativeHistoryLoading={narrativeHistoryStatus.loading}
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>Copyright © 2025</span>
        <img src="/tsonu-combined.png" alt="tsonu" height="14" />
      </footer>
    </div>
  );
}
