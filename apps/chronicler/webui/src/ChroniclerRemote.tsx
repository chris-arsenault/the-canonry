/**
 * ChroniclerRemote - MFE entry point for Chronicler
 *
 * Wiki-style explorer for world content with long-form narratives,
 * cross-linking, and MediaWiki-inspired navigation.
 *
 * Loads world data from the shared Dexie store.
 */

import "./styles/variables.css";
import "./components/WikiPage.css";
import "./components/WikiExplorer.css";
import "./components/WikiNav.css";
import "./components/WikiSearch.css";
import "./components/EntityTimeline.css";
import "./components/ProminenceTimeline.css";
import "./components/ChronicleIndex.css";
import "./components/ChroniclerStatusScreen.css";
import "./components/ImageLightbox.css";
import "./components/Ornaments.css";
import type { Optional } from "@the-canonry/shared-components";
import WikiExplorer from "./components/WikiExplorer.tsx";
import ChroniclerStatusScreen from "./components/ChroniclerStatusScreen.tsx";
import type { WorldState, SerializedPageIndex } from "./types/world.ts";
import type { ChronicleRecord } from "./lib/chronicleStorage.ts";
import type { StaticPage } from "./lib/staticPageStorage.ts";
import type { EraNarrativeViewRecord } from "./lib/eraNarrativeStorage.ts";
import type { RoutingMode } from "./hooks/useRoutingMode.ts";
import useWorldDataLoader from "./hooks/useWorldDataLoader.ts";
import React from "react";

export interface ChroniclerRemoteProps {
  projectId: Optional<string>;
  activeSlotIndex: Optional<number>;
  /** Timestamp updated when Dexie ingestion completes (viewer). */
  dexieSeededAt: Optional<number>;
  /** Page ID requested by external navigation */
  requestedPageId: Optional<string | null>;
  /** Callback to signal that the requested page has been consumed */
  onRequestedPageConsumed: Optional<() => void>;
  /** Pre-loaded world data — skips IndexedDB read when provided (viewer context) */
  preloadedWorldData: Optional<WorldState | null>;
  /** Pre-loaded chronicles — skips IndexedDB read when provided (viewer context) */
  preloadedChronicles: Optional<ChronicleRecord[]>;
  /** Pre-loaded static pages — skips IndexedDB read when provided (viewer context) */
  preloadedStaticPages: Optional<StaticPage[]>;
  /** Pre-loaded era narratives — skips IndexedDB read when provided (viewer context) */
  preloadedEraNarratives: Optional<EraNarrativeViewRecord[]>;
  /** Pre-baked parchment tile URL — skips runtime canvas pipeline when provided */
  prebakedParchmentUrl: Optional<string>;
  /** Pre-computed page index — skips buildPageIndex on mount when provided */
  precomputedPageIndex: Optional<SerializedPageIndex>;
  /** "hash" for #/page/{id} (default, Canonry shell), "path" for /page/{id} (viewer site). */
  routingMode: Optional<RoutingMode>;
}

export default function ChroniclerRemote({
  projectId,
  activeSlotIndex = 0,
  dexieSeededAt,
  requestedPageId,
  onRequestedPageConsumed,
  preloadedWorldData,
  preloadedChronicles,
  preloadedStaticPages,
  preloadedEraNarratives,
  prebakedParchmentUrl,
  precomputedPageIndex,
  routingMode,
}: Readonly<ChroniclerRemoteProps>) {
  const { worldData, loading, loadError } = useWorldDataLoader({
    projectId,
    activeSlotIndex,
    dexieSeededAt,
    preloadedWorldData,
  });

  if (loading || loadError || !worldData) {
    return <ChroniclerStatusScreen loading={loading} loadError={loadError} />;
  }

  return (
    <WikiExplorer
      projectId={projectId}
      worldData={worldData}
      loreData={null}
      requestedPageId={requestedPageId}
      onRequestedPageConsumed={onRequestedPageConsumed}
      preloadedChronicles={preloadedChronicles}
      preloadedStaticPages={preloadedStaticPages}
      preloadedEraNarratives={preloadedEraNarratives}
      prebakedParchmentUrl={prebakedParchmentUrl}
      precomputedPageIndex={precomputedPageIndex}
      routingMode={routingMode}
    />
  );
}
