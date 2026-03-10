/**
 * ChronicleImagePanel - Review and generate chronicle images
 *
 * Shows all image refs for a chronicle:
 * - Entity refs: references to existing entity images
 * - Prompt requests: new images to be generated with LLM-provided prompts
 *
 * Integrates with the existing style library and visual identity system:
 * - StyleSelector for artistic/composition style selection
 * - Culture dropdown for visual identity theming
 * - Uses the same image generation pipeline as entity images
 */

import React, { useState, useMemo, useCallback } from "react";
import ImageModal from "./ImageModal";
import ChronicleImagePicker from "./ChronicleImagePicker";
import { resolveStyleSelection } from "./StyleSelector";
import { ImageSettingsSummary } from "./ImageSettingsDrawer";
import { buildChronicleScenePrompt, type CastMember } from "../lib/promptBuilders";
import { annotateEntityNames } from "../lib/annotateEntityNames";
import { getSizeForAspect } from "../lib/imageSettings";
import { EntityImageRefCard, PromptRequestCard } from "./ChronicleImagePanelCards";
import {
  DEFAULT_VISUAL_IDENTITY_KIND,
  type ChronicleImagePanelProps,
  type EntityImageRef,
  type PromptRequestRef,
  type StyleInfo,
} from "./ChronicleImagePanelTypes";
import "./ChronicleImagePanel.css";

