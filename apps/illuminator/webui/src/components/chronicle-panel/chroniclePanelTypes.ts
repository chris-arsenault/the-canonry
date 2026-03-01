/**
 * Shared types for the ChroniclePanel component family.
 */

import type { ChronicleNavItem } from "../../lib/db/chronicleNav";
import type { ChronicleRecord } from "../../lib/db/chronicleRepository";
import type { EraNarrativeNavItem } from "../../lib/db/eraNarrativeNav";
import type { StyleLibrary } from "@canonry/world-schema";
import type { ImageGenSettings } from "../../hooks/useImageGenSettings";
import type { QueueItem } from "../../lib/enrichmentTypes";

// ---------------------------------------------------------------------------
// Entity / World types used throughout ChroniclePanel
// ---------------------------------------------------------------------------

export interface EntityNavItem {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  prominence?: string;
  culture?: string;
  status?: string;
}

export interface WizardEra {
  id: string;
  name: string;
  summary: string;
  order: number;
  startTick: number;
  endTick: number;
  duration: number;
}

export interface WizardEvent {
  id: string;
  tick: number;
  era: string;
  eventKind: string;
  significance: string;
  headline: string;
  description: string;
  subjectId?: string;
  subjectName?: string;
  objectId?: string;
  objectName?: string;
  stateChanges?: unknown;
  narrativeTags?: unknown;
}

export interface WizardRelationship {
  src: string;
  dst: string;
  kind: string;
  strength: number;
  sourceName: string;
  sourceKind: string;
  targetName: string;
  targetKind: string;
}

export interface WizardEntity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: string;
  culture: string;
  status: string;
  tags: Record<string, string>;
  eraId?: string;
  summary?: string;
  description?: string;
  aliases: string[];
  coordinates?: { x: number; y: number };
  createdAt?: number;
  updatedAt?: number;
}

export interface WorldContext {
  name: string;
  description: string;
  toneFragments: string[];
  canonFactsWithMetadata: unknown[];
  factSelection?: unknown;
  worldDynamics?: unknown;
  proseHints?: Record<string, string>;
  speciesConstraint?: string;
}

export interface HistorianConfig {
  persona?: string;
  [key: string]: unknown;
}

export interface CultureIdentities {
  descriptive?: Record<string, string>;
  [key: string]: unknown;
}

export interface WorldData {
  schema?: {
    entityKinds?: Array<{ id: string; name: string; [key: string]: unknown }>;
    cultures?: Array<{ id: string; name: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Style selection
// ---------------------------------------------------------------------------

export interface StyleSelection {
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
}

// ---------------------------------------------------------------------------
// Queue item (simplified for what ChroniclePanel needs)
// ---------------------------------------------------------------------------

export interface ChronicleQueueItem {
  type: string;
  chronicleId?: string;
  chronicleStep?: string;
  status: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Selected item (derived from ChronicleRecord with extra computed fields)
// ---------------------------------------------------------------------------

export interface SelectedChronicleItem extends ChronicleRecord {
  id: string;
  type: "chronicles";
  name: string;
  status: string;
  primaryCount: number;
  supportingCount: number;
  editVersion: number;
}

// ---------------------------------------------------------------------------
// Refinement state
// ---------------------------------------------------------------------------

export interface RefinementStepState {
  generatedAt?: number;
  model?: string;
  running: boolean;
}

export interface RefinementState {
  summary: RefinementStepState;
  title: RefinementStepState;
  imageRefs: RefinementStepState;
  compare: { running: boolean };
  combine: { running: boolean };
  copyEdit: { running: boolean };
  temporalCheck: { running: boolean };
  quickCheck: { running: boolean };
  coverImageScene: { running: boolean };
}

// ---------------------------------------------------------------------------
// Notification result types
// ---------------------------------------------------------------------------

export interface OperationResult {
  success: boolean;
  count?: number;
  error?: string;
}

export interface ResetBackportResult {
  success: boolean;
  chronicleCount?: number;
  entityCount?: number;
  error?: string;
}

export interface TertiaryDetectResult {
  running?: boolean;
  success?: boolean;
  count?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Combined nav item (chronicle or era narrative)
// ---------------------------------------------------------------------------

export type CombinedNavItem = (ChronicleNavItem & { itemType?: undefined }) | EraNarrativeNavItem;

// ---------------------------------------------------------------------------
// ChroniclePanel props
// ---------------------------------------------------------------------------

export interface ChroniclePanelProps {
  worldData: WorldData;
  queue: ChronicleQueueItem[];
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  onCancel: (id: string) => void;
  worldContext: WorldContext;
  projectId: string;
  simulationRunId: string;
  buildPrompt: (entity: Record<string, unknown>) => string;
  styleLibrary: StyleLibrary | null;
  imageGenSettings: ImageGenSettings;
  entityGuidance: Record<string, { proseHint?: string; [key: string]: unknown }>;
  cultureIdentities: CultureIdentities;
  onBackportLore: ((chronicleId: string) => void) | undefined;
  onStartBulkBackport: () => void;
  isBulkBackportActive: boolean;
  refreshTrigger: number;
  imageModel: string;
  onOpenImageSettings: () => void;
  onHistorianReview: ((chronicleId: string, tone: string) => void) | undefined;
  isHistorianActive: boolean;
  historianConfigured: boolean;
  historianConfig: HistorianConfig;
  onUpdateHistorianNote: (noteId: string) => void;
  onRefreshEraSummaries: (() => Promise<number>) | undefined;
  onNavigateToTab: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { ChronicleNavItem, ChronicleRecord, EraNarrativeNavItem, StyleLibrary, ImageGenSettings, QueueItem };
