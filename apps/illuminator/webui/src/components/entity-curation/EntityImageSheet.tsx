/**
 * EntityImageSheet — Scrollable entity image cards with style pills and thumbnail strips.
 *
 * Mirrors the chronicle CurationImageSheet pattern: each entity gets a card showing
 * its current primary image, assigned style pills, and a horizontal thumbnail strip
 * of all generated image versions.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import { getImagesForEntity, loadImage } from "../../lib/db/imageRepository";
import { applyImageResult } from "../../lib/db/entityRepository";
import { useEntityStore } from "../../lib/db/entityStore";
import { useLazyImageUrl } from "../ChronicleImagePanelCards";
import StylePills from "../curation/StylePills";
import type { StyleNameMaps } from "../curation/StylePills";
import ThumbnailStrip from "../curation/ThumbnailStrip";
import type { ThumbUrl } from "../curation/ThumbnailStrip";
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
  const [thumbs, setThumbs] = useState<ThumbUrl[]>([]);

  // Load all generated images for this entity
  useEffect(() => {
    let cancelled = false;
    getImagesForEntity(entity.id).then((images) => {
      if (cancelled) return;
      const promises = images.map((img) =>
        loadImage(img.imageId).then((loaded) =>
          loaded ? { imageId: loaded.imageId, url: loaded.url } : null
        )
      );
      Promise.all(promises).then((results) => {
        if (!cancelled) {
          setThumbs(results.filter((r): r is ThumbUrl => r !== null));
        }
      });
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

  return (
    <div ref={containerRef} className="eis-card">
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
      </div>
      <StylePills
        artisticId={entity.suggestedArtisticStyleId}
        compositionId={entity.suggestedCompositionStyleId}
        paletteId={entity.suggestedColorPaletteId}
        styleNames={styleNames}
      />
      <ThumbnailStrip
        thumbs={thumbs}
        selectedImageId={entity.imageId}
        onSelect={handleSelectImage}
        onViewFull={onViewFull}
      />
    </div>
  );
}
