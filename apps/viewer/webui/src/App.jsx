import { useState } from "react";
import ChroniclerRemote from "@chronicler/ChroniclerRemote.tsx";
import parchmentTileUrl from "@chronicler/assets/textures/parchment-tile.jpg";
import HeaderSearch from "./HeaderSearch";
import StatusScreen from "./StatusScreen";
import useBundleLoader from "./useBundleLoader";

export default function App() {
  const {
    bundle, status, error, bundleRequestUrl, loadBundle, dexieSeededAt,
    preloadedChronicles, preloadedStaticPages, preloadedEraNarratives,
  } = useBundleLoader();
  const [chroniclerRequestedPage, setChroniclerRequestedPage] = useState(null);

  if (status !== "ready" || !bundle?.worldData) {
    return (
      <StatusScreen
        status={status}
        error={error}
        bundleRequestUrl={bundleRequestUrl}
        onRetry={loadBundle}
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
          onClick={() => {
            setChroniclerRequestedPage("home");
            window.location.hash = "#/";
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
