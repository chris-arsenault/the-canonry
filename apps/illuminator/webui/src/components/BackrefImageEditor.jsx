/**
 * BackrefImageEditor - Entity-centric editor for chronicle backref images
 *
 * For each chronicle backref on an entity, allows selecting:
 * - Which image to display (cover, scene image, entity portrait, or none)
 * - Image size (small / medium / large / full-width)
 * - Alignment (left / right)
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useImageUrls } from "../hooks/useImageUrl";
import { getChronicle } from "../lib/db/chronicleRepository";
import "./BackrefImageEditor.css";

/**
 * Collect all displayable image IDs from a chronicle record.
 * Returns array of { id, label, source } for the picker.
 */
function collectChronicleImages(chronicle) {
  const images = [];

  // Cover image
  if (chronicle.coverImage?.status === "complete" && chronicle.coverImage.generatedImageId) {
    images.push({
      imageId: chronicle.coverImage.generatedImageId,
      label: "Cover image",
      source: { source: "cover" },
    });
  }

  // Scene images from imageRefs
  if (chronicle.imageRefs?.refs) {
    for (const ref of chronicle.imageRefs.refs) {
      if (ref.type === "prompt_request" && ref.status === "complete" && ref.generatedImageId) {
        images.push({
          imageId: ref.generatedImageId,
          label: ref.caption || ref.anchorText || "Scene image",
          source: { source: "image_ref", refId: ref.refId },
        });
      }
    }
  }

  return images;
}

/**
 * Collect entity portrait images from role assignments.
 * Returns array of { imageId, label, source }.
 */
function collectEntityImages(chronicle, entities) {
  const images = [];
  const seen = new Set();

  for (const role of chronicle.roleAssignments || []) {
    if (seen.has(role.entityId)) continue;
    seen.add(role.entityId);

    const entity = entities.find((e) => e.id === role.entityId);
    if (entity?.enrichment?.image?.imageId) {
      images.push({
        imageId: entity.enrichment.image.imageId,
        label: `${entity.name} (portrait)`,
        source: { source: "entity", entityId: entity.id },
      });
    }
  }

  return images;
}

/**
 * Find the imageId for a given backref source config + chronicle.
 */
function resolveImageId(imageSource, chronicle, entities) {
  if (!imageSource) return null;

  if (imageSource.source === "cover") {
    return chronicle?.coverImage?.generatedImageId || null;
  }

  if (imageSource.source === "image_ref") {
    const ref = chronicle?.imageRefs?.refs?.find((r) => r.refId === imageSource.refId);
    if (ref?.type === "prompt_request" && ref.generatedImageId) return ref.generatedImageId;
    if (ref?.type === "entity_ref") {
      const entity = entities.find((e) => e.id === ref.entityId);
      return entity?.enrichment?.image?.imageId || null;
    }
    return null;
  }

  if (imageSource.source === "entity") {
    const entity = entities.find((e) => e.id === imageSource.entityId);
    return entity?.enrichment?.image?.imageId || null;
  }

  return null;
}

function ImageThumbnail({ imageId, imageUrls, selected, onClick, label }) {
  const result = imageUrls.get(imageId);
  const url = result?.url;

  return (
    <button
      onClick={onClick}
      title={label}
      className={`bie-thumbnail ${selected ? "bie-thumbnail-selected" : "bie-thumbnail-unselected"} ${url ? "bie-thumbnail-has-image" : "bie-thumbnail-placeholder"}`}
    >
      {url ? (
        <img src={url} alt={label} className="bie-thumbnail-img" />
      ) : (
        <div className="bie-thumbnail-placeholder">...</div>
      )}
    </button>
  );
}

