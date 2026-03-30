import React, { useState, useCallback, useEffect } from "react";
import ChroniclerRemote from "../../../chronicler/webui/src/ChroniclerRemote.tsx";
import parchmentTileUrl from "../../../chronicler/webui/src/assets/textures/parchment-tile.jpg";
import HeaderSearch from "./HeaderSearch";
import StatusScreen from "./StatusScreen";
import useBundleLoader from "./useBundleLoader";

/** Redirect legacy hash URLs (#/page/...) to path-based URLs (/page/...). */
function useLegacyHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/page/")) {
      window.history.replaceState(null, "", `/page/${hash.slice(7)}`);
    } else if (hash === "#/" || hash === "#") {
      window.history.replaceState(null, "", "/");
    }
  }, []);
}

export default function App() {
  useLegacyHashRedirect();
  const {
    bundle,
    status,
    error,
    bundleRequestUrl,
    loadBundle,
    dexieSeededAt,
    preloadedChronicles,
    preloadedStaticPages,
    preloadedEraNarratives,
  } = useBundleLoader();
  const [chroniclerRequestedPage, setChroniclerRequestedPage] = useState<string | null>(null);
  const clearChroniclerRequestedPage = useCallback(() => setChroniclerRequestedPage(null), []);
  const handleRetry = useCallback(() => void loadBundle(), [loadBundle]);

  if (status !== "ready" || !bundle?.worldData) {
    return (
      <StatusScreen
        status={status}
        error={error}
        bundleRequestUrl={bundleRequestUrl}
        onRetry={handleRetry}
        worldData={bundle?.worldData}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <button
          type="button"
          className="brand"
          onClick={() => { setChroniclerRequestedPage("home"); window.history.pushState(null, "", "/"); }}
        >
          <span className="brand-icon" aria-hidden="true">
            &#x2756;
          </span>
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
            onRequestedPageConsumed={clearChroniclerRequestedPage}
            dexieSeededAt={dexieSeededAt}
            preloadedWorldData={bundle.worldData}
            preloadedChronicles={preloadedChronicles}
            preloadedStaticPages={preloadedStaticPages}
            preloadedEraNarratives={preloadedEraNarratives}
            prebakedParchmentUrl={parchmentTileUrl}
            precomputedPageIndex={bundle.precomputedPageIndex}
            routingMode="path"
          />
        </div>
      </main>
      <footer className="app-footer">
        <span>Copyright &copy; 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  );
}
