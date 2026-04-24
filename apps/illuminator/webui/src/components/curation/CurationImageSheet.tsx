/**
 * CurationImageSheet — Image contact sheet for chronicle curation.
 *
 * Shows cover image, scene images with inline thumbnail strips, entity refs.
 * Thumbnail strips lazily load image blobs on demand — this component only
 * fetches lightweight metadata (imageIds grouped by refId), never blobs.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { searchChronicleImages } from "../../lib/db/imageRepository";
import { updateChronicleImageRef, updateChronicleCoverImageStatus } from "../../lib/db/chronicleImageOps";
import { toggleChronicleCurationComplete } from "../../lib/db/chronicleRefinementOps";
import type { ChronicleRecord, EntityImageRef, PromptRequestRef } from "../../lib/chronicleTypes";
import { useLazyImageUrl } from "../ChronicleImagePanelCards";
import ImageModal from "../ImageModal";
import StylePills from "./StylePills";
import type { StyleNameMaps } from "./StylePills";
import ThumbnailStrip from "./ThumbnailStrip";
import "./CurationImageSheet.css";

interface CurationImageSheetProps {
  chronicleId: string;
  projectId: string;
  styleNames: StyleNameMaps;
}

export default function CurationImageSheet({
  chronicleId,
  projectId,
  styleNames,
}: Readonly<CurationImageSheetProps>) {
  const chronicle = useChronicleStore((s) => s.cache.get(chronicleId)) as ChronicleRecord | undefined;
  const loadChronicle = useChronicleStore((s) => s.loadChronicle);
  const refreshChronicle = useChronicleStore((s) => s.refreshChronicle);

  // Load chronicle data if not cached
  useEffect(() => {
    if (!chronicle) loadChronicle(chronicleId);
  }, [chronicle, chronicleId, loadChronicle]);

  // Image modal state
  const [modalImage, setModalImage] = useState<{ imageId: string; title: string } | null>(null);

  // Image IDs keyed by imageRefId → array of imageIds (metadata only, no blobs)
  const [imageIdsByRef, setImageIdsByRef] = useState<Map<string, string[]>>(new Map());

  // Separate entity refs and prompt requests
  const { entityRefs, promptRequests } = useMemo(() => {
    const refs = chronicle?.imageRefs?.refs || [];
    return {
      entityRefs: refs.filter((r): r is EntityImageRef => r.type === "entity_ref"),
      promptRequests: refs.filter((r): r is PromptRequestRef => r.type === "prompt_request"),
    };
  }, [chronicle]);

  // Load image metadata (IDs only) for all scene images belonging to this chronicle
  useEffect(() => {
    if (!projectId || !chronicleId) return;
    let cancelled = false;

    searchChronicleImages({ projectId, chronicleId, limit: 200 }).then((result) => {
      if (cancelled) return;

      // Group image IDs by imageRefId — no blob loading needed
      const byRef = new Map<string, string[]>();
      for (const img of result.items) {
        const refId = img.imageRefId || "__cover_image__";
        if (!byRef.has(refId)) byRef.set(refId, []);
        byRef.get(refId)!.push(img.imageId);
      }

      setImageIdsByRef(byRef);
    });

    return () => { cancelled = true; };
  }, [projectId, chronicleId]);

  // Handle selecting an image for a ref (or cover)
  const handleSelectImage = useCallback(
    async (refId: string, imageId: string) => {
      if (refId === "__cover_image__") {
        await updateChronicleCoverImageStatus(chronicleId, {
          status: "complete",
          generatedImageId: imageId,
          error: undefined,
        });
      } else {
        await updateChronicleImageRef(chronicleId, refId, {
          generatedImageId: imageId,
          status: "complete",
          error: undefined,
        });
      }
      await refreshChronicle(chronicleId);
    },
    [chronicleId, refreshChronicle]
  );

  // Handle size change
  const handleUpdateSize = useCallback(
    async (refId: string, size: string) => {
      await updateChronicleImageRef(chronicleId, refId, {
        size: size as "small" | "medium" | "large" | "full-width",
      });
      await refreshChronicle(chronicleId);
    },
    [chronicleId, refreshChronicle]
  );

  // Handle justification change
  const handleUpdateJustification = useCallback(
    async (refId: string, justification: string) => {
      await updateChronicleImageRef(chronicleId, refId, {
        justification: (justification || null) as "left" | "right" | null,
      });
      await refreshChronicle(chronicleId);
    },
    [chronicleId, refreshChronicle]
  );

  // Handle curation complete toggle
  const handleToggleComplete = useCallback(async () => {
    await toggleChronicleCurationComplete(chronicleId, !chronicle?.curationComplete);
    await refreshChronicle(chronicleId);
  }, [chronicleId, chronicle?.curationComplete, refreshChronicle]);

  if (!chronicle) {
    return <div className="cis-loading">Loading chronicle...</div>;
  }

  if (!chronicle.imageRefs && !chronicle.coverImage) {
    return <div className="cis-no-images">No image references generated for this chronicle.</div>;
  }

  return (
    <div className="cis-sheet">
      <div className="cis-chronicle-header">
        <div className="cis-chronicle-title">{chronicle.title || "Untitled Chronicle"}</div>
        <button
          className={`cis-complete-toggle${chronicle.curationComplete ? " cis-complete-toggle-active" : ""}`}
          onClick={handleToggleComplete}
          title={chronicle.curationComplete ? "Mark as incomplete" : "Mark curation as complete"}
        >
          {chronicle.curationComplete ? "✓ Complete" : "Mark Complete"}
        </button>
      </div>

      {/* Cover Image */}
      {chronicle.coverImage && (
        <CoverImageSection
          chronicle={chronicle}
          imageIds={imageIdsByRef.get("__cover_image__") || []}
          styleNames={styleNames}
          onSelectImage={(imgId) => handleSelectImage("__cover_image__", imgId)}
          onViewFull={setModalImage}
        />
      )}

      {/* Scene Images */}
      {promptRequests.length > 0 && (
        <div>
          <div className="cis-section-label">Scene Images ({promptRequests.length})</div>
          {promptRequests.map((ref) => (
            <div key={ref.refId} className="cis-scene-card">
              <div className="cis-scene-description">
                {ref.sceneDescription || "No description"}
              </div>
              <div className="cis-scene-meta">
                <span className={`cis-scene-status cis-scene-status-${ref.status || "pending"}`}>
                  {ref.status || "pending"}
                </span>
                <span>Size: {ref.size || "auto"}</span>
                {ref.justification && <span>Justify: {ref.justification}</span>}
              </div>
              <StylePills
                artisticId={ref.suggestedArtisticStyleId}
                compositionId={ref.suggestedCompositionStyleId}
                paletteId={ref.suggestedColorPaletteId}
                styleNames={styleNames}
              />
              <ThumbnailStrip
                imageIds={imageIdsByRef.get(ref.refId) || []}
                selectedImageId={ref.generatedImageId}
                onSelect={(imgId) => handleSelectImage(ref.refId, imgId)}
                onViewFull={setModalImage}
              />
              <div className="cis-inline-controls">
                <select
                  className="cis-size-select"
                  value={ref.size || ""}
                  onChange={(e) => handleUpdateSize(ref.refId, e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="full-width">Full</option>
                </select>
                <select
                  className="cis-justify-select"
                  value={ref.justification || ""}
                  onChange={(e) => handleUpdateJustification(ref.refId, e.target.value)}
                >
                  <option value="">Auto</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entity Refs */}
      {entityRefs.length > 0 && (
        <div>
          <div className="cis-section-label">Entity References ({entityRefs.length})</div>
          <div className="cis-entity-refs">
            {entityRefs.map((ref) => (
              <div key={ref.refId} className="cis-entity-ref">
                <span>{ref.entityId}</span>
                <span className="cis-scene-meta">{ref.size || "auto"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalImage && (
        <ImageModal
          isOpen
          imageId={modalImage.imageId}
          title={modalImage.title}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}

/** Cover image section — lazily loads the single cover image blob. */
function CoverImageSection({
  chronicle,
  imageIds,
  styleNames,
  onSelectImage,
  onViewFull,
}: Readonly<{
  chronicle: ChronicleRecord;
  imageIds: string[];
  styleNames: StyleNameMaps;
  onSelectImage: (imageId: string) => void;
  onViewFull: (info: { imageId: string; title: string }) => void;
}>) {
  const coverImageId = chronicle.coverImage?.generatedImageId ?? null;
  const { containerRef, url: coverUrl } = useLazyImageUrl(coverImageId);

  return (
    <div ref={containerRef}>
      <div className="cis-section-label">Cover Image</div>
      <div className="cis-cover-row">
        {coverUrl ? (
          <img
            className="cis-cover-thumb"
            src={coverUrl}
            alt="Cover"
            onClick={() => onViewFull({
              imageId: chronicle.coverImage!.generatedImageId!,
              title: "Cover Image",
            })}
          />
        ) : (
          <div className="cis-thumb-placeholder">No image</div>
        )}
        <div>
          <div className="cis-cover-status">
            Status: {chronicle.coverImage!.status}
          </div>
          <StylePills
            artisticId={chronicle.coverImage!.suggestedArtisticStyleId}
            compositionId={chronicle.coverImage!.suggestedCompositionStyleId}
            paletteId={chronicle.coverImage!.suggestedColorPaletteId}
            styleNames={styleNames}
          />
        </div>
      </div>
      <ThumbnailStrip
        imageIds={imageIds}
        selectedImageId={chronicle.coverImage!.generatedImageId}
        onSelect={onSelectImage}
        onViewFull={onViewFull}
      />
    </div>
  );
}
