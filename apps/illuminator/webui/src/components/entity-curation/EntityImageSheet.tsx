/**
 * EntityImageSheet — Scrollable entity image cards with style pills and thumbnail strips.
 *
 * Each entity card lazily loads its primary image via useLazyImageUrl (IntersectionObserver).
 * Thumbnail strips load image blobs on demand — this component only fetches lightweight
 * metadata (imageIds) from getImagesForEntity, never blobs.
 */

import React, { useState, useEffect, useCallback } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import { getImagesForEntity } from "../../lib/db/imageRepository";
import { applyImageResult, toggleEntityCurationComplete } from "../../lib/db/entityRepository";
import { useEntityStore } from "../../lib/db/entityStore";
import { useLazyImageUrl } from "../ChronicleImagePanelCards";
import StylePills from "../curation/StylePills";
import type { StyleNameMaps } from "../curation/StylePills";
import ThumbnailStrip from "../curation/ThumbnailStrip";
import ImageModal from "../ImageModal";
import "./EntityImageSheet.css";

interface Props {
  entities: EntityNavItem[];
  styleNames: StyleNameMaps;
}

export default function EntityImageSheet({ entities, styleNames }: Readonly<Props>) {
  const [modalImage, setModalImage] = useState<{ imageId: string; title: string } | null>(null);

  if (entities.length === 0) {
    return <div className="eis-empty">No entities in this group</div>;
  }

  return (
    <div className="eis-sheet">
      {entities.map((entity) => (
        <EntityImageCard
          key={entity.id}
          entity={entity}
          styleNames={styleNames}
          onViewFull={setModalImage}
        />
      ))}
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

function EntityImageCard({ entity, styleNames, onViewFull }: Readonly<{
  entity: EntityNavItem;
  styleNames: StyleNameMaps;
  onViewFull: (info: { imageId: string; title: string }) => void;
}>) {
  const { containerRef, url: primaryUrl } = useLazyImageUrl(entity.imageId);
  const refreshEntities = useEntityStore((s) => s.refreshEntities);

  // Load image IDs only (metadata, no blobs) — ThumbnailStrip handles blob loading
  const [thumbImageIds, setThumbImageIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getImagesForEntity(entity.id).then((images) => {
      if (!cancelled) {
        setThumbImageIds(images.map((img) => img.imageId));
      }
    });
    return () => { cancelled = true; };
  }, [entity.id, entity.imageId]);

  const handleSelectImage = useCallback(
    async (imageId: string) => {
      await applyImageResult(entity.id, { imageId, generatedAt: Date.now(), model: "" });
      await refreshEntities([entity.id]);
    },
    [entity.id, refreshEntities]
  );

  const handleToggleComplete = useCallback(async () => {
    await toggleEntityCurationComplete(entity.id, !entity.curationComplete);
    await refreshEntities([entity.id]);
  }, [entity.id, entity.curationComplete, refreshEntities]);

  return (
    <div ref={containerRef} className={`eis-card${entity.curationComplete ? " eis-card-complete" : ""}`}>
      <div className="eis-card-header">
        {primaryUrl ? (
          <img
            className="eis-primary-thumb"
            src={primaryUrl}
            alt={entity.name}
            onClick={() => onViewFull({ imageId: entity.imageId!, title: entity.name })}
          />
        ) : (
          <div className="eis-primary-placeholder" />
        )}
        <div className="eis-entity-info">
          <div className="eis-entity-name">{entity.name}</div>
          <div className="eis-entity-subtype">{entity.subtype}</div>
        </div>
        <button
          className={`eis-complete-toggle${entity.curationComplete ? " eis-complete-toggle-active" : ""}`}
          onClick={handleToggleComplete}
          title={entity.curationComplete ? "Mark as incomplete" : "Mark curation as complete"}
        >
          {entity.curationComplete ? "✓" : "○"}
        </button>
      </div>
      <StylePills
        artisticId={entity.suggestedArtisticStyleId}
        compositionId={entity.suggestedCompositionStyleId}
        paletteId={entity.suggestedColorPaletteId}
        styleNames={styleNames}
      />
      <ThumbnailStrip
        imageIds={thumbImageIds}
        selectedImageId={entity.imageId}
        onSelect={handleSelectImage}
        onViewFull={onViewFull}
      />
    </div>
  );
}
