/**
 * ImageWorkspace — Side panel for inspecting, comparing, editing, and managing
 * upscaled image versions.
 *
 * Modes:
 * - View: single image display with tier selector
 * - Compare: before/after comparison slider between any two tiers
 * - Edit: deterministic image adjustments (brightness, contrast, saturation,
 *   sharpen, warmth) with live CSS filter preview and canvas-based apply
 *
 * Loads original, production upscale, and test upscale blobs from IndexedDB.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ImageMetadataRecord } from "../../lib/preprint/prePrintStats";
import {
  getUpscaleBlobsForImage,
  getTestBlobsForImage,
  promoteTestBlob,
  saveUpscaleBlob,
} from "../../lib/db/upscaleRepository";
import { useStyleLibrary } from "../../hooks/useStyleLibrary";
import { db } from "../../lib/db/illuminatorDb";
import {
  type ImageAdjustments,
  DEFAULT_ADJUSTMENTS,
  isDefault,
  applyAdjustments,
  warmthMatrixValues,
  sharpenKernelValues,
} from "./imageAdjustments";
import "./ImageWorkspace.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TierSource =
  | { type: "original"; imageId: string }
  | { type: "upscale"; blobId: string }
  | { type: "test"; testId: string };

interface TierInfo {
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  source: TierSource;
}

interface TestBlobInfo {
  testId: string;
  width: number;
  height: number;
  model: string;
  factor: number;
  creativity: number;
}

interface ImageWorkspaceProps {
  image: ImageMetadataRecord;
  onClose: () => void;
}

type WorkspaceMode = "view" | "compare" | "edit";

// ---------------------------------------------------------------------------
// Blob loading helpers
// ---------------------------------------------------------------------------

async function loadBlobUrl(source: TierSource): Promise<string | null> {
  if (source.type === "original") {
    const record = await db.imageBlobs.get(source.imageId);
    return record?.blob ? URL.createObjectURL(record.blob) : null;
  }
  if (source.type === "upscale") {
    const record = await db.upscaleBlobs.get(source.blobId);
    return record?.blob ? URL.createObjectURL(record.blob) : null;
  }
  const record = await db.upscaleTestBlobs.get(source.testId);
  return record?.blob ? URL.createObjectURL(record.blob) : null;
}

async function loadBlob(source: TierSource): Promise<Blob | null> {
  if (source.type === "original") {
    const record = await db.imageBlobs.get(source.imageId);
    return record?.blob ?? null;
  }
  if (source.type === "upscale") {
    const record = await db.upscaleBlobs.get(source.blobId);
    return record?.blob ?? null;
  }
  const record = await db.upscaleTestBlobs.get(source.testId);
  return record?.blob ?? null;
}

// ---------------------------------------------------------------------------
// Comparison interaction hook — slider + zoom + pan
// ---------------------------------------------------------------------------

function useCompareInteraction(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [sliderPos, setSliderPos] = useState(50);
  const [zoom, setZoom] = useState(1); // 1 = fit-to-container
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const interaction = useRef<"none" | "slider" | "pan">("none");
  const panOrigin = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Near the divider? → slider drag. Otherwise → pan.
    const dividerScreenX = rect.left + (sliderPos / 100) * rect.width;
    if (Math.abs(e.clientX - dividerScreenX) < 12) {
      interaction.current = "slider";
    } else {
      interaction.current = "pan";
      panOrigin.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [containerRef, sliderPos, panX, panY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (interaction.current === "slider") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, pct)));
    } else if (interaction.current === "pan") {
      setPanX(panOrigin.current.px + (e.clientX - panOrigin.current.x));
      setPanY(panOrigin.current.py + (e.clientY - panOrigin.current.y));
    }
  }, [containerRef]);

  const onPointerUp = useCallback(() => {
    interaction.current = "none";
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // Native wheel listener (needs non-passive to preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const zoomRef = { zoom, panX, panY };
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.25, Math.min(20, zoomRef.zoom * factor));

      // Zoom toward cursor
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      setPanX(cx * (1 - factor) + zoomRef.panX * factor);
      setPanY(cy * (1 - factor) + zoomRef.panY * factor);
      setZoom(newZoom);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  // Re-subscribe when zoom/pan change so the closure has fresh values
  }, [containerRef, zoom, panX, panY]);

  return {
    sliderPos, zoom, panX, panY,
    onPointerDown, onPointerMove, onPointerUp,
    setZoom, setPanX, setPanY, resetView,
  };
}

// ---------------------------------------------------------------------------
// useTiers — load all available tiers for an image
// ---------------------------------------------------------------------------

function useTiers(image: ImageMetadataRecord) {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [testBlobs, setTestBlobs] = useState<TestBlobInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [upscales, tests] = await Promise.all([
      getUpscaleBlobsForImage(image.imageId),
      getTestBlobsForImage(image.imageId),
    ]);

    const tierList: TierInfo[] = [];

    for (const u of upscales) {
      tierList.push({
        label: `${u.width}\u00d7${u.height} (${u.factor}x ${u.model}, c=${u.creativity.toFixed(2)})`,
        shortLabel: `${u.width}\u00d7${u.height} HQ`,
        width: u.width,
        height: u.height,
        source: { type: "upscale", blobId: u.blobId },
      });
    }

    for (const t of tests) {
      tierList.push({
        label: `${t.width}\u00d7${t.height} test (${t.factor}x ${t.model}, c=${t.creativity.toFixed(2)})`,
        shortLabel: `${t.width}\u00d7${t.height} test`,
        width: t.width,
        height: t.height,
        source: { type: "test", testId: t.testId },
      });
    }

    tierList.push({
      label: `${image.width || 0}\u00d7${image.height || 0} (original)`,
      shortLabel: `${image.width || 0}\u00d7${image.height || 0} orig`,
      width: image.width || 0,
      height: image.height || 0,
      source: { type: "original", imageId: image.imageId },
    });

    setTiers(tierList);
    setTestBlobs(tests.map((t) => ({
      testId: t.testId,
      width: t.width,
      height: t.height,
      model: t.model,
      factor: t.factor,
      creativity: t.creativity,
    })));
    setLoading(false);
  }, [image.imageId, image.width, image.height]);

  useEffect(() => { reload(); }, [reload]);

  return { tiers, testBlobs, loading, reload };
}

// ---------------------------------------------------------------------------
// Info section sub-component
// ---------------------------------------------------------------------------

function WorkspaceInfo({ image, styleName, compName, paletteName }: Readonly<{
  image: ImageMetadataRecord;
  styleName: string;
  compName: string;
  paletteName: string;
}>) {
  const typeLabel = image.imageType === "cover" ? "Cover" : image.imageType === "scene" ? "Scene" : image.imageType === "entity" ? "Entity" : image.imageType ?? "—";
  return (
    <div className="iw-info">
      <div className="iw-info-row">
        <span className="iw-info-item" title="Entity">
          <span className="iw-info-dim">entity</span> {image.entityName || "—"}
        </span>
        {image.entityKind && (
          <span className="iw-info-item" title="Kind">
            <span className="iw-info-dim">kind</span> {image.entityKind}
          </span>
        )}
        <span className="iw-info-item" title="Image type">
          <span className="iw-info-dim">type</span> {typeLabel}
        </span>
      </div>
      <div className="iw-info-row">
        {image.chronicleId && (
          <span className="iw-info-item" title="Chronicle ID">
            <span className="iw-info-dim">chronicle</span> {image.chronicleId.slice(0, 12)}
          </span>
        )}
        {image.imageRefId && (
          <span className="iw-info-item" title="Image ref">
            <span className="iw-info-dim">ref</span> {image.imageRefId}
          </span>
        )}
        <span className="iw-info-item" title="Model">
          <span className="iw-info-dim">model</span> {image.model}
        </span>
        <span className="iw-info-item" title="Dimensions">
          <span className="iw-info-dim">size</span> {image.width}&times;{image.height}
        </span>
      </div>
      <div className="iw-info-row">
        <span className="iw-info-item" title="Artistic style">
          <span className="iw-info-dim">style</span> {styleName}
        </span>
        <span className="iw-info-item" title="Composition">
          <span className="iw-info-dim">comp</span> {compName}
        </span>
        <span className="iw-info-item" title="Palette">
          <span className="iw-info-dim">palette</span> {paletteName}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation modal sub-component
// ---------------------------------------------------------------------------

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: Readonly<{
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <div className="iw-modal-overlay" onClick={onCancel}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- modal dialog; Escape handled by parent */}
      <div className="iw-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="iw-modal-title">{title}</div>
        <div className="iw-modal-message">{message}</div>
        <div className="iw-modal-actions">
          <button className="iw-btn iw-btn-sm" onClick={onCancel}>Cancel</button>
          <button className="iw-btn iw-btn-primary iw-btn-sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG filter definitions for live warmth/sharpen preview