function BackrefRow({ backref, chronicle, entities, imageUrls, onChange }) {
  const chronicleImages = useMemo(
    () => (chronicle ? collectChronicleImages(chronicle) : []),
    [chronicle]
  );

  const entityImages = useMemo(
    () => (chronicle ? collectEntityImages(chronicle, entities) : []),
    [chronicle, entities]
  );

  const allImages = useMemo(
    () => [...chronicleImages, ...entityImages],
    [chronicleImages, entityImages]
  );

  // Determine current selection
  const isNone = backref.imageSource === null;
  const isLegacy = backref.imageSource === undefined;
  let currentImageId;
  if (backref.imageSource) {
    currentImageId = resolveImageId(backref.imageSource, chronicle, entities);
  } else if (isLegacy) {
    currentImageId = chronicle?.coverImage?.generatedImageId || null;
  } else {
    currentImageId = null;
  }

  const currentSize = backref.imageSize || "medium";
  const currentAlignment = backref.imageAlignment || "left";

  const handleSelectImage = useCallback(
    (source) => {
      onChange({
        ...backref,
        imageSource: source,
        imageSize: backref.imageSize || "medium",
        imageAlignment: backref.imageAlignment || "left",
      });
    },
    [backref, onChange]
  );

  const handleSelectNone = useCallback(() => {
    onChange({
      ...backref,
      imageSource: null,
      imageSize: undefined,
      imageAlignment: undefined,
    });
  }, [backref, onChange]);

  const handleSizeChange = useCallback(
    (e) => {
      onChange({ ...backref, imageSize: e.target.value });
    },
    [backref, onChange]
  );

  const handleAlignmentChange = useCallback(
    (alignment) => {
      onChange({ ...backref, imageAlignment: alignment });
    },
    [backref, onChange]
  );

  if (!chronicle) {
    return (
      <div className="bie-row-missing">
        Chronicle not found: {backref.chronicleId.slice(0, 8)}...
      </div>
    );
  }

  return (
    <div className="bie-row">
      {/* Chronicle title + anchor */}
      <div className="bie-row-header">
        <div className="bie-row-title">{chronicle.title}</div>
        <div className="bie-row-anchor">
          &ldquo;
          {backref.anchorPhrase.length > 80
            ? backref.anchorPhrase.slice(0, 80) + "..."
            : backref.anchorPhrase}
          &rdquo;
        </div>
      </div>

      {/* Image picker */}
      {allImages.length > 0 && (
        <div className="bie-picker">
          <div className="bie-section-label">Image</div>
          <div className="bie-picker-grid">
            {/* None button */}
            <button
              onClick={handleSelectNone}
              title="No image"
              className={`bie-none-btn ${isNone ? "bie-none-btn-selected" : "bie-none-btn-unselected"}`}
            >
              None
            </button>

            {/* Image thumbnails */}
            {allImages.map((img) => {
              const selected = !isNone && currentImageId === img.imageId;
              return (
                <ImageThumbnail
                  key={img.imageId}
                  imageId={img.imageId}
                  imageUrls={imageUrls}
                  selected={selected}
                  onClick={() => handleSelectImage(img.source)}
                  label={img.label}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Size + Alignment controls (visible when image source is set, even while loading) */}
      {!isNone && (
        <div className="bie-controls">
          {/* Size */}
          <div>
            <label htmlFor="size" className="bie-control-label">Size</label>
            <select id="size" value={currentSize} onChange={handleSizeChange} className="bie-size-select">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full-width">Full Width</option>
            </select>
          </div>

          {/* Alignment */}
          <div>
            <span className="bie-control-label">Align</span>
            <button
              onClick={() => handleAlignmentChange("left")}
              className={`bie-align-btn bie-align-btn-left ${currentAlignment === "left" ? "bie-align-btn-active" : "bie-align-btn-inactive"}`}
            >
              Left
            </button>
            <button
              onClick={() => handleAlignmentChange("right")}
              className={`bie-align-btn bie-align-btn-right ${currentAlignment === "right" ? "bie-align-btn-active" : "bie-align-btn-inactive"}`}
            >
              Right
            </button>
          </div>
        </div>
      )}

      {/* Legacy indicator */}
      {isLegacy && allImages.length > 0 && (
        <div className="bie-legacy-hint">Using default (cover image, medium, left)</div>
      )}
    </div>
  );
}

/**
 * BackrefImageEditor - Main editor component
 *
 * Props:
 * - entity: Entity with enrichment.chronicleBackrefs
 * - entities: All entities (for resolving entity portraits)
 * - onUpdateBackrefs: (entityId, updatedBackrefs) => void
 */
export default function BackrefImageEditor({
  entity,
  entities,
  onUpdateBackrefs,
  alwaysExpanded = false,
}) {
  const [chronicles, setChronicles] = useState(new Map());
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const backrefs = useMemo(
    () => entity?.enrichment?.chronicleBackrefs || [],
    [entity?.enrichment?.chronicleBackrefs]
  );

  // Stable key for chronicle IDs to use as dependency
  const backrefChronicleKey = useMemo(
    () => backrefs.map((b) => b.chronicleId).join(","),
    [backrefs]
  );

  // Load chronicle records for all backrefs
  useEffect(() => {
    if (backrefs.length === 0) return;

    const chronicleIds = [...new Set(backrefs.map((b) => b.chronicleId))];
    let cancelled = false;

    Promise.all(chronicleIds.map((id) => getChronicle(id).then((c) => [id, c]))).then((results) => {
      if (cancelled) return;
      const map = new Map();
      for (const [id, chronicle] of results) {
        if (chronicle) map.set(id, chronicle);
      }
      setChronicles(map);
    });

    return () => {
      cancelled = true;
    };
  }, [backrefs, backrefChronicleKey]);

  // Collect all image IDs we need to load
  const allImageIds = useMemo(() => {
    const ids = [];
    for (const chronicle of chronicles.values()) {
      // Cover image
      if (chronicle.coverImage?.generatedImageId) {
        ids.push(chronicle.coverImage.generatedImageId);
      }
      // Scene images
      if (chronicle.imageRefs?.refs) {
        for (const ref of chronicle.imageRefs.refs) {
          if (ref.type === "prompt_request" && ref.generatedImageId) {
            ids.push(ref.generatedImageId);
          }
        }
      }
      // Entity portraits from cast
      for (const role of chronicle.roleAssignments || []) {
        const ent = entities.find((e) => e.id === role.entityId);
        if (ent?.enrichment?.image?.imageId) {
          ids.push(ent.enrichment.image.imageId);
        }
      }
    }
    return [...new Set(ids)];
  }, [chronicles, entities]);

  // Only load blobs when the editor is visible (expanded or alwaysExpanded)
  const imageUrls = useImageUrls(expanded ? allImageIds : []);

  const handleBackrefChange = useCallback(
    (updatedBackref) => {
      const updated = backrefs.map((b) =>
        b.chronicleId === updatedBackref.chronicleId &&
        b.anchorPhrase === updatedBackref.anchorPhrase
          ? updatedBackref
          : b
      );
      onUpdateBackrefs(entity.id, updated);
    },
    [backrefs, entity.id, onUpdateBackrefs]
  );

  if (backrefs.length === 0) return null;

  const rowsContent = (
    <div
      className={alwaysExpanded ? "bie-rows-container-expanded" : "bie-rows-container-collapsed"}
    >
      {backrefs.map((backref, i) => (
        <BackrefRow
          key={`${backref.chronicleId}-${i}`}
          backref={backref}
          chronicle={chronicles.get(backref.chronicleId) || null}
          entities={entities}
          imageUrls={imageUrls}
          onChange={handleBackrefChange}
        />
      ))}
    </div>
  );

  if (alwaysExpanded) {
    return (
      <div className="bie-wrapper">
        <div className="bie-heading">Chronicle Images ({backrefs.length})</div>
        {rowsContent}
      </div>
    );
  }

  return (
    <div className="bie-wrapper">
      <button onClick={() => setExpanded(!expanded)} className="bie-toggle-btn">
        <span
          className={`bie-toggle-arrow ${expanded ? "bie-toggle-arrow-expanded" : "bie-toggle-arrow-collapsed"}`}
        >
          ▶
        </span>
        <span className="bie-toggle-label">Chronicle Images ({backrefs.length})</span>
      </button>
      {expanded && rowsContent}
    </div>
  );
}

ImageThumbnail.propTypes = {
  imageId: PropTypes.string.isRequired,
  imageUrls: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onClick: PropTypes.func,
  label: PropTypes.string,
};

BackrefRow.propTypes = {
  backref: PropTypes.object.isRequired,
  chronicle: PropTypes.object,
  entities: PropTypes.array.isRequired,
  imageUrls: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

BackrefImageEditor.propTypes = {
  entity: PropTypes.object,
  entities: PropTypes.array.isRequired,
  onUpdateBackrefs: PropTypes.func.isRequired,
  alwaysExpanded: PropTypes.bool,
};
