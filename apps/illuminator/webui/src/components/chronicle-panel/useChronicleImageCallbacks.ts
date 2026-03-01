/**
 * useChronicleImageCallbacks - Image-related callbacks for ChroniclePanel.
 *
 * Extracted to keep ChroniclePanel under max-lines-per-function.
 */

import { useCallback } from "react";
import type { SelectedChronicleItem, StyleSelection, WorldContext } from "./chroniclePanelTypes";
import type { StyleLibrary } from "@canonry/world-schema";
import { updateChronicleImageRef, updateChronicleCoverImageStatus, applyImageRefSelections } from "../../lib/db/chronicleRepository";
import { resolveStyleSelection } from "../StyleSelector";
import { getCoverImageConfig } from "../../lib/coverImageStyles";
import { buildChronicleScenePrompt } from "../../lib/promptBuilders";

interface UseChronicleImageCallbacksParams {
  selectedItem: SelectedChronicleItem | undefined;
  generationContext: Record<string, unknown> | null;
  fullEntityMapRef: React.RefObject<Map<string, Record<string, unknown>>>;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  refreshChronicle: (id: string) => Promise<void>;
  chronicleStyleSelection: StyleSelection;
  styleLibrary: StyleLibrary | null;
  worldContext: WorldContext;
  chronicleImageSize: string;
  chronicleImageQuality: string;
}

