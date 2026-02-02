/**
 * BackrefImageEditor - Entity-centric editor for chronicle backref images
 *
 * For each chronicle backref on an entity, allows selecting:
 * - Which image to display (cover, scene image, entity portrait, or none)
 * - Image size (small / medium / large / full-width)
 * - Alignment (left / right)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useImageUrls } from '../hooks/useImageUrl';
import { getChronicle } from '../lib/db/chronicleRepository';

/**
 * Collect all displayable image IDs from a chronicle record.
 * Returns array of { id, label, source } for the picker.
 */
function collectChronicleImages(chronicle) {
  const images = [];

  // Cover image
  if (chronicle.coverImage?.status === 'complete' && chronicle.coverImage.generatedImageId) {
    images.push({
      imageId: chronicle.coverImage.generatedImageId,
      label: 'Cover image',
      source: { source: 'cover' },
    });
  }

  // Scene images from imageRefs
  if (chronicle.imageRefs?.refs) {
    for (const ref of chronicle.imageRefs.refs) {
      if (ref.type === 'prompt_request' && ref.status === 'complete' && ref.generatedImageId) {
        images.push({
          imageId: ref.generatedImageId,
          label: ref.caption || ref.anchorText || 'Scene image',
          source: { source: 'image_ref', refId: ref.refId },
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
        source: { source: 'entity', entityId: entity.id },
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

  if (imageSource.source === 'cover') {
    return chronicle?.coverImage?.generatedImageId || null;
  }

  if (imageSource.source === 'image_ref') {
    const ref = chronicle?.imageRefs?.refs?.find((r) => r.refId === imageSource.refId);
    if (ref?.type === 'prompt_request' && ref.generatedImageId) return ref.generatedImageId;
    if (ref?.type === 'entity_ref') {
      const entity = entities.find((e) => e.id === ref.entityId);
      return entity?.enrichment?.image?.imageId || null;
    }
    return null;
  }

  if (imageSource.source === 'entity') {
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
      style={{
        width: '60px',
        height: '60px',
        border: selected ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        background: url ? 'transparent' : 'rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}
    >
      {url ? (
        <img
          src={url}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.4)',
        }}>
          ...
        </div>
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
  const currentImageId = backref.imageSource
    ? resolveImageId(backref.imageSource, chronicle, entities)
    : isLegacy
      ? (chronicle?.coverImage?.generatedImageId || null)
      : null;

  const currentSize = backref.imageSize || 'medium';
  const currentAlignment = backref.imageAlignment || 'left';

  const handleSelectImage = useCallback((source) => {
    onChange({
      ...backref,
      imageSource: source,
      imageSize: backref.imageSize || 'medium',
      imageAlignment: backref.imageAlignment || 'left',
    });
  }, [backref, onChange]);

  const handleSelectNone = useCallback(() => {
    onChange({
      ...backref,
      imageSource: null,
      imageSize: undefined,
      imageAlignment: undefined,
    });
  }, [backref, onChange]);

  const handleSizeChange = useCallback((e) => {
    onChange({ ...backref, imageSize: e.target.value });
  }, [backref, onChange]);

  const handleAlignmentChange = useCallback((alignment) => {
    onChange({ ...backref, imageAlignment: alignment });
  }, [backref, onChange]);

  if (!chronicle) {
    return (
      <div style={{ padding: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontStyle: 'italic' }}>
        Chronicle not found: {backref.chronicleId.slice(0, 8)}...
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '6px',
      marginBottom: '8px',
    }}>
      {/* Chronicle title + anchor */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
          {chronicle.title}
        </div>
        <div style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          marginTop: '2px',
          fontStyle: 'italic',
        }}>
          &ldquo;{backref.anchorPhrase.length > 80
            ? backref.anchorPhrase.slice(0, 80) + '...'
            : backref.anchorPhrase}&rdquo;
        </div>
      </div>

      {/* Image picker */}
      {allImages.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Image
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* None button */}
            <button
              onClick={handleSelectNone}
              title="No image"
              style={{
                width: '60px',
                height: '60px',
                border: isNone ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: 0,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
                color: isNone ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                fontSize: '10px',
                flexShrink: 0,
              }}
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Size */}
          <div>
            <label style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginRight: '6px',
            }}>
              Size
            </label>
            <select
              value={currentSize}
              onChange={handleSizeChange}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                color: 'rgba(255,255,255,0.9)',
                padding: '4px 8px',
                fontSize: '12px',
              }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full-width">Full Width</option>
            </select>
          </div>

          {/* Alignment */}
          <div>
            <label style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginRight: '6px',
            }}>
              Align
            </label>
            <button
              onClick={() => handleAlignmentChange('left')}
              style={{
                background: currentAlignment === 'left' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)',
                border: currentAlignment === 'left' ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px 0 0 4px',
                color: 'rgba(255,255,255,0.9)',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Left
            </button>
            <button
              onClick={() => handleAlignmentChange('right')}
              style={{
                background: currentAlignment === 'right' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)',
                border: currentAlignment === 'right' ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0 4px 4px 0',
                color: 'rgba(255,255,255,0.9)',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Right
            </button>
          </div>
        </div>
      )}

      {/* Legacy indicator */}
      {isLegacy && allImages.length > 0 && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', fontStyle: 'italic' }}>
          Using default (cover image, medium, left)
        </div>
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
export default function BackrefImageEditor({ entity, entities, onUpdateBackrefs, alwaysExpanded = false }) {
  const [chronicles, setChronicles] = useState(new Map());
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const backrefs = entity?.enrichment?.chronicleBackrefs || [];

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

    return () => { cancelled = true; };
  }, [backrefs.map((b) => b.chronicleId).join(',')]);

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
          if (ref.type === 'prompt_request' && ref.generatedImageId) {
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

  const handleBackrefChange = useCallback((updatedBackref) => {
    const updated = backrefs.map((b) =>
      b.chronicleId === updatedBackref.chronicleId && b.anchorPhrase === updatedBackref.anchorPhrase
        ? updatedBackref
        : b
    );
    onUpdateBackrefs(entity.id, updated);
  }, [backrefs, entity.id, onUpdateBackrefs]);

  if (backrefs.length === 0) return null;

  const rowsContent = (
    <div style={{ marginTop: alwaysExpanded ? 0 : '8px' }}>
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
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Chronicle Images ({backrefs.length})
        </div>
        {rowsContent}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '10px',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>Chronicle Images ({backrefs.length})</span>
      </button>
      {expanded && rowsContent}
    </div>
  );
}
