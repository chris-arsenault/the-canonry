/**
 * UpscaleView — Batch image upscaling via fal.ai with style-aware prompts.
 *
 * Calls the fal.ai client directly (not through the enrichment worker queue)
 * since the upscale client is just fetch calls that don't block the UI.
 *
 * Features:
 * - Model selection (Clarity, Creative, Topaz CGI)
 * - Scale factor (2x, 4x)
 * - Creativity / resemblance sliders (for prompt-guided models)
 * - Test mode toggle (saves to test blob store, not production)
 * - Image grid with selection checkboxes and status badges
 * - Progress bar during batch processing
 * - Cost estimate based on selection
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { ImageMetadataRecord } from "../../lib/preprint/prePrintStats";
import type { UpscaleModel } from "../../lib/imageClient.fal";
import { upscaleImage } from "../../lib/imageClient.fal";
import { buildUpscalePrompt } from "../../lib/upscalePromptBuilder";
import { useStyleLibrary } from "../../hooks/useStyleLibrary";
import useApiKeys from "../../hooks/useApiKeys";
import {
  getBestSourceBlob,
  saveUpscaleBlob,
  saveTestUpscaleBlob,
} from "../../lib/db/upscaleRepository";
import { extractImageDimensions } from "../../lib/db/imageRepository";
import { db } from "../../lib/db/illuminatorDb";
import ImageWorkspace from "./ImageWorkspace";
import "./UpscaleView.css";

// ---------------------------------------------------------------------------
// ImageThumb — lazy-loading thumbnail sub-component
// ---------------------------------------------------------------------------

function ImageThumb({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    db.imageBlobs.get(imageId).then((record) => {
      if (!revoked && record?.blob) {
        objectUrl = URL.createObjectURL(record.blob);
        setUrl(objectUrl);
      }
    });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  if (!url) return <div className="uv-thumb-placeholder" />;
  return <img src={url} alt="" className="uv-thumb-img" loading="lazy" />;
}

// ---------------------------------------------------------------------------
// UpscaleView
// ---------------------------------------------------------------------------

interface UpscaleViewProps {
  images: ImageMetadataRecord[];
  projectId: string;
}

export default function UpscaleView({ images, projectId: _projectId }: Readonly<UpscaleViewProps>) {
  const { styleLibrary } = useStyleLibrary();
  const { falApiKey } = useApiKeys();

  // Settings
  const [model, setModel] = useState<UpscaleModel>("clarity");
  const [factor, setFactor] = useState<2 | 4>(2);
  const [creativity, setCreativity] = useState(0.3);
  const [resemblance, setResemblance] = useState(0.6);
  const [testMode, setTestMode] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing
  const [processing, setProcessing] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Pagination
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(images.length / PAGE_SIZE);
  const pageImages = useMemo(() => images.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [images, page]);

  // Workspace (replaces old preview panel)
  const [workspaceImageId, setWorkspaceImageId] = useState<string | null>(null);

  // ---------- Selection helpers ----------

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(images.map((img) => img.imageId)));
  }, [images]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  // ---------- Cost estimate ----------

  const costEstimate = useMemo(() => {
    // Clarity: ~$0.04 per image at 2x, ~$0.10 at 4x
    // Creative: ~$0.06 per image at 2x, ~$0.15 at 4x
    // Topaz: ~$0.08 per image
    const perImage =
      model === "clarity"
        ? factor === 2
          ? 0.04
          : 0.10
        : model === "creative"
          ? factor === 2
            ? 0.06
            : 0.15
          : 0.08;
    return (selectedIds.size * perImage).toFixed(2);
  }, [selectedIds.size, model, factor]);

  // ---------- Workspace ----------

  const handleOpenWorkspace = useCallback((imageId: string) => {
    setWorkspaceImageId(imageId);
  }, []);

  const handleCloseWorkspace = useCallback(() => {
    setWorkspaceImageId(null);
  }, []);

  // ---------- Upscale handler ----------

  const handleRunUpscale = useCallback(async () => {
    if (selectedIds.size === 0 || processing) return;
    setProcessing(true);
    setProcessedCount(0);
    setErrorCount(0);

    const ids = [...selectedIds];
    for (let i = 0; i < ids.length; i++) {
      const imageId = ids[i];
      setCurrentImageId(imageId);
      setStatus(`Processing ${i + 1}/${ids.length}...`);

      try {
        const source = await getBestSourceBlob(imageId);

        // Convert blob to data URI
        const arrayBuffer = await source.blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        const base64 = btoa(binary);
        const mimeType = source.blob.type || "image/png";
        const dataUri = `data:${mimeType};base64,${base64}`;

        // Build style-aware prompt
        const img = images.find((im) => im.imageId === imageId);
        const { prompt, negativePrompt } = buildUpscalePrompt(
          styleLibrary,
          img?.artisticStyleId,
          img?.compositionStyleId,
          img?.colorPaletteId,
        );

        const result = await upscaleImage(
          { imageDataUri: dataUri, model, factor, creativity, resemblance, prompt, negativePrompt, falApiKey },
          (s) => setStatus(`${i + 1}/${ids.length}: ${s}`),
        );

        if (result.error || !result.imageBlob) {
          setErrorCount((c) => c + 1);
          continue;
        }

        const dimensions = await extractImageDimensions(result.imageBlob);
        const width = dimensions.width || result.width;
        const height = dimensions.height || result.height;

        if (testMode) {
          await saveTestUpscaleBlob({
            testId: `test_${imageId}_${Date.now()}`,
            sourceImageId: imageId,
            blob: result.imageBlob,
            width,
            height,
            model,
            factor,
            creativity,
            resemblance,
            prompt,
            negativePrompt,
            sourceWidth: source.width,
            sourceHeight: source.height,
            createdAt: Date.now(),
          });
        } else {
          await saveUpscaleBlob({
            imageId,
            blob: result.imageBlob,
            width,
            height,
            model,
            factor,
            creativity,
            resemblance,
            prompt,
            negativePrompt,
            sourceWidth: source.width,
            sourceHeight: source.height,
            upscaledAt: Date.now(),
          });
        }
        setProcessedCount((c) => c + 1);
      } catch (err) {
        console.error(`[Upscale] Failed for ${imageId}:`, err);
        setErrorCount((c) => c + 1);
      }
    }

    setProcessing(false);
    setCurrentImageId(null);
    setStatus("");
  }, [selectedIds, processing, images, model, factor, creativity, resemblance, testMode, styleLibrary, falApiKey]);

  // ---------- Render ----------

  return (
    <div className="uv-container">
      {/* Settings bar */}
      <div className="uv-settings">
        <div className="uv-setting-group">
          <label className="uv-label">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as UpscaleModel)}
            className="uv-select"
          >
            <option value="clarity">Clarity (prompt+guide)</option>
            <option value="creative">Creative (prompt+detail)</option>
            <option value="topaz">Topaz CGI (no prompt)</option>
          </select>
        </div>

        <div className="uv-setting-group">
          <label className="uv-label">Scale</label>
          <select
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value) as 2 | 4)}
            className="uv-select"
          >
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        {model !== "topaz" && (
          <>
            <div className="uv-setting-group">
              <label className="uv-label">Creativity {creativity.toFixed(2)}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={creativity}
                onChange={(e) => setCreativity(Number(e.target.value))}
                className="uv-slider"
              />
            </div>
            <div className="uv-setting-group">
              <label className="uv-label">Resemblance {resemblance.toFixed(2)}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={resemblance}
                onChange={(e) => setResemblance(Number(e.target.value))}
                className="uv-slider"
              />
            </div>
          </>
        )}

        <div className="uv-setting-group">
          <label className="uv-label">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
            />
            {" "}Test mode
          </label>
        </div>
      </div>

      {/* Action bar */}
      <div className="uv-action-bar">
        <div className="uv-selection-controls">
          <button onClick={handleSelectAll} className="uv-btn uv-btn-sm">
            Select All
          </button>
          <button onClick={handleSelectNone} className="uv-btn uv-btn-sm">
            Select None
          </button>
          <span className="uv-selection-count">{selectedIds.size} selected</span>
        </div>
        <div className="uv-action-right">
          <span className="uv-cost-estimate">~${costEstimate}</span>
          <button
            onClick={handleRunUpscale}
            disabled={selectedIds.size === 0 || processing}
            className="uv-btn uv-btn-primary"
          >
            {processing
              ? status
              : `Upscale ${selectedIds.size} image${selectedIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="uv-progress">
          <div
            className="uv-progress-bar"
            style={{ width: `${(processedCount / selectedIds.size) * 100}%` }}
          />
          <span className="uv-progress-text">
            {processedCount}/{selectedIds.size}
            {errorCount > 0 ? ` (${errorCount} errors)` : ""}
          </span>
        </div>
      )}

      {/* Image grid */}
      <div className="uv-grid">
        {pageImages.map((img) => (
          <div
            key={img.imageId}
            className={`uv-card ${selectedIds.has(img.imageId) ? "uv-card-selected" : ""} ${currentImageId === img.imageId ? "uv-card-processing" : ""}`}
            onClick={() => toggleSelection(img.imageId)}
          >
            <div className="uv-card-thumb">
              <ImageThumb imageId={img.imageId} />
            </div>
            <div className="uv-card-info">
              <span
                className="uv-card-name"
                title={img.entityName || img.title || img.imageId}
              >
                {img.entityName || img.title || img.imageId.slice(0, 12)}
              </span>
              <span className="uv-card-dims">
                {img.width}x{img.height}
              </span>
              {img.hqWidth && (
                <span
                  className="uv-card-hq"
                  title={`HQ: ${img.hqWidth}x${img.hqHeight}`}
                >
                  HQ
                </span>
              )}
            </div>
            <button
              className="uv-card-preview"
              onClick={(e) => { e.stopPropagation(); handleOpenWorkspace(img.imageId); }}
              title="Preview"
            >
              &#8853;
            </button>
            <input
              type="checkbox"
              className="uv-card-check"
              checked={selectedIds.has(img.imageId)}
              onChange={() => toggleSelection(img.imageId)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="uv-pagination">
          <button className="uv-btn uv-btn-sm" onClick={() => setPage(0)} disabled={page === 0}>&laquo;</button>
          <button className="uv-btn uv-btn-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>&lsaquo;</button>
          <span className="uv-pagination-info">
            {page + 1} / {totalPages} ({images.length} images)
          </span>
          <button className="uv-btn uv-btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>&rsaquo;</button>
          <button className="uv-btn uv-btn-sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>&raquo;</button>
        </div>
      )}

      {/* Image workspace */}
      {workspaceImageId && (() => {
        const wsImg = images.find((im) => im.imageId === workspaceImageId);
        if (!wsImg) return null;
        return (
          <ImageWorkspace
            image={wsImg}
            onClose={handleCloseWorkspace}
          />
        );
      })()}
    </div>
  );
}