// ---------------------------------------------------------------------------

function AdjustmentFilters({ adjustments }: Readonly<{ adjustments: ImageAdjustments }>) {
  return (
    // eslint-disable-next-line local/no-inline-styles -- hidden SVG container for filter definitions
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {adjustments.warmth !== 0 && (
          <filter id="iw-warmth" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={warmthMatrixValues(adjustments.warmth)} />
          </filter>
        )}
        {adjustments.sharpen > 0 && (
          <filter id="iw-sharpen" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order={3}
              kernelMatrix={sharpenKernelValues(adjustments.sharpen)}
              divisor={1}
              preserveAlpha="true"
            />
          </filter>
        )}
      </defs>
    </svg>
  );
}

/** Build the full CSS filter string including SVG filter references for warmth/sharpen. */
function buildPreviewFilter(adj: ImageAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 1) parts.push(`brightness(${adj.brightness})`);
  if (adj.contrast !== 1) parts.push(`contrast(${adj.contrast})`);
  if (adj.saturation !== 1) parts.push(`saturate(${adj.saturation})`);
  if (adj.warmth !== 0) parts.push("url(#iw-warmth)");
  if (adj.sharpen > 0) parts.push("url(#iw-sharpen)");
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ---------------------------------------------------------------------------
// Edit controls sub-component
// ---------------------------------------------------------------------------