export function useChronicleImageCallbacks({
  selectedItem,
  generationContext,
  fullEntityMapRef,
  onEnqueue,
  refreshChronicle,
  chronicleStyleSelection,
  styleLibrary,
  worldContext,
  chronicleImageSize,
  chronicleImageQuality,
}: UseChronicleImageCallbacksParams) {
  const handleGenerateImageRefs = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    const primaryEntity = selectedItem.roleAssignments?.[0];
    const visualIdentities: Record<string, string> = {};
    for (const entityCtx of (generationContext as { entities?: Array<{ id: string }> }).entities || []) {
      const entity = fullEntityMapRef.current.get(entityCtx.id);
      if (entity?.enrichment?.text?.visualThesis) {
        visualIdentities[entityCtx.id] = entity.enrichment.text.visualThesis as string;
      }
    }
    onEnqueue([{
      entity: {
        id: primaryEntity?.entityId || selectedItem.chronicleId,
        name: primaryEntity?.entityName || selectedItem.name,
        kind: primaryEntity?.entityKind || "chronicle",
      },
      type: "entityChronicle",
      chronicleId: selectedItem.chronicleId,
      chronicleStep: "image_refs",
      chronicleContext: generationContext,
      visualIdentities,
    }]);
  }, [selectedItem, generationContext, onEnqueue, fullEntityMapRef]);

  const handleRegenerateDescription = useCallback(
    (ref: { refId: string; involvedEntityIds?: string[] }) => {
      if (!selectedItem || !generationContext) return;
      const primaryEntity = selectedItem.roleAssignments?.[0];
      const visualIdentities: Record<string, string> = {};
      for (const entityId of ref.involvedEntityIds || []) {
        const entity = fullEntityMapRef.current.get(entityId);
        if (entity?.enrichment?.text?.visualThesis) {
          visualIdentities[entityId] = entity.enrichment.text.visualThesis as string;
        }
      }
      onEnqueue([{
        entity: {
          id: primaryEntity?.entityId || selectedItem.chronicleId,
          name: primaryEntity?.entityName || selectedItem.name,
          kind: primaryEntity?.entityKind || "chronicle",
        },
        type: "entityChronicle",
        chronicleId: selectedItem.chronicleId,
        chronicleStep: "regenerate_scene_description",
        chronicleContext: generationContext,
        imageRefId: ref.refId,
        visualIdentities,
      }]);
    },
    [selectedItem, generationContext, onEnqueue, fullEntityMapRef],
  );

  const handleGenerateCoverImageScene = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    const primaryEntity = selectedItem.roleAssignments?.[0];
    const visualIdentities: Record<string, string> = {};
    for (const ra of selectedItem.roleAssignments || []) {
      const entity = fullEntityMapRef.current.get(ra.entityId);
      if (entity?.enrichment?.text?.visualThesis) {
        visualIdentities[ra.entityId] = entity.enrichment.text.visualThesis as string;
      }
    }
    onEnqueue([{
      entity: {
        id: primaryEntity?.entityId || selectedItem.chronicleId,
        name: primaryEntity?.entityName || selectedItem.name,
        kind: primaryEntity?.entityKind || "chronicle",
      },
      type: "entityChronicle",
      chronicleId: selectedItem.chronicleId,
      chronicleStep: "cover_image_scene",
      chronicleContext: generationContext,
      visualIdentities,
    }]);
  }, [selectedItem, generationContext, onEnqueue, fullEntityMapRef]);

  const handleGenerateCoverImage = useCallback(() => {
    if (!selectedItem?.coverImage?.sceneDescription) return;
    const coverImage = selectedItem.coverImage;
    updateChronicleCoverImageStatus(selectedItem.chronicleId, {
      status: "generating",
    }).then(() => refreshChronicle(selectedItem.chronicleId));

    const resolved = resolveStyleSelection({
      selection: chronicleStyleSelection,
      entityKind: "chronicle",
      styleLibrary,
    });
    const coverConfig = getCoverImageConfig(selectedItem.narrativeStyleId || "epic-drama");
    const coverComposition = styleLibrary?.compositionStyles?.find(
      (s: { id: string }) => s.id === coverConfig.compositionStyleId,
    );
    const styleInfo = {
      compositionPromptFragment:
        coverComposition?.promptFragment ||
        "cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING",
      artisticPromptFragment: resolved.artisticStyle?.promptFragment,
      colorPalettePromptFragment: resolved.colorPalette?.promptFragment,
    };
    const prompt = buildChronicleScenePrompt(
      {
        sceneDescription: coverImage.sceneDescription,
        size: "medium",
        chronicleTitle: selectedItem.title || selectedItem.name,
        world: worldContext
          ? {
              name: worldContext.name,
              description: worldContext.description,
              speciesConstraint: worldContext.speciesConstraint,
            }
          : undefined,
      },
      styleInfo,
    );
    onEnqueue([{
      entity: {
        id: selectedItem.chronicleId,
        name: selectedItem.name || "Chronicle",
        kind: "chronicle",
      },
      type: "image",
      prompt,
      chronicleId: selectedItem.chronicleId,
      imageRefId: "__cover_image__",
      sceneDescription: coverImage.sceneDescription,
      imageType: "chronicle",
      imageSize: chronicleImageSize,
      imageQuality: chronicleImageQuality,
    }]);
  }, [
    selectedItem,
    styleLibrary,
    chronicleStyleSelection,
    worldContext,
    onEnqueue,
    refreshChronicle,
    chronicleImageSize,
    chronicleImageQuality,
  ]);

  const handleGenerateChronicleImage = useCallback(
    (ref: { refId: string; sceneDescription: string }, prompt: string, _styleInfo: Record<string, unknown>) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        status: "generating",
      }).then(() => refreshChronicle(selectedItem.chronicleId));
      const chronicleEntity = {
        id: selectedItem.chronicleId,
        name: selectedItem.name || "Chronicle",
        kind: "chronicle",
      };
      onEnqueue([{
        entity: chronicleEntity,
        type: "image",
        prompt,
        chronicleId: selectedItem.chronicleId,
        imageRefId: ref.refId,
        sceneDescription: ref.sceneDescription,
        imageType: "chronicle",
        imageSize: chronicleImageSize,
        imageQuality: chronicleImageQuality,
      }]);
    },
    [selectedItem, onEnqueue, refreshChronicle, chronicleImageSize, chronicleImageQuality],
  );

  const handleResetChronicleImage = useCallback(
    (ref: { refId: string }) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        status: "pending",
        error: "",
        generatedImageId: "",
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle],
  );

  const handleUpdateChronicleAnchorText = useCallback(
    (ref: { refId: string }, anchorText: string) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        anchorText,
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle],
  );

  const handleUpdateChronicleImageSize = useCallback(
    (ref: { refId: string }, size: string) => {
      if (!selectedItem?.chronicleId) return;
      const updates: Record<string, unknown> = { size };
      if (size === "full-width") {
        updates.justification = null;
      }
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, updates).then(() =>
        refreshChronicle(selectedItem.chronicleId),
      );
    },
    [selectedItem, refreshChronicle],
  );

  const handleUpdateChronicleImageJustification = useCallback(
    (ref: { refId: string }, justification: string) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        justification,
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle],
  );

  const handleApplyImageRefSelections = useCallback(
    async (selections: Record<string, unknown>, newTargetVersionId: string) => {
      if (!selectedItem?.chronicleId) return;
      await applyImageRefSelections(selectedItem.chronicleId, selections, newTargetVersionId);
      await refreshChronicle(selectedItem.chronicleId);
    },
    [selectedItem, refreshChronicle],
  );

  const handleSelectExistingImage = useCallback(
    async (ref: { refId: string }, imageId: string) => {
      if (!selectedItem?.chronicleId) return;
      await updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        generatedImageId: imageId,
        status: "complete",
        error: undefined,
      });
      await refreshChronicle(selectedItem.chronicleId);
    },
    [selectedItem, refreshChronicle],
  );

  const handleSelectExistingCoverImage = useCallback(
    async (imageId: string) => {
      if (!selectedItem?.chronicleId || !selectedItem?.coverImage) return;
      await updateChronicleCoverImageStatus(selectedItem.chronicleId, {
        status: "complete",
        generatedImageId: imageId,
        error: undefined,
      });
      await refreshChronicle(selectedItem.chronicleId);
    },
    [selectedItem, refreshChronicle],
  );

  return {
    handleGenerateImageRefs,
    handleRegenerateDescription,
    handleGenerateCoverImageScene,
    handleGenerateCoverImage,
    handleGenerateChronicleImage,
    handleResetChronicleImage,
    handleUpdateChronicleAnchorText,
    handleUpdateChronicleImageSize,
    handleUpdateChronicleImageJustification,
    handleApplyImageRefSelections,
    handleSelectExistingImage,
    handleSelectExistingCoverImage,
  };
}
