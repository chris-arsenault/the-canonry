/**
 * PROP CHAIN: ChroniclePanel -> ChronicleReviewPanel -> ChronicleWorkspace (this file)
 * Props originate in ChroniclePanel and pass through ChronicleReviewPanel.
 * When adding props, update all three files.
 */
import React, { useMemo, useState, useCallback, useEffect } from "react";
import ImageModal from "../ImageModal";
import QuickCheckModal from "../QuickCheckModal";
import WorkspaceHeader from "./WorkspaceHeader";
import WorkspaceTabBar from "./WorkspaceTabBar";
import PipelineTab from "./PipelineTab";
import VersionsTab from "./VersionsTab";
import ImagesTab from "./ImagesTab";
import ReferenceTab from "./ReferenceTab";
import ContentTab from "./ContentTab";
import HistorianTab from "./HistorianTab";
import EnrichmentTab from "./EnrichmentTab";
import { findEntityMentions } from "../../lib/wikiLinkService";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { getEntitiesForRun, createEntity } from "../../lib/db/entityRepository";
import CreateEntityModal from "../CreateEntityModal";
import type { ChronicleRecord, ChronicleGenerationVersion } from "../../lib/chronicleTypes";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { PersistedNarrativeEvent } from "../../lib/db/illuminatorDb";
import type { ImageGenSettings } from "../../hooks/useImageGenSettings";
import type { WorldEntity } from "@canonry/world-schema";
import "./ChronicleWorkspace.css";

// ---------------------------------------------------------------------------
// Shared type definitions
// ---------------------------------------------------------------------------

interface StyleSelection {
  artisticStyleId?: string;
  compositionStyleId?: string;
  colorPaletteId?: string;
}

interface StyleLibrary {
  narrativeStyles?: Array<{ id: string; name: string }>;
  artisticStyles?: Array<{ id: string; name: string; promptFragment?: string }>;
  compositionStyles?: Array<{
    id: string;
    name: string;
    promptFragment?: string;
    suitableForKinds?: string[];
  }>;
  colorPalettes?: Array<{ id: string; name: string; promptFragment?: string }>;
}

interface CultureIdentities {
  visual?: Record<string, Record<string, string>>;
  descriptive?: Record<string, Record<string, string>>;
  visualKeysByKind?: Record<string, string[]>;
  descriptiveKeysByKind?: Record<string, string[]>;
}

interface WorldContext {
  name?: string;
  description?: string;
  toneFragments?: { core: string };
  speciesConstraint?: string;
}

interface Culture {
  id: string;
  name: string;
  styleKeywords?: string[];
}

interface WorldSchema {
  entityKinds: Array<{ id: string; name: string }>;
  [key: string]: unknown;
}

interface RefinementState {
  running: boolean;
}

interface Refinements {
  compare?: RefinementState;
  combine?: RefinementState;
  copyEdit?: RefinementState;
  temporalCheck?: RefinementState;
  quickCheck?: RefinementState;
}