interface AdjustmentSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (v: number) => void;
}

function AdjustmentSlider({ label, value, min, max, step, defaultValue, onChange }: Readonly<AdjustmentSliderProps>) {
  const display = Number.isInteger(step) ? String(value) : value.toFixed(2);
  return (
    <div className="iw-adj-slider">
      <div className="iw-adj-slider-header">
        <span className="iw-adj-slider-label">{label}</span>
        <span className="iw-adj-slider-value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="iw-adj-range"
      />
      {value !== defaultValue && (
        <button
          className="iw-adj-reset-one"
          onClick={() => onChange(defaultValue)}
          title={`Reset to ${defaultValue}`}
        >
          &times;
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageWorkspace component
// ---------------------------------------------------------------------------

export default function ImageWorkspace({
  image, onClose,
}: Readonly<ImageWorkspaceProps>) {
  const { styleLibrary } = useStyleLibrary();
  const { tiers, testBlobs, reload } = useTiers(image);

  // Resolve style names
  const styleName = styleLibrary?.artisticStyles.find((s) => s.id === image.artisticStyleId)?.name ?? image.artisticStyleId ?? "—";
  const compName = styleLibrary?.compositionStyles.find((s) => s.id === image.compositionStyleId)?.name ?? image.compositionStyleId ?? "—";
  const paletteName = image.colorPaletteId ?? "—";

  // Mode
  const [mode, setMode] = useState<WorkspaceMode>("view");

  // View mode state
  const [viewTierIdx, setViewTierIdx] = useState(0);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  // Compare mode state
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(0);
  const [leftUrl, setLeftUrl] = useState<string | null>(null);
  const [rightUrl, setRightUrl] = useState<string | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const {
    sliderPos, zoom, panX, panY,
    onPointerDown, onPointerMove, onPointerUp,
    setZoom, setPanX, setPanY, resetView,
  } = useCompareInteraction(compareRef);

  // Track container size for zoom calculations
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = compareRef.current;
    if (!el || mode !== "compare") return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Edit mode state
  const [editTierIdx, setEditTierIdx] = useState(0);
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"overwrite" | "save-as-new" | null>(null);

  // Has upscale versions?
  const hasUpscales = tiers.length > 1;

  // Auto-switch to compare when upscales exist
  useEffect(() => {
    if (hasUpscales && tiers.length >= 2) {
      setMode("compare");
      setLeftIdx(0);
      setRightIdx(tiers.length - 1);
    }
  }, [hasUpscales, tiers.length]);

  // Load view URL
  useEffect(() => {
    if (mode !== "view") return;
    const tier = tiers[viewTierIdx];
    if (!tier) return;
    let revoked = false;
    loadBlobUrl(tier.source).then((url) => {
      if (!revoked) {
        setViewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    return () => { revoked = true; };
  }, [mode, tiers, viewTierIdx]);

  // Load compare left URL
  useEffect(() => {
    if (mode !== "compare") return;
    const tier = tiers[leftIdx];
    if (!tier) return;
    let revoked = false;
    loadBlobUrl(tier.source).then((url) => {
      if (!revoked) {
        setLeftUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    return () => { revoked = true; };
  }, [mode, tiers, leftIdx]);

  // Load compare right URL
  useEffect(() => {
    if (mode !== "compare") return;
    const tier = tiers[rightIdx];
    if (!tier) return;
    let revoked = false;
    loadBlobUrl(tier.source).then((url) => {
      if (!revoked) {
        setRightUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    return () => { revoked = true; };
  }, [mode, tiers, rightIdx]);

  // Load edit URL
  useEffect(() => {
    if (mode !== "edit") return;
    const tier = tiers[editTierIdx];
    if (!tier) return;
    let revoked = false;
    loadBlobUrl(tier.source).then((url) => {
      if (!revoked) {
        setEditUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    return () => { revoked = true; };
  }, [mode, tiers, editTierIdx]);

  // Cleanup all URLs on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup refs at unmount
      [viewUrl, leftUrl, rightUrl, editUrl].forEach((u) => { if (u) URL.revokeObjectURL(u); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only on unmount
  }, []);

  const handlePromote = useCallback(async (testId: string) => {
    await promoteTestBlob(testId);
    reload();
  }, [reload]);

  const handleClose = useCallback(() => {
    [viewUrl, leftUrl, rightUrl, editUrl].forEach((u) => { if (u) URL.revokeObjectURL(u); });
    onClose();
  }, [viewUrl, leftUrl, rightUrl, editUrl, onClose]);

  // --- Edit handlers ---

  const updateAdj = useCallback(<K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetAdj = useCallback(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  }, []);

  const handleConfirmedSave = useCallback(async (overwrite: boolean) => {
    const tier = tiers[editTierIdx];
    if (!tier || isDefault(adjustments)) return;

    setSaving(true);
    setConfirmAction(null);
    try {
      const sourceBlob = await loadBlob(tier.source);
      if (!sourceBlob) return;

      const resultBlob = await applyAdjustments(sourceBlob, adjustments);

      if (overwrite) {
        switch (tier.source.type) {
          case "original":
            await db.imageBlobs.put({ imageId: tier.source.imageId, blob: resultBlob });
            break;
          case "upscale":
            await db.upscaleBlobs.update(tier.source.blobId, { blob: resultBlob });
            break;
          case "test":
            await db.upscaleTestBlobs.update(tier.source.testId, { blob: resultBlob });
            break;
        }
      } else {
        await saveUpscaleBlob({
          imageId: image.imageId,
          blob: resultBlob,
          width: tier.width,
          height: tier.height,
          model: "edited",
          factor: 1,
          creativity: 0,
          resemblance: 1,
          prompt: "",
          negativePrompt: "",
          sourceWidth: tier.width,
          sourceHeight: tier.height,
          upscaledAt: Date.now(),
        });
      }

      setAdjustments(DEFAULT_ADJUSTMENTS);
      reload();
    } finally {
      setSaving(false);
    }
  }, [tiers, editTierIdx, adjustments, image.imageId, reload]);

  const previewFilter = buildPreviewFilter(adjustments);
  const adjDirty = !isDefault(adjustments);

  return (
    <div className="iw-panel">
      {/* Header */}
      <div className="iw-header">
        <span className="iw-title" title={image.entityName || image.title || image.imageId}>
          {image.entityName || image.title || image.imageId.slice(0, 12)}
        </span>
        <div className="iw-mode-toggle">
          <button
            className={`iw-mode-btn ${mode === "view" ? "iw-mode-btn-active" : ""}`}
            onClick={() => setMode("view")}
          >
            View
          </button>
          {hasUpscales && (
            <button
              className={`iw-mode-btn ${mode === "compare" ? "iw-mode-btn-active" : ""}`}
              onClick={() => setMode("compare")}
            >
              Compare
            </button>
          )}
          <button
            className={`iw-mode-btn ${mode === "edit" ? "iw-mode-btn-active" : ""}`}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
        </div>
        <button onClick={handleClose} className="iw-btn iw-btn-sm">&times;</button>
      </div>

      {/* Info section */}
      <WorkspaceInfo image={image} styleName={styleName} compName={compName} paletteName={paletteName} />

      {/* Toolbar — tier selectors */}
      {mode === "view" && tiers.length > 1 && (
        <div className="iw-toolbar">
          <select
            value={viewTierIdx}
            onChange={(e) => setViewTierIdx(Number(e.target.value))}
            className="iw-select"
          >
            {tiers.map((tier, i) => (
              <option key={tier.source.type === "original" ? "orig" : tier.source.type === "upscale" ? tier.source.blobId : tier.source.testId} value={i}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "compare" && (() => {
        const refW = Math.max(tiers[leftIdx]?.width || 1, tiers[rightIdx]?.width || 1);
        const refH = Math.max(tiers[leftIdx]?.height || 1, tiers[rightIdx]?.height || 1);
        const fitScale = containerSize
          ? Math.min(containerSize.w / refW, containerSize.h / refH)
          : 1;
        const zoomPct = Math.round(fitScale * zoom * 100);
        return (
          <div className="iw-toolbar">
            <span className="iw-toolbar-label">Left</span>
            <select value={leftIdx} onChange={(e) => setLeftIdx(Number(e.target.value))} className="iw-select">
              {tiers.map((tier, i) => <option key={`l-${i}`} value={i}>{tier.label}</option>)}
            </select>
            <span className="iw-toolbar-label">Right</span>
            <select value={rightIdx} onChange={(e) => setRightIdx(Number(e.target.value))} className="iw-select">
              {tiers.map((tier, i) => <option key={`r-${i}`} value={i}>{tier.label}</option>)}
            </select>
            <span className="iw-toolbar-spacer" />
            <span className="iw-toolbar-label">{zoomPct}%</span>
            <button className="iw-btn iw-btn-sm" onClick={resetView}>Fit</button>
            <button className="iw-btn iw-btn-sm" onClick={() => { setZoom(1 / fitScale); setPanX(0); setPanY(0); }}>100%</button>
            <button className="iw-btn iw-btn-sm" onClick={() => { setZoom(2 / fitScale); setPanX(0); setPanY(0); }}>200%</button>
          </div>
        );
      })()}

      {mode === "edit" && (
        <div className="iw-toolbar">
          <span className="iw-toolbar-label">Editing</span>
          <select value={editTierIdx} onChange={(e) => setEditTierIdx(Number(e.target.value))} className="iw-select">
            {tiers.map((tier, i) => <option key={`e-${i}`} value={i}>{tier.label}</option>)}
          </select>
        </div>
      )}

      {/* View mode */}
      {mode === "view" && (
        <div className="iw-view">
          {viewUrl && <img src={viewUrl} alt={image.title || ""} className="iw-view-img" />}
        </div>
      )}

      {/* Compare mode — slider with zoom/pan */}
      {mode === "compare" && (() => {
        const refW = Math.max(tiers[leftIdx]?.width || 1, tiers[rightIdx]?.width || 1);
        const refH = Math.max(tiers[leftIdx]?.height || 1, tiers[rightIdx]?.height || 1);
        const fitScale = containerSize
          ? Math.min(containerSize.w / refW, containerSize.h / refH)
          : 1;
        const displayScale = fitScale * zoom;
        const imgW = refW * displayScale;
        const imgH = refH * displayScale;
        // eslint-disable-next-line local/no-inline-styles -- zoom/pan/slider require runtime values
        const imgStyle: React.CSSProperties = {
          width: imgW,
          height: imgH,
          maxWidth: "none",
          maxHeight: "none",
          transform: `translate(${panX}px, ${panY}px)`,
        };
        return (
          <div
            className="iw-compare"
            ref={compareRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            // eslint-disable-next-line local/no-inline-styles -- slider position requires runtime CSS variable
            style={{ "--iw-split": `${sliderPos}%` } as React.CSSProperties}
          >
            <div className="iw-compare-layer">
              {rightUrl && <img src={rightUrl} alt="Right" draggable={false} style={imgStyle} />}
            </div>
            <div className="iw-compare-layer iw-compare-left">
              {leftUrl && <img src={leftUrl} alt="Left" draggable={false} style={imgStyle} />}
            </div>
            {/* eslint-disable-next-line local/no-inline-styles -- slider position requires runtime value */}
            <div className="iw-compare-divider" style={{ left: `${sliderPos}%` }} />
            <span className="iw-compare-label iw-compare-label-left">{tiers[leftIdx]?.shortLabel}</span>
            <span className="iw-compare-label iw-compare-label-right">{tiers[rightIdx]?.shortLabel}</span>
          </div>
        );
      })()}

      {/* Edit mode — image with live filter preview (CSS + SVG filters) */}
      {mode === "edit" && (
        <>
          <AdjustmentFilters adjustments={adjustments} />
          <div className="iw-view">
            {editUrl && (
              <img
                src={editUrl}
                alt={image.title || ""}
                className="iw-view-img"
                // eslint-disable-next-line local/no-inline-styles -- live adjustment preview requires runtime filter value
                style={previewFilter !== "none" ? { filter: previewFilter } : undefined}
              />
            )}
          </div>
        </>
      )}

      {/* Edit controls */}
      {mode === "edit" && (
        <div className="iw-edit-controls">
          <AdjustmentSlider
            label="Brightness"
            value={adjustments.brightness}
            min={0.5} max={1.5} step={0.01} defaultValue={1}
            onChange={(v) => updateAdj("brightness", v)}
          />
          <AdjustmentSlider
            label="Contrast"
            value={adjustments.contrast}
            min={0.5} max={2} step={0.01} defaultValue={1}
            onChange={(v) => updateAdj("contrast", v)}
          />
          <AdjustmentSlider
            label="Saturation"
            value={adjustments.saturation}
            min={0} max={3} step={0.01} defaultValue={1}
            onChange={(v) => updateAdj("saturation", v)}
          />
          <AdjustmentSlider
            label="Sharpen"
            value={adjustments.sharpen}
            min={0} max={100} step={1} defaultValue={0}
            onChange={(v) => updateAdj("sharpen", v)}
          />
          <AdjustmentSlider
            label="Warmth"
            value={adjustments.warmth}
            min={-50} max={50} step={1} defaultValue={0}
            onChange={(v) => updateAdj("warmth", v)}
          />
          <div className="iw-edit-actions">
            <button className="iw-btn iw-btn-sm" onClick={handleResetAdj} disabled={!adjDirty}>Reset</button>
            <button
              className="iw-btn iw-btn-sm"
              onClick={() => setConfirmAction("overwrite")}
              disabled={!adjDirty || saving}
              title="Apply adjustments and overwrite the selected version"
            >
              {saving ? "Saving..." : "Overwrite"}
            </button>
            <button
              className="iw-btn iw-btn-primary iw-btn-sm"
              onClick={() => setConfirmAction("save-as-new")}
              disabled={!adjDirty || saving}
              title="Apply adjustments and save as a new version (preserves original)"
            >
              {saving ? "Saving..." : "Save as new"}
            </button>
          </div>
        </div>
      )}

      {/* Test blobs strip */}
      {testBlobs.length > 0 && (
        <div className="iw-test-strip">
          <span className="iw-test-label">Test results:</span>
          {testBlobs.map((t) => (
            <div key={t.testId} className="iw-test-item">
              <span className="iw-test-info">
                {t.width}&times;{t.height} {t.model} {t.factor}x c={t.creativity.toFixed(2)}
              </span>
              <button
                onClick={() => handlePromote(t.testId)}
                className="iw-btn iw-btn-sm"
                title="Promote to HQ"
              >
                Promote
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmAction === "overwrite" && (
        <ConfirmModal
          title="Overwrite image?"
          message={`This will permanently replace the ${tiers[editTierIdx]?.shortLabel || "selected"} blob with the adjusted version. This cannot be undone.`}
          confirmLabel="Overwrite"
          onConfirm={() => handleConfirmedSave(true)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "save-as-new" && (
        <ConfirmModal
          title="Save as new version?"
          message={`This will render the adjustments and save as a new ${tiers[editTierIdx]?.width || 0}\u00d7${tiers[editTierIdx]?.height || 0} version. The original source is preserved.`}
          confirmLabel="Save"
          onConfirm={() => handleConfirmedSave(false)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
