/**
 * CatalogReview — Paginated table of images with inline metadata editing.
 *
 * Shows thumbnail, title, tags, imageType, style IDs.
 * Supports inline editing of title, tags, and imageType.
 * Filter by missing fields to focus on images needing attention.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import { db } from "../../lib/db/illuminatorDb";
import type { ImageType } from "../../lib/imageTypes";
import "./CatalogReview.css";

interface CatalogReviewProps {
  projectId: string;
  styleLibrary?: StyleLibrary | null;
}

interface ReviewImage {
  imageId: string;
  entityName?: string;
  entityKind?: string;
  imageType?: string;
  title?: string;
  tags?: string[];
  artisticStyleId?: string;
  compositionStyleId?: string;
  colorPaletteId?: string;
  generatedAt: number;
  thumbUrl?: string;
}

type FilterMode = "all" | "missing-title" | "missing-tags" | "missing-style" | "missing-any";

const PAGE_SIZE = 50;
const IMAGE_TYPES: ImageType[] = ["entity", "scene", "cover", "other"];

export default function CatalogReview({ projectId, styleLibrary }: Readonly<CatalogReviewProps>) {
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editType, setEditType] = useState<string>("");
  const [editArtistic, setEditArtistic] = useState<string>("");
  const [editComposition, setEditComposition] = useState<string>("");
  const [editPalette, setEditPalette] = useState<string>("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const thumbCache = useRef(new Map<string, string>());

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      let allImages = await db.images
        .where("projectId")
        .equals(projectId)
        .toArray();

      // Apply filter
      if (filter !== "all") {
        allImages = allImages.filter((img) => {
          const rec = img as unknown as Record<string, unknown>;
          switch (filter) {
            case "missing-title":
              return !rec.title;
            case "missing-tags":
              return !rec.tags || (rec.tags as string[]).length === 0;
            case "missing-style":
              return !rec.artisticStyleId || !rec.compositionStyleId || !rec.colorPaletteId;
            case "missing-any":
              return !rec.title ||
                !rec.tags || (rec.tags as string[]).length === 0 ||
                !rec.artisticStyleId || !rec.compositionStyleId || !rec.colorPaletteId;
            default:
              return true;
          }
        });
      }

      // Sort newest first
      allImages.sort((a, b) => {
        const aRec = a as unknown as Record<string, unknown>;
        const bRec = b as unknown as Record<string, unknown>;
        return ((bRec.generatedAt as number) || 0) - ((aRec.generatedAt as number) || 0);
      });

      setTotal(allImages.length);

      // Paginate
      const pageImages = allImages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      // Build review items + load thumbnails
      const items: ReviewImage[] = [];
      for (const img of pageImages) {
        const rec = img as unknown as Record<string, unknown>;
        const imageId = rec.imageId as string;

        // Load thumbnail if not cached
        if (!thumbCache.current.has(imageId)) {
          try {
            const blobRec = await db.table("imageBlobs").get(imageId);
            if (blobRec?.blob) {
              const url = URL.createObjectURL(blobRec.blob as Blob);
              thumbCache.current.set(imageId, url);
            }
          } catch {
            // No blob — skip thumbnail
          }
        }

        items.push({
          imageId,
          entityName: rec.entityName as string | undefined,
          entityKind: rec.entityKind as string | undefined,
          imageType: rec.imageType as string | undefined,
          title: rec.title as string | undefined,
          tags: rec.tags as string[] | undefined,
          artisticStyleId: rec.artisticStyleId as string | undefined,
          compositionStyleId: rec.compositionStyleId as string | undefined,
          colorPaletteId: rec.colorPaletteId as string | undefined,
          generatedAt: (rec.generatedAt as number) || 0,
          thumbUrl: thumbCache.current.get(imageId),
        });
      }

      setImages(items);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, filter]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [filter]);

  const startEdit = useCallback((img: ReviewImage) => {
    setEditingId(img.imageId);
    setEditTitle(img.title || "");
    setEditTags(img.tags?.join(", ") || "");
    setEditType(img.imageType || "other");
    setEditArtistic(img.artisticStyleId || "");
    setEditComposition(img.compositionStyleId || "");
    setEditPalette(img.colorPaletteId || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const updates: Record<string, unknown> = {
      title: editTitle.trim() || undefined,
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      imageType: editType,
      artisticStyleId: editArtistic || undefined,
      compositionStyleId: editComposition || undefined,
      colorPaletteId: editPalette || undefined,
    };
    await db.images.update(editingId, updates);
    setEditingId(null);
    loadPage();
  }, [editingId, editTitle, editTags, editType, editArtistic, editComposition, editPalette, loadPage]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const resolveStyleName = useCallback((field: "artisticStyles" | "compositionStyles" | "colorPalettes", id?: string) => {
    if (!id || !styleLibrary) return id || "—";
    const styles = styleLibrary[field] as Array<{ id: string; name: string }> | undefined;
    const match = styles?.find((s) => s.id === id);
    return match?.name || id;
  }, [styleLibrary]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="cat-review">
      <div className="cat-review-toolbar">
        <select
          className="cat-review-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterMode)}
        >
          <option value="all">All images</option>
          <option value="missing-title">Missing title</option>
          <option value="missing-tags">Missing tags</option>
          <option value="missing-style">Missing style IDs</option>
          <option value="missing-any">Missing any field</option>
        </select>
        <span className="cat-review-count">{total} images</span>
        {totalPages > 1 && (
          <div className="cat-review-pager">
            <button
              className="cov-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span className="cat-review-page">
              {page + 1}/{totalPages}
            </span>
            <button
              className="cov-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {loading && images.length === 0 && (
        <div className="cat-loading">Loading images...</div>
      )}

      <table className="cat-review-table">
        <thead>
          <tr>
            <th className="cat-review-th-thumb"></th>
            <th>Title</th>
            <th>Type</th>
            <th>Tags</th>
            <th>Entity</th>
            <th>Artistic</th>
            <th>Composition</th>
            <th>Palette</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {images.map((img) => (
            <tr key={img.imageId} className={editingId === img.imageId ? "cat-review-editing" : ""}>
              <td className="cat-review-thumb">
                {img.thumbUrl ? (
                  <img
                    src={img.thumbUrl}
                    alt=""
                    onClick={() => setLightboxUrl(img.thumbUrl!)}
                    className="cat-review-thumb-clickable"
                  />
                ) : (
                  <div className="cat-review-no-thumb" />
                )}
              </td>
              {editingId === img.imageId ? (
                <>
                  <td>
                    <input
                      className="cat-review-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title..."
                    />
                  </td>
                  <td>
                    <select
                      className="cat-review-select"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                    >
                      {IMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="cat-review-input"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="tag1, tag2, ..."
                    />
                  </td>
                  <td className="cat-review-entity">{img.entityName || "—"}</td>
                  <td>
                    <select className="cat-review-select" value={editArtistic} onChange={(e) => setEditArtistic(e.target.value)}>
                      <option value="">—</option>
                      {styleLibrary?.artisticStyles.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="cat-review-select" value={editComposition} onChange={(e) => setEditComposition(e.target.value)}>
                      <option value="">—</option>
                      {styleLibrary?.compositionStyles.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="cat-review-select" value={editPalette} onChange={(e) => setEditPalette(e.target.value)}>
                      <option value="">—</option>
                      {styleLibrary?.colorPalettes.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="cat-review-actions">
                    <button className="cov-btn cov-btn-primary" onClick={saveEdit}>Save</button>
                    <button className="cov-btn" onClick={cancelEdit}>Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className={!img.title ? "cat-review-missing" : ""}>
                    {img.title || "—"}
                  </td>
                  <td>{img.imageType || "—"}</td>
                  <td className={!img.tags?.length ? "cat-review-missing" : ""}>
                    {img.tags?.length ? img.tags.join(", ") : "—"}
                  </td>
                  <td className="cat-review-entity">{img.entityName || "—"}</td>
                  <td className="cat-review-style">{resolveStyleName("artisticStyles", img.artisticStyleId)}</td>
                  <td className="cat-review-style">{resolveStyleName("compositionStyles", img.compositionStyleId)}</td>
                  <td className="cat-review-style">{resolveStyleName("colorPalettes", img.colorPaletteId)}</td>
                  <td className="cat-review-actions">
                    <button className="cov-btn" onClick={() => startEdit(img)}>Edit</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="cat-review-toolbar cat-review-bottom-pager">
          <button
            className="cov-btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="cat-review-page">
            {page + 1}/{totalPages}
          </span>
          <button
            className="cov-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {lightboxUrl && (
        <div className="cat-review-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