export default function ChronicleImagePanel({
  imageRefs,
  entities,
  onGenerateImage,
  onResetImage,
  onRegenerateDescription,
  onUpdateAnchorText,
  onUpdateSize,
  onUpdateJustification,
  onSelectExistingImage,
  projectId,
  chronicleId,
  chronicleText,
  isGenerating = false,
  styleLibrary,
  styleSelection: externalStyleSelection,
  cultures,
  cultureIdentities,
  worldContext,
  chronicleTitle,
  imageSize: _imageSize,
  imageQuality: _imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  fullEntityNavMap,
  selectedEntityIds,
}: Readonly<ChronicleImagePanelProps>) {
  // Use external style selection directly (managed globally by ImageSettingsDrawer)
  const styleSelection = externalStyleSelection || {
    artisticStyleId: "random",
    compositionStyleId: "random",
    colorPaletteId: "random",
  };

  // Build chronicle cast from selectedEntityIds for CAST line
  const chronicleCast = useMemo((): CastMember[] => {
    if (!selectedEntityIds || !fullEntityNavMap) return [];
    const cast: CastMember[] = [];
    for (const id of selectedEntityIds) {
      const entity = fullEntityNavMap.get(id);
      if (entity && entity.kind !== "era") {
        cast.push({ name: entity.name, kind: entity.kind, subtype: entity.subtype, culture: entity.culture });
      }
    }
    return cast;
  }, [selectedEntityIds, fullEntityNavMap]);

  // Image modal state
  const [imageModal, setImageModal] = useState<{ open: boolean; imageId: string; title: string }>({
    open: false,
    imageId: "",
    title: "",
  });
  const handleImageClick = useCallback((imageId: string, title: string) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  // Image picker state
  const [pickerRef, setPickerRef] = useState<PromptRequestRef | null>(null);
  const handleOpenPicker = useCallback((ref: PromptRequestRef) => {
    setPickerRef(ref);
  }, []);
  const handleClosePicker = useCallback(() => {
    setPickerRef(null);
  }, []);
  const handleSelectImage = useCallback(
    (imageId: string) => {
      if (pickerRef && onSelectExistingImage) {
        onSelectExistingImage(pickerRef, imageId);
      }
      setPickerRef(null);
    },
    [pickerRef, onSelectExistingImage]
  );

  // Culture selection from global settings
  const selectedCultureId = imageGenSettings?.selectedCultureId || "";

  // Derive primary culture from chronicle entities if not manually selected
  const derivedCultureId = useMemo(() => {
    if (selectedCultureId) return selectedCultureId;

    // Try to find dominant culture from entities involved in the chronicle
    const cultureCounts = new Map<string, number>();
    for (const entity of entities.values()) {
      if (entity.culture && entity.culture !== "universal") {
        cultureCounts.set(entity.culture, (cultureCounts.get(entity.culture) || 0) + 1);
      }
    }

    let maxCulture = "";
    let maxCount = 0;
    for (const [culture, count] of cultureCounts) {
      if (count > maxCount) {
        maxCulture = culture;
        maxCount = count;
      }
    }

    return maxCulture;
  }, [selectedCultureId, entities]);

  // Separate entity refs and prompt requests
  const { entityRefs, promptRequests } = useMemo(() => {
    if (!imageRefs?.refs) return { entityRefs: [], promptRequests: [] };

    const entityRefs: EntityImageRef[] = [];
    const promptRequests: PromptRequestRef[] = [];

    for (const ref of imageRefs.refs) {
      if (ref.type === "entity_ref") {
        entityRefs.push(ref);
      } else {
        promptRequests.push(ref);
      }
    }

    return { entityRefs, promptRequests };
  }, [imageRefs]);

  // Count by status
  const stats = useMemo(() => {
    const pending = promptRequests.filter((r) => r.status === "pending").length;
    const generating = promptRequests.filter((r) => r.status === "generating").length;
    const complete = promptRequests.filter((r) => r.status === "complete").length;
    const failed = promptRequests.filter((r) => r.status === "failed").length;

    return { pending, generating, complete, failed };
  }, [promptRequests]);

  // Build style info for image generation
  const buildStyleInfo = useCallback((): StyleInfo => {
    const resolved = resolveStyleSelection({
      selection: styleSelection,
      entityCultureId: derivedCultureId,
      entityKind: DEFAULT_VISUAL_IDENTITY_KIND,
      cultures: cultures || [],
      styleLibrary: styleLibrary || {
        artisticStyles: [],
        compositionStyles: [],
        colorPalettes: [],
      },
    });

    // Get visual identity for the selected culture
    const cultureVisualIdentity = cultureIdentities?.visual?.[derivedCultureId] || {};
    const allowedKeys =
      cultureIdentities?.visualKeysByKind?.[DEFAULT_VISUAL_IDENTITY_KIND] ||
      Object.keys(cultureVisualIdentity); // Use all keys if no kind-specific filtering

    const filteredVisualIdentity: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (cultureVisualIdentity[key]) {
        filteredVisualIdentity[key] = cultureVisualIdentity[key];
      }
    }

    return {
      artisticPromptFragment: (resolved.artisticStyle as { promptFragment?: string } | null)?.promptFragment,
      compositionPromptFragment: (resolved.compositionStyle as { promptFragment?: string } | null)?.promptFragment,
      colorPalettePromptFragment: (resolved.colorPalette as { promptFragment?: string } | null)?.promptFragment,
      colorPaletteSwatchColors: (resolved.colorPalette as { swatchColors?: [string[], string[]] } | null)?.swatchColors,
      artisticNegativePrompt: (resolved.artisticStyle as { negativePrompt?: string } | null)?.negativePrompt,
      artistExemplar: (resolved.artisticStyle as { artistExemplar?: string } | null)?.artistExemplar,
    };
  }, [styleSelection, derivedCultureId, cultures, styleLibrary, cultureIdentities]);

  // Handle generating a single image
  const handleGenerateImage = useCallback(
    (ref: PromptRequestRef) => {
      if (!onGenerateImage) return;

      const styleInfo = buildStyleInfo();

      // Annotate entity names across all entities for species/type disambiguation
      const annotatedScene = fullEntityNavMap
        ? annotateEntityNames(ref.sceneDescription, fullEntityNavMap)
        : ref.sceneDescription;

      const prompt = buildChronicleScenePrompt(
        {
          sceneDescription: annotatedScene,
          size: ref.size,
          chronicleTitle,
          world: worldContext
            ? {
                name: worldContext.name || "Unknown World",
                description: worldContext.description,
                speciesConstraint: worldContext.speciesConstraint,
              }
            : undefined,
          cast: chronicleCast,
        },
        styleInfo,
        imageModel
      );

      onGenerateImage(ref, prompt, styleInfo);
    },
    [onGenerateImage, buildStyleInfo, chronicleTitle, worldContext, fullEntityNavMap, chronicleCast]
  );

  // Handle generating a single image using the ref's assigned styles and composition default aspect
  const handleGenerateImageWithDefaults = useCallback(
    (ref: PromptRequestRef) => {
      if (!onGenerateImage || !styleLibrary) return;

      // Use the ref's assigned styles instead of the flyout selection
      const artistic = ref.suggestedArtisticStyleId
        ? styleLibrary.artisticStyles.find((s) => s.id === ref.suggestedArtisticStyleId)
        : undefined;
      const composition = ref.suggestedCompositionStyleId
        ? styleLibrary.compositionStyles.find((s) => s.id === ref.suggestedCompositionStyleId)
        : undefined;
      const palette = ref.suggestedColorPaletteId
        ? styleLibrary.colorPalettes.find((p) => p.id === ref.suggestedColorPaletteId)
        : undefined;

      const styleInfo: StyleInfo = {
        artisticPromptFragment: artistic?.promptFragment,
        compositionPromptFragment: composition?.promptFragment,
        colorPalettePromptFragment: palette?.promptFragment,
        colorPaletteSwatchColors: palette?.swatchColors,
        artisticNegativePrompt: artistic?.negativePrompt,
        artistExemplar: artistic?.artistExemplar,
      };

      // Annotate entity names across all entities for species/type disambiguation
      const annotatedScene = fullEntityNavMap
        ? annotateEntityNames(ref.sceneDescription, fullEntityNavMap)
        : ref.sceneDescription;

      const prompt = buildChronicleScenePrompt(
        {
          sceneDescription: annotatedScene,
          size: ref.size,
          chronicleTitle,
          world: worldContext
            ? {
                name: worldContext.name || "Unknown World",
                description: worldContext.description,
                speciesConstraint: worldContext.speciesConstraint,
              }
            : undefined,
          cast: chronicleCast,
        },
        styleInfo,
        imageModel
      );

      const aspect = composition?.defaultImageAspect || "landscape";
      const imageSizeOverride = getSizeForAspect(imageModel || "dall-e-3", aspect);
      onGenerateImage(ref, prompt, styleInfo, imageSizeOverride);
    },
    [onGenerateImage, styleLibrary, chronicleTitle, worldContext, fullEntityNavMap, chronicleCast, imageModel]
  );

  // No image refs yet
  if (!imageRefs) {
    return (
      <div className="ilu-empty cip-empty-state">
        No image references generated yet. Use the &quot;Generate&quot; button above to create image
        placement suggestions.
      </div>
    );
  }

  const totalRefs = entityRefs.length + promptRequests.length;

  if (totalRefs === 0) {
    return (
      <div className="ilu-empty cip-empty-state">
        No image references in this chronicle.
      </div>
    );
  }

  const hasSceneImages = promptRequests.length > 0;

  const canSelectExisting = !!onSelectExistingImage && !!projectId;

  const artisticStyleNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of styleLibrary?.artisticStyles || []) map.set(s.id, s.name);
    return map;
  }, [styleLibrary]);

  const compositionStyleNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of styleLibrary?.compositionStyles || []) map.set(s.id, s.name);
    return map;
  }, [styleLibrary]);

  const colorPaletteNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of styleLibrary?.colorPalettes || []) map.set(p.id, p.name);
    return map;
  }, [styleLibrary]);

  return (
    <div>
      {/* Header with stats */}
      <div className="cip-header-row">
        <div className="cip-header-title">Image References ({totalRefs})</div>
        <div className="cip-header-stats">
          <span className="cip-stat-muted">Entity refs: {entityRefs.length}</span>
          <span className="cip-stat-muted">Scenes: {promptRequests.length}</span>
          {stats.pending > 0 && <span className="cip-stat-pending">Pending: {stats.pending}</span>}
          {stats.complete > 0 && (
            <span className="cip-stat-complete">Complete: {stats.complete}</span>
          )}
        </div>
      </div>

      {/* Image Settings Summary - show when there are scene images */}
      {hasSceneImages && imageGenSettings && onOpenImageSettings && (
        <ImageSettingsSummary
          settings={imageGenSettings}
          styleLibrary={styleLibrary || null}
          onOpenSettings={onOpenImageSettings}
        />
      )}

      {/* Entity Refs Section */}
      {entityRefs.length > 0 && (
        <div className="cip-section">
          <div className="cip-section-title">
            Entity Images ({entityRefs.length})
          </div>
          <div className="cip-card-list">
            {entityRefs.map((ref) => (
              <EntityImageRefCard
                key={ref.refId}
                imageRef={ref}
                entity={entities.get(ref.entityId)}
                onImageClick={handleImageClick}
                onUpdateAnchorText={
                  onUpdateAnchorText ? (next) => onUpdateAnchorText(ref, next) : undefined
                }
                onUpdateSize={onUpdateSize ? (size) => onUpdateSize(ref, size) : undefined}
                onUpdateJustification={
                  onUpdateJustification
                    ? (justification) => onUpdateJustification(ref, justification)
                    : undefined
                }
                chronicleText={chronicleText}
                isGenerating={isGenerating}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prompt Requests Section */}
      {promptRequests.length > 0 && (
        <div>
          <div className="cip-section-title">
            Scene Images ({promptRequests.length})
          </div>
          <div className="cip-card-list">
            {promptRequests.map((ref) => (
              <PromptRequestCard
                key={ref.refId}
                imageRef={ref}
                onGenerate={() => handleGenerateImage(ref)}
                onGenerateWithDefaults={() => handleGenerateImageWithDefaults(ref)}
                onReset={onResetImage ? () => onResetImage(ref) : undefined}
                onRegenerateDescription={onRegenerateDescription ? () => onRegenerateDescription(ref) : undefined}
                onSelectExisting={canSelectExisting ? () => handleOpenPicker(ref) : undefined}
                onImageClick={handleImageClick}
                onUpdateAnchorText={onUpdateAnchorText ? (next: string) => onUpdateAnchorText(ref, next) : undefined}
                onUpdateSize={onUpdateSize ? (size: string) => onUpdateSize(ref, size) : undefined}
                onUpdateJustification={onUpdateJustification ? (j: string) => onUpdateJustification(ref, j) : undefined}
                chronicleText={chronicleText}
                isGenerating={isGenerating}
                entities={entities}
                artisticStyleNames={artisticStyleNames}
                compositionStyleNames={compositionStyleNames}
                colorPaletteNames={colorPaletteNames}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata footer */}
      <div className="cip-metadata-footer">
        Generated: {new Date(imageRefs.generatedAt).toLocaleString()} • Model: {imageRefs.model}
      </div>

      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />

      {projectId && (
        <ChronicleImagePicker
          isOpen={!!pickerRef}
          onClose={handleClosePicker}
          onSelect={handleSelectImage}
          projectId={projectId}
          chronicleId={chronicleId}
          imageRefId={pickerRef?.refId}
          currentImageId={pickerRef?.generatedImageId}
        />
      )}
    </div>
  );
}