interface Era {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Prop group interfaces (for max-jsx-props compliance)
// ---------------------------------------------------------------------------

interface ImageGenerationProps {
  styleSelection?: StyleSelection;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Version type
// ---------------------------------------------------------------------------

interface ResolvedVersion {
  id: string;
  content: string;
  wordCount: number;
  shortLabel: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ChronicleWorkspaceProps {
  item: ChronicleRecord;

  // Actions
  onAccept?: () => void;
  onRegenerate?: () => void;
  onRegenerateWithSampling?: (sampling: string) => void;
  onRegenerateFull?: () => void;
  onRegenerateCreative?: () => void;
  onCompareVersions?: (a: string, b: string) => void;
  onCombineVersions?: (a: string, b: string, instructions?: string) => void;
  onCopyEdit?: (versionId: string) => void;
  onTemporalCheck?: () => void;
  onQuickCheck?: () => void;
  onValidate?: () => void;
  onGenerateSummary?: () => void;
  onGenerateTitle?: () => void;
  onAcceptPendingTitle?: (title?: string) => Promise<void>;
  onRejectPendingTitle?: () => Promise<void>;
  onGenerateImageRefs?: () => void;
  onGenerateChronicleImage?: (refId: string) => void;
  onResetChronicleImage?: (refId: string) => void;
  onRegenerateDescription?: (refId: string) => void;
  onUpdateChronicleAnchorText?: (refId: string, text: string) => void;
  onUpdateChronicleTemporalContext?: (ctx: unknown) => void;
  onUpdateChronicleActiveVersion?: (versionId: string) => void;
  onDeleteVersion?: (versionId: string) => void;
  onUpdateCombineInstructions?: (instructions: string) => void;
  onUnpublish?: () => void;

  // Cover image
  onGenerateCoverImageScene?: () => void;
  onGenerateCoverImage?: () => void;
  styleSelection?: StyleSelection;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;

  // Image layout edits
  onUpdateChronicleImageSize?: (refId: string, size: string) => void;
  onUpdateChronicleImageJustification?: (refId: string, justification: string) => void;

  // Image ref selections (version migration)
  onApplyImageRefSelections?: (selections: unknown[]) => void;

  // Select existing image for a ref
  onSelectExistingImage?: (refId: string) => void;

  // Select existing image for cover
  onSelectExistingCoverImage?: () => void;

  // Export
  onExport?: () => void;

  // Lore backport
  onBackportLore?: () => void;

  // Historian review
  onHistorianReview?: () => void;
  onSetAssignedTone?: (tone: string) => void;
  onDetectTone?: () => void;
  isHistorianActive?: boolean;
  onUpdateHistorianNote?: (noteId: string, text: string) => void;
  onGeneratePrep?: () => void;

  // State
  isGenerating?: boolean;
  refinements?: Refinements;

  // Data
  simulationRunId?: string;
  worldSchema?: WorldSchema;
  entities?: PersistedEntity[];
  styleLibrary?: StyleLibrary;
  cultures?: Culture[];
  cultureIdentities?: CultureIdentities;
  worldContext?: WorldContext;
  eras?: Era[];
  events?: PersistedNarrativeEvent[];
  onNavigateToTab?: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wordCount = (content?: string): number =>
  content?.split(/\s+/).filter(Boolean).length || 0;

function buildStepLabel(step?: string): string | null {
  if (!step) return null;
  const labels: Record<string, string> = {
    generate: "initial",
    regenerate: "regenerate",
    creative: "creative",
    combine: "combine",
    copy_edit: "copy-edit",
  };
  return labels[step] || step;
}

function deduplicateVersions(history: ChronicleGenerationVersion[]): ResolvedVersion[] {
  const sorted = [...history].sort((a, b) => a.generatedAt - b.generatedAt);
  const seen = new Set<string>();
  const unique: ChronicleGenerationVersion[] = [];
  for (const version of sorted) {
    if (seen.has(version.versionId)) continue;
    seen.add(version.versionId);
    unique.push(version);
  }
  return unique.map((version, index) => {
    const samplingLabel = version.sampling ?? "unspecified";
    const step = buildStepLabel(version.step);
    const stepDisplay = step || `sampling ${samplingLabel}`;
    return {
      id: version.versionId,
      content: version.content,
      wordCount: version.wordCount,
      shortLabel: `V${index + 1}`,
      label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 ${stepDisplay}`,
    };
  });
}

function buildFormatTargetIndicator(
  targetVersionId: string | undefined,
  activeVersionId: string | undefined,
  versionLabelMap: Map<string, string>
): string | null {
  if (!targetVersionId) return null;
  const targetLabel = versionLabelMap.get(targetVersionId) || "Unknown";
  const activeLabel = versionLabelMap.get(activeVersionId || "") || "Unknown";
  if (targetVersionId === activeVersionId) return null;
  return `Targets ${targetLabel} \u2022 Active ${activeLabel}`;
}

// ---------------------------------------------------------------------------
// TitleAcceptModal — extracted for complexity reduction
// ---------------------------------------------------------------------------

interface TitleAcceptModalProps {
  item: ChronicleRecord;
  onAcceptTitle: (title: string) => void;
  onRejectTitle: () => void;
}

function TitleAcceptModal({
  item,
  onAcceptTitle,
  onRejectTitle,
}: Readonly<TitleAcceptModalProps>) {
  const [customTitle, setCustomTitle] = useState("");
  const hasPending = !!item.pendingTitle;

  useEffect(() => {
    setCustomTitle("");
  }, [item.pendingTitle]);

  const handleOverlayClick = useCallback(() => {
    if (hasPending) onRejectTitle();
  }, [hasPending, onRejectTitle]);

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        (e.currentTarget as HTMLElement).click();
      }
    },
    []
  );

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        (e.currentTarget as HTMLElement).click();
      }
    },
    []
  );

  const handleCustomTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCustomTitle(e.target.value),
    []
  );

  const handleCustomTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = e.currentTarget.value.trim();
        if (trimmed) onAcceptTitle(trimmed);
      }
    },
    [onAcceptTitle]
  );

  const handleUseCustomTitle = useCallback(() => {
    const trimmed = customTitle.trim();
    if (trimmed) onAcceptTitle(trimmed);
  }, [customTitle, onAcceptTitle]);

  const handleAcceptPrimary = useCallback(() => {
    if (item.pendingTitle) onAcceptTitle(item.pendingTitle);
  }, [item.pendingTitle, onAcceptTitle]);

  if (!hasPending) {
    return (
      <div
        className="cw-title-overlay"
        role="button"
        tabIndex={0}
        onKeyDown={handleOverlayKeyDown}
      >
        <div
          className="cw-title-dialog"
          onClick={handleDialogClick}
          role="button"
          tabIndex={0}
          onKeyDown={handleDialogKeyDown}
        >
          <h3 className="cw-title-heading">Generating Title...</h3>
          <div className="cw-generating-current">
            <div className="cw-generating-current-label">Current</div>
            <div className="cw-generating-current-value">{item.title}</div>
          </div>
          <div className="cw-generating-spinner-row">
            <span className="cw-spinner" />
            Generating title candidates...
          </div>
        </div>
      </div>
    );
  }

  const filteredCandidates = item.pendingTitleCandidates?.filter(
    (c) => c !== item.pendingTitle
  );

  return (
    <div
      className="cw-title-overlay"
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="cw-title-dialog"
        onClick={handleDialogClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleDialogKeyDown}
      >
        <h3 className="cw-title-heading">Choose Title</h3>
        {item.pendingTitleFragments && item.pendingTitleFragments.length > 0 && (
          <div className="cw-fragments-box">
            <div className="cw-fragments-label">Extracted Fragments</div>
            <div className="cw-fragments-list">
              {item.pendingTitleFragments.map((f, i) => (
                <span key={i}>
                  {f}
                  {i < (item.pendingTitleFragments?.length ?? 0) - 1 ? (
                    <span className="cw-fragment-separator">&middot;</span>
                  ) : (
                    ""
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="cw-candidates-list">
          <button onClick={handleAcceptPrimary} className="cw-candidate-primary">
            <span className="cw-candidate-primary-icon">&#x2726;</span>
            {item.pendingTitle}
          </button>
          {filteredCandidates?.map((candidate, i) => (
            <button
              key={i}
              onClick={() => onAcceptTitle(candidate)}
              className="cw-candidate-alt"
            >
              <span className="cw-candidate-alt-icon">&#x25C7;</span>
              {candidate}
            </button>
          ))}
        </div>
        <div className="cw-custom-title-section">
          <div className="cw-custom-title-label">Custom title</div>
          <div className="cw-custom-title-row">
            <input
              className="illuminator-input cw-custom-title-input"
              value={customTitle}
              onChange={handleCustomTitleChange}
              placeholder="Enter a custom title..."
              onKeyDown={handleCustomTitleKeyDown}
            />
            <button
              onClick={handleUseCustomTitle}
              disabled={!customTitle.trim()}
              className={`cw-custom-title-use-btn ${customTitle.trim() ? "cw-custom-title-use-btn-active" : "cw-custom-title-use-btn-disabled"}`}
            >
              Use
            </button>
          </div>
        </div>
        <div className="cw-title-footer">
          <button onClick={onRejectTitle} className="cw-keep-current-btn">
            Keep Current
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab + version hooks (extracted to reduce main component complexity)
// ---------------------------------------------------------------------------

interface TabDefinition {
  id: string;
  label: string;
  indicator?: string;
  align?: string;
}

function useTabs(isComplete: boolean, versionCount: number, chronicleId: string) {
  const defaultTab = isComplete ? "historian" : "pipeline";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(isComplete ? "historian" : "pipeline");
  }, [chronicleId, isComplete]);

  const tabs: TabDefinition[] = useMemo(() => {
    if (isComplete) {
      return [
        { id: "historian", label: "Historian" },
        { id: "enrichment", label: "Enrichment" },
        { id: "images", label: "Images" },
        { id: "reference", label: "Reference" },
        { id: "content", label: "Content", align: "right" },
      ];
    }
    return [
      { id: "pipeline", label: "Pipeline" },
      {
        id: "versions",
        label: "Versions",
        indicator: versionCount > 1 ? `(${versionCount})` : undefined,
      },
      { id: "images", label: "Images" },
      { id: "reference", label: "Reference" },
      { id: "content", label: "Content", align: "right" },
    ];
  }, [isComplete, versionCount]);

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  return { tabs, activeTab, setActiveTab };
}

function useVersionState(
  generationHistory: ChronicleGenerationVersion[] | undefined,
  recordActiveVersionId: string | undefined,
  chronicleId: string
) {
  const versions = useMemo(
    () => deduplicateVersions(generationHistory || []),
    [generationHistory]
  );

  const activeVersionId = recordActiveVersionId || versions[versions.length - 1]?.id;

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState("");

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId("");
  }, [activeVersionId, chronicleId]);

  useEffect(() => {
    if (versions.length === 0) return;
    const hasSelected = versions.some((v) => v.id === selectedVersionId);
    let nextSelected = selectedVersionId;
    if (!hasSelected) {
      const hasActive = versions.some((v) => v.id === activeVersionId);
      nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      setSelectedVersionId(nextSelected);
    }
    if (compareToVersionId) {
      const hasCompare = versions.some((v) => v.id === compareToVersionId);
      if (!hasCompare || compareToVersionId === nextSelected) {
        setCompareToVersionId("");
      }
    }
  }, [versions, selectedVersionId, compareToVersionId, activeVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );

  const compareToVersion = useMemo(
    () => (compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : undefined),
    [versions, compareToVersionId]
  );

  const versionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  const versionContentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  return {
    versions,
    activeVersionId,
    selectedVersionId,
    setSelectedVersionId,
    compareToVersionId,
    setCompareToVersionId,
    selectedVersion,
    compareToVersion,
    versionLabelMap,
    versionContentMap,
  };
}

// ---------------------------------------------------------------------------
// Tertiary cast hook (extracted to reduce main component complexity)
// ---------------------------------------------------------------------------

function useTertiaryCast(
  item: ChronicleRecord,
  simulationRunId: string | undefined,
  isComplete: boolean,
  selectedVersion: ResolvedVersion | undefined
) {
  const detectTertiaryCast = useCallback(async () => {
    if (!simulationRunId) return;
    const content = isComplete
      ? item.finalContent
      : selectedVersion?.content || item.assembledContent;
    if (!content) return;

    const freshEntities = await getEntitiesForRun(simulationRunId);
    const freshEntityMap = new Map(freshEntities.map((e) => [e.id, e]));

    const wikiEntities: Array<{ id: string; name: string }> = [];
    for (const entity of freshEntities) {
      if (entity.kind === "era") continue;
      wikiEntities.push({ id: entity.id, name: entity.name });
      const aliases = entity.enrichment?.text?.aliases;
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          if (typeof alias === "string" && alias.length >= 3) {
            wikiEntities.push({ id: entity.id, name: alias });
          }
        }
      }
    }

    const mentions = findEntityMentions(content, wikiEntities);
    const declaredIds = new Set(item.selectedEntityIds || []);
    const prevDecisions = new Map(
      (item.tertiaryCast || []).map((e) => [e.entityId, e.accepted])
    );

    const seen = new Set<string>();
    const entries: Array<{
      entityId: string;
      name: string;
      kind: string;
      matchedAs: string;
      matchStart: number;
      matchEnd: number;
      accepted: boolean;
    }> = [];
    for (const m of mentions) {
      if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
      seen.add(m.entityId);
      const entity = freshEntityMap.get(m.entityId);
      if (entity) {
        entries.push({
          entityId: entity.id,
          name: entity.name,
          kind: entity.kind,
          matchedAs: content.slice(m.start, m.end),
          matchStart: m.start,
          matchEnd: m.end,
          accepted: prevDecisions.get(entity.id) ?? true,
        });
      }
    }

    const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
    await updateChronicleTertiaryCast(item.chronicleId, entries);
    await useChronicleStore.getState().refreshChronicle(item.chronicleId);
  }, [
    simulationRunId,
    isComplete,
    item.finalContent,
    item.assembledContent,
    item.selectedEntityIds,
    item.chronicleId,
    item.tertiaryCast,
    selectedVersion,
  ]);

  const toggleTertiaryCast = useCallback(
    async (entityId: string) => {
      const current = item.tertiaryCast || [];
      const updated = current.map((e) =>
        e.entityId === entityId ? { ...e, accepted: !e.accepted } : e
      );
      const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
      await updateChronicleTertiaryCast(item.chronicleId, updated);
      await useChronicleStore.getState().refreshChronicle(item.chronicleId);
    },
    [item.chronicleId, item.tertiaryCast]
  );

  return { detectTertiaryCast, toggleTertiaryCast };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChronicleWorkspace({
  item,
  onAccept,
  onRegenerate,
  onRegenerateWithSampling,
  onRegenerateFull,
  onRegenerateCreative,
  onCompareVersions,
  onCombineVersions,
  onCopyEdit,
  onTemporalCheck,
  onQuickCheck,
  onValidate,
  onGenerateSummary,
  onGenerateTitle,
  onAcceptPendingTitle,
  onRejectPendingTitle,
  onGenerateImageRefs,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleTemporalContext,
  onUpdateChronicleActiveVersion,
  onDeleteVersion,
  onUpdateCombineInstructions,
  onUnpublish,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  styleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  onApplyImageRefSelections,
  onSelectExistingImage,
  onSelectExistingCoverImage,
  onExport,
  onBackportLore,
  onHistorianReview,
  onSetAssignedTone,
  onDetectTone,
  isHistorianActive,
  onUpdateHistorianNote,
  onGeneratePrep,
  isGenerating,
  refinements,
  simulationRunId,
  worldSchema,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
  events,
  onNavigateToTab,
}: Readonly<ChronicleWorkspaceProps>) {
  const isComplete = item.status === "complete";

  // Entity map
  const entityMap = useMemo(() => {
    if (!entities) return new Map<string, PersistedEntity>();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // Version state
  const {
    versions,
    activeVersionId,
    selectedVersionId,
    setSelectedVersionId,
    compareToVersionId,
    setCompareToVersionId,
    selectedVersion,
    compareToVersion,
    versionLabelMap,
    versionContentMap,
  } = useVersionState(item.generationHistory, item.activeVersionId, item.chronicleId);

  // Derived refinement flags
  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;
  const copyEditRunning = refinements?.copyEdit?.running || false;
  const temporalCheckRunning = refinements?.temporalCheck?.running || false;
  const quickCheckRunning = refinements?.quickCheck?.running || false;

  // Indicators
  const summaryIndicator = buildFormatTargetIndicator(
    item.summaryTargetVersionId,
    activeVersionId,
    versionLabelMap
  );
  const imageRefsIndicator = buildFormatTargetIndicator(
    item.imageRefsTargetVersionId,
    activeVersionId,
    versionLabelMap
  );
  const imageRefsTargetContent =
    versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId || "") ||
    item.assembledContent;

  // Tertiary cast
  const { detectTertiaryCast, toggleTertiaryCast } = useTertiaryCast(
    item,
    simulationRunId,
    isComplete,
    selectedVersion
  );

  // Seed data
  const seedData = useMemo(
    () => ({
      narrativeStyleId: item.narrativeStyleId || "",
      narrativeStyleName:
        item.narrativeStyle?.name ||
        styleLibrary?.narrativeStyles?.find((s) => s.id === item.narrativeStyleId)?.name,
      entrypointId: item.entrypointId,
      entrypointName: item.entrypointId
        ? entities?.find((e) => e.id === item.entrypointId)?.name
        : undefined,
      narrativeDirection: item.narrativeDirection,
      roleAssignments: item.roleAssignments || [],
      selectedEventIds: item.selectedEventIds || [],
      selectedRelationshipIds: item.selectedRelationshipIds || [],
    }),
    [
      item.narrativeStyleId,
      item.narrativeStyle?.name,
      item.entrypointId,
      item.narrativeDirection,
      item.roleAssignments,
      item.selectedEventIds,
      item.selectedRelationshipIds,
      entities,
      styleLibrary?.narrativeStyles,
    ]
  );

  // Title modal
  const [showTitleAcceptModal, setShowTitleAcceptModal] = useState(false);

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(
    async (chosenTitle: string) => {
      const normalized = chosenTitle.trim() || undefined;
      if (onAcceptPendingTitle) await onAcceptPendingTitle(normalized);
      setShowTitleAcceptModal(false);
    },
    [onAcceptPendingTitle]
  );

  const handleRejectTitle = useCallback(async () => {
    if (onRejectPendingTitle) await onRejectPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onRejectPendingTitle]);

  // Image modal
  const [showQuickCheckModal, setShowQuickCheckModal] = useState(false);
  const [createEntityDefaults, setCreateEntityDefaults] = useState<Record<
    string,
    string | number | undefined
  > | null>(null);
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });

  const handleImageClick = useCallback((imageId: string, title: string) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setImageModal({ open: false, imageId: "", title: "" });
  }, []);

  // Quick Check -> Create Entity flow
  const openCreateFromQuickCheck = useCallback(
    (phrase: string) => {
      setCreateEntityDefaults({
        name: phrase,
        kind: "npc",
        subtype: "merchant",
        eraId: item.temporalContext?.focalEra?.id,
        startTick: item.temporalContext?.chronicleTickRange?.[0],
        endTick: item.temporalContext?.chronicleTickRange?.[1],
      });
    },
    [item.temporalContext]
  );

  const handleCreateEntityFromQuickCheck = useCallback(
    async (entityData: Omit<WorldEntity, "id" | "createdAt" | "updatedAt">) => {
      if (!simulationRunId) return;
      await createEntity(simulationRunId, entityData);
      setCreateEntityDefaults(null);
    },
    [simulationRunId]
  );

  const handleCloseCreateEntity = useCallback(() => setCreateEntityDefaults(null), []);

  const handleShowQuickCheck = useCallback(() => setShowQuickCheckModal(true), []);
  const handleCloseQuickCheck = useCallback(() => setShowQuickCheckModal(false), []);

  // Tab state
  const { tabs, activeTab, setActiveTab } = useTabs(
    isComplete,
    versions.length,
    item.chronicleId
  );

  // Current word count for header
  const currentWordCount = isComplete
    ? wordCount(item.finalContent)
    : (selectedVersion?.wordCount ?? wordCount(item.assembledContent));

  // Chronicle text for image refs
  const chronicleText = isComplete
    ? item.finalContent || imageRefsTargetContent || item.assembledContent
    : imageRefsTargetContent || item.assembledContent;

  // Version selection handlers
  const handleSelectVersion = useCallback(
    (id: string) => {
      setSelectedVersionId(id);
      if (id === compareToVersionId) setCompareToVersionId("");
    },
    [compareToVersionId, setSelectedVersionId, setCompareToVersionId]
  );

  const handleDeleteVersion = useCallback(
    (versionId: string) => {
      if (!versionId || versions.length === 0) return;

      const index = versions.findIndex((v) => v.id === versionId);
      let nextSelected = selectedVersionId;
      if (index !== -1) {
        nextSelected = versions[index + 1]?.id || versions[index - 1]?.id || selectedVersionId;
      }
      if (nextSelected === versionId) {
        const hasActive = versions.some((v) => v.id === activeVersionId);
        nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      }

      if (nextSelected && nextSelected !== selectedVersionId) {
        setSelectedVersionId(nextSelected);
      }
      if (compareToVersionId === versionId || compareToVersionId === nextSelected) {
        setCompareToVersionId("");
      }

      onDeleteVersion?.(versionId);
    },
    [
      versions,
      selectedVersionId,
      activeVersionId,
      compareToVersionId,
      onDeleteVersion,
      setSelectedVersionId,
      setCompareToVersionId,
    ]
  );

  // Find/replace nav handler
  const handleFindReplace = useMemo(
    () =>
      isComplete && onNavigateToTab ? () => onNavigateToTab("finaledit") : undefined,
    [isComplete, onNavigateToTab]
  );

  return (
    <div className="chronicle-workspace">
      <WorkspaceHeader
        item={item}
        wordCount={currentWordCount}
        isGenerating={isGenerating}
        isComplete={isComplete}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onExport={onExport}
        onUnpublish={onUnpublish}
      />

      <WorkspaceTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="workspace-tab-content">
        {activeTab === "pipeline" && (
          <PipelineTab
            item={item}
            isGenerating={isGenerating}
            refinements={refinements}
            onValidate={onValidate}
            onGenerateSummary={onGenerateSummary}
            onGenerateTitle={handleGenerateTitleWithModal}
            onGenerateImageRefs={onGenerateImageRefs}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            onImageClick={handleImageClick}
            onRegenerateWithSampling={onRegenerateWithSampling}
            entityMap={entityMap}
            styleLibrary={styleLibrary}
            styleSelection={styleSelection}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            summaryIndicator={summaryIndicator}
            imageRefsIndicator={imageRefsIndicator}
            imageRefsTargetContent={imageRefsTargetContent}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageModel={imageModel}
            imageGenSettings={imageGenSettings}
            onOpenImageSettings={onOpenImageSettings}
            onGenerateChronicleImage={onGenerateChronicleImage}
            onResetChronicleImage={onResetChronicleImage}
            onRegenerateDescription={onRegenerateDescription}
            onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
            onUpdateChronicleImageSize={onUpdateChronicleImageSize}
            onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          />
        )}

        {activeTab === "versions" && (
          <VersionsTab
            item={item}
            versions={versions}
            selectedVersionId={selectedVersionId}
            compareToVersionId={compareToVersionId}
            activeVersionId={activeVersionId}
            isGenerating={isGenerating}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
            onDeleteVersion={isComplete ? undefined : handleDeleteVersion}
            onCompareVersions={onCompareVersions}
            onCombineVersions={onCombineVersions}
            onRegenerateFull={onRegenerateFull}
            onRegenerateCreative={onRegenerateCreative}
            onRegenerateWithSampling={onRegenerateWithSampling}
            onUpdateCombineInstructions={onUpdateCombineInstructions}
            onCopyEdit={onCopyEdit}
            compareRunning={compareRunning}
            combineRunning={combineRunning}
            copyEditRunning={copyEditRunning}
          />
        )}

        {activeTab === "images" && (
          <ImagesTab
            item={item}
            isGenerating={isGenerating}
            entityMap={entityMap}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            onImageClick={handleImageClick}
            onGenerateChronicleImage={onGenerateChronicleImage}
            onResetChronicleImage={onResetChronicleImage}
            onRegenerateDescription={onRegenerateDescription}
            onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
            onUpdateChronicleImageSize={onUpdateChronicleImageSize}
            onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
            styleLibrary={styleLibrary}
            styleSelection={styleSelection}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageModel={imageModel}
            imageGenSettings={imageGenSettings}
            onOpenImageSettings={onOpenImageSettings}
            chronicleText={chronicleText}
            versions={versions}
            activeVersionId={activeVersionId}
            onApplyImageRefSelections={onApplyImageRefSelections}
            onSelectExistingImage={onSelectExistingImage}
            onSelectExistingCoverImage={onSelectExistingCoverImage}
          />
        )}

        {activeTab === "reference" && (
          <ReferenceTab
            item={item}
            eras={eras}
            events={events}
            entities={entities}
            isGenerating={isGenerating}
            onUpdateTemporalContext={onUpdateChronicleTemporalContext}
            onTemporalCheck={onTemporalCheck}
            temporalCheckRunning={temporalCheckRunning}
            seedData={seedData}
          />
        )}

        {activeTab === "content" && (
          <ContentTab
            item={item}
            isComplete={isComplete}
            versions={versions}
            selectedVersion={selectedVersion}
            compareToVersion={compareToVersion}
            selectedVersionId={selectedVersionId}
            compareToVersionId={compareToVersionId}
            activeVersionId={activeVersionId}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
            onDeleteVersion={isComplete ? undefined : handleDeleteVersion}
            isGenerating={isGenerating}
            onQuickCheck={onQuickCheck}
            quickCheckRunning={quickCheckRunning}
            onShowQuickCheck={handleShowQuickCheck}
            onFindReplace={handleFindReplace}
            onDetectTertiaryCast={detectTertiaryCast}
            onToggleTertiaryCast={toggleTertiaryCast}
          />
        )}

        {activeTab === "historian" && (
          <HistorianTab
            item={item}
            isGenerating={isGenerating}
            isHistorianActive={isHistorianActive}
            onHistorianReview={onHistorianReview}
            onSetAssignedTone={onSetAssignedTone}
            onDetectTone={onDetectTone}
            onUpdateHistorianNote={onUpdateHistorianNote}
            onBackportLore={onBackportLore}
            onGeneratePrep={onGeneratePrep}
          />
        )}

        {activeTab === "enrichment" && (
          <EnrichmentTab
            item={item}
            isGenerating={isGenerating}
            refinements={refinements}
            onGenerateTitle={handleGenerateTitleWithModal}
            onGenerateSummary={onGenerateSummary}
          />
        )}
      </div>

      {/* Modals */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={handleCloseImageModal}
      />

      {showQuickCheckModal && item.quickCheckReport && (
        <QuickCheckModal
          report={item.quickCheckReport}
          entities={entities}
          onCreateEntity={worldSchema ? openCreateFromQuickCheck : undefined}
          onClose={handleCloseQuickCheck}
        />
      )}

      {createEntityDefaults && worldSchema && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eras}
          defaults={createEntityDefaults}
          onSubmit={handleCreateEntityFromQuickCheck}
          onClose={handleCloseCreateEntity}
        />
      )}

      {showTitleAcceptModal && (
        <TitleAcceptModal
          item={item}
          onAcceptTitle={(title) => void handleAcceptTitle(title)}
          onRejectTitle={() => void handleRejectTitle()}
        />
      )}
    </div>
  );
}
