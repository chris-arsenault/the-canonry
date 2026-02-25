/**
 * ChroniclerRemote - MFE entry point for Chronicler
 *
 * Wiki-style explorer for world content with long-form narratives,
 * cross-linking, and MediaWiki-inspired navigation.
 *
 * Loads world data from the shared Dexie store.
 */

import "./styles/variables.css";
import WikiExplorer from "./components/WikiExplorer.tsx";
import ChroniclerStatusScreen from "./components/ChroniclerStatusScreen.tsx";
import type { WorldState, SerializedPageIndex } from "./types/world.ts";
import type { ChronicleRecord } from "./lib/chronicleStorage.ts";
import type { StaticPage } from "./lib/staticPageStorage.ts";
import type { EraNarrativeViewRecord } from "./lib/eraNarrativeStorage.ts";
import useWorldDataLoader from "./hooks/useWorldDataLoader.ts";

export interface ChroniclerRemoteProps {
  projectId?: string;
  activeSlotIndex?: number;
  /** Timestamp updated when Dexie ingestion completes (viewer). */
  dexieSeededAt?: number;
  /** Page ID requested by external navigation */
  requestedPageId?: string | null;
  /** Callback to signal that the requested page has been consumed */
  onRequestedPageConsumed?: () => void;
  /** Pre-loaded world data — skips IndexedDB read when provided (viewer context) */
  preloadedWorldData?: WorldState | null;
  /** Pre-loaded chronicles — skips IndexedDB read when provided (viewer context) */
  preloadedChronicles?: ChronicleRecord[];
  /** Pre-loaded static pages — skips IndexedDB read when provided (viewer context) */
  preloadedStaticPages?: StaticPage[];
  /** Pre-loaded era narratives — skips IndexedDB read when provided (viewer context) */
  preloadedEraNarratives?: EraNarrativeViewRecord[];
  /** Pre-baked parchment tile URL — skips runtime canvas pipeline when provided */
  prebakedParchmentUrl?: string;
  /** Pre-computed page index — skips buildPageIndex on mount when provided */
  precomputedPageIndex?: SerializedPageIndex;
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
    />
  );
}
