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

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor";
import { useImageUrl } from "@the-canonry/image-store";
import ImageModal from "./ImageModal";
import ChronicleImagePicker from "./ChronicleImagePicker";
import { resolveStyleSelection } from "./StyleSelector";
import { ImageSettingsSummary } from "./ImageSettingsDrawer";
import { buildChronicleScenePrompt } from "../lib/promptBuilders";
import { ErrorMessage } from "@the-canonry/shared-components";
// imageSettings import removed - controls now in ImageSettingsDrawer
import type { ChronicleImageRefs, EntityImageRef, PromptRequestRef } from "../lib/chronicleTypes";
import type { StyleInfo } from "../lib/promptBuilders";
import "./ChronicleImagePanel.css";

interface EntityContext {
  id: string;
  name: string;
  kind: string;
  culture?: string;
  enrichment?: {
    image?: {
      imageId: string;
    };
    text?: {
      visualThesis?: string;
      visualTraits?: string[];
    };
  };
}

interface Culture {
  id: string;
  name: string;
  styleKeywords?: string[];
}

interface StyleLibrary {
  artisticStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
  }>;
  compositionStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    suitableForKinds?: string[];
  }>;
  colorPalettes: Array<{ id: string; name: string; description?: string; promptFragment?: string }>;
}

interface WorldContext {
  name?: string;
  description?: string;
  toneFragments?: { core: string };
}

interface CultureIdentities {
  visual?: Record<string, Record<string, string>>;
  descriptive?: Record<string, Record<string, string>>;
  visualKeysByKind?: Record<string, string[]>;
  descriptiveKeysByKind?: Record<string, string[]>;
}

interface ChronicleImagePanelProps {
  imageRefs: ChronicleImageRefs | null;
  entities: Map<string, EntityContext>;
  /** Callback to generate an image - receives the ref and the built prompt */
  onGenerateImage?: (ref: PromptRequestRef, prompt: string, styleInfo: StyleInfo) => void;
  /** Callback to reset a failed image ref back to pending */
  onResetImage?: (ref: PromptRequestRef) => void;
  /** Callback to regenerate a single scene description via LLM */
  onRegenerateDescription?: (ref: PromptRequestRef) => void;
  /** Callback to update anchor text for a ref */
  onUpdateAnchorText?: (ref: EntityImageRef | PromptRequestRef, anchorText: string) => void;
  /** Callback to update size for a ref */
  onUpdateSize?: (
    ref: EntityImageRef | PromptRequestRef,
    size: ChronicleImageRefs["refs"][number]["size"]
  ) => void;
  /** Callback to update justification for a ref */
  onUpdateJustification?: (
    ref: EntityImageRef | PromptRequestRef,
    justification: "left" | "right"
  ) => void;
  /** Callback to select an existing image for a ref */
  onSelectExistingImage?: (ref: PromptRequestRef, imageId: string) => void;
  /** Project ID for image picker filtering */
  projectId?: string;
  /** Chronicle ID for image picker filtering */
  chronicleId?: string;
  /** Full chronicle text for anchor validation */
  chronicleText?: string;
  isGenerating?: boolean;
  /** Style library for style selection */
  styleLibrary?: StyleLibrary;
  /** Current style selection from parent */
  styleSelection?: {
    artisticStyleId?: string;
    compositionStyleId?: string;
    colorPaletteId?: string;
  };
  /** Available cultures for visual identity */
  cultures?: Culture[];
  /** Culture identities containing visual identity data */
  cultureIdentities?: CultureIdentities;
  /** World context for prompt building */
  worldContext?: WorldContext;
  /** Chronicle title for prompt context */
  chronicleTitle?: string;
  /** Image size for generation */
  imageSize?: string;
  /** Image quality for generation */
  imageQuality?: string;
  /** Image model (for quality option lookup) */
  imageModel?: string;
  /** Global image generation settings (for summary display) */
  imageGenSettings?: import("../hooks/useImageGenSettings").ImageGenSettings;
  /** Callback to open the image settings drawer */
  onOpenImageSettings?: () => void;
}

// Size display names
const SIZE_LABELS: Record<string, string> = {
  small: "Small (150px)",
  medium: "Medium (300px)",
  large: "Large (450px)",
  "full-width": "Full Width",
};

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "rgba(245, 158, 11, 0.2)", text: "#f59e0b" },
  generating: { bg: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" },
  complete: { bg: "rgba(16, 185, 129, 0.2)", text: "#10b981" },
  failed: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
};

// Default entity kind for visual identity filtering (general scene images)
const DEFAULT_VISUAL_IDENTITY_KIND = "scene";
const JUSTIFY_SIZES = new Set(["small", "medium", "large"]);

function useLazyImageUrl(imageId: string | null | undefined) {
  // If IntersectionObserver is unavailable, default to visible
  const noIO = typeof IntersectionObserver === "undefined";
  const [isVisible, setIsVisible] = useState(noIO);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  const { url, loading, error, metadata } = useImageUrl(isVisible ? imageId : null);

  return { containerRef, url, loading, error, metadata, isVisible };
}

function AnchorContextTooltip({
  anchorText,
  anchorIndex,
  chronicleText,
  children,
}: Readonly<{
  anchorText: string;
  anchorIndex?: number;
  chronicleText?: string;
  children: React.ReactNode;
}>) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Compute context snippet (may be null if no chronicle text or anchor not found)
  const snippet = useMemo(() => {
    if (!chronicleText) return null;
    const idx =
      anchorIndex != null && anchorIndex >= 0 ? anchorIndex : chronicleText.indexOf(anchorText);
    if (idx < 0) return null;

    const CONTEXT_CHARS = 300;
    const start = Math.max(0, idx - CONTEXT_CHARS);
    const end = Math.min(chronicleText.length, idx + anchorText.length + CONTEXT_CHARS);
    return {
      before: chronicleText.substring(start, idx),
      match: chronicleText.substring(idx, idx + anchorText.length),
      after: chronicleText.substring(idx + anchorText.length, end),
      hasPrefix: start > 0,
      hasSuffix: end < chronicleText.length,
    };
  }, [chronicleText, anchorText, anchorIndex]);

  if (!snippet) return <>{children}</>;

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left, y: rect.bottom + 4 });
    }
    setShowTooltip(true);
  };

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
      className="cip-tooltip-trigger"
    >
      {children}
      {showTooltip &&
        createPortal(
          <div
            className="cip-tooltip"
            style={{
              left: Math.min(tooltipPos.x, window.innerWidth - 420),
              top: tooltipPos.y,
            }}
          >
            {snippet.hasPrefix && "..."}
            {snippet.before}
            <mark className="cip-tooltip-highlight">
              {snippet.match}
            </mark>
            {snippet.after}
            {snippet.hasSuffix && "..."}
          </div>,
          document.body
        )}
    </span>
  );
}

function AnchorTextEditor({
  anchorText,
  onSave,
  disabled = false,
  previewLength = 40,
  anchorIndex,
  chronicleText,
}: Readonly<{
  anchorText: string;
  onSave?: (next: string) => void;
  disabled?: boolean;
  previewLength?: number;
  anchorIndex?: number;
  chronicleText?: string;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(anchorText);

  // Sync draft when anchorText changes externally and editor is closed
  useEffect(() => {
    if (isEditing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft with external anchor text when not editing
    setDraft(anchorText);
  }, [anchorText, isEditing]);

  const preview =
    anchorText.length > previewLength ? `${anchorText.slice(0, previewLength)}...` : anchorText;

  const anchorLabel = (
    <AnchorContextTooltip
      anchorText={anchorText}
      anchorIndex={anchorIndex}
      chronicleText={chronicleText}
    >
      <span className="cip-anchor-underline">
        &quot;{preview}&quot;
      </span>
    </AnchorContextTooltip>
  );

  if (!onSave) {
    return (
      <div className="cip-anchor-info">
        Anchor: {anchorLabel}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="cip-anchor-row">
        <span className="cip-anchor-label">
          Anchor: {anchorLabel}
        </span>
        <button
          type="button"
          className="illuminator-button-small"
          onClick={() => setIsEditing(true)}
          disabled={disabled}
        >
          Edit
        </button>
      </div>
    );
  }

  const handleSave = () => {
    const next = draft.trim();
    if (!next) return;
    if (next !== anchorText) {
      onSave(next);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(anchorText);
    setIsEditing(false);
  };

  return (
    <div className="cip-anchor-row">
      <span className="cip-anchor-edit-label">Anchor:</span>
      <input
        className="illuminator-input cip-anchor-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className="illuminator-button-small"
        onClick={handleSave}
        disabled={disabled || !draft.trim()}
      >
        Save
      </button>
      <button
        type="button"
        className="illuminator-button-small"
        onClick={handleCancel}
        disabled={disabled}
      >
        Cancel
      </button>
    </div>
  );
}

function EntityImageRefCard({
  imageRef,
  entity,
  onImageClick,
  onUpdateAnchorText,
  onUpdateSize,
  onUpdateJustification,
  chronicleText,
  isGenerating,
}: Readonly<{
  imageRef: EntityImageRef;
  entity: EntityContext | undefined;
  onImageClick?: (imageId: string, title: string) => void;
  onUpdateAnchorText?: (next: string) => void;
  onUpdateSize?: (size: EntityImageRef["size"]) => void;
  onUpdateJustification?: (justification: "left" | "right") => void;
  chronicleText?: string;
  isGenerating?: boolean;
}>) {
  const imageId = entity?.enrichment?.image?.imageId;
  const { containerRef, url, loading, isVisible } = useLazyImageUrl(imageId);
  const hasImage = Boolean(imageId);
  const isJustifiable = JUSTIFY_SIZES.has(imageRef.size);
  const anchorMissing = Boolean(
    chronicleText && imageRef.anchorText && !resolveAnchorPhrase(imageRef.anchorText, chronicleText)
  );
  const deferThumbnail = hasImage && !isVisible;

  return (
    <div className="cip-ref-card">
      {/* Thumbnail */}
      <div
        ref={containerRef}
        className="cip-thumbnail"
      >
        {loading && (
          <span className="cip-thumbnail-loading">...</span>
        )}
        {!loading && url && (
          <img
            src={url}
            alt={entity?.name || "Entity image"}
            loading="lazy"
            onClick={
              imageId && onImageClick
                ? () => onImageClick(imageId, entity?.name || "Entity image")
                : undefined
            }
            className="cip-thumbnail-img"
            style={{
              cursor: imageId && onImageClick ? "pointer" : undefined,
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          />
        )}
        {!loading && !url && (
          <span className="cip-thumbnail-placeholder">
            {(() => {
              if (deferThumbnail) return "...";
              if (hasImage) return "?";
              return "\u2014";
            })()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="cip-info">
        <div className="cip-badge-row">
          <span className="cip-entity-ref-badge">
            Entity Ref
          </span>
          <span className="cip-size-badge">
            {SIZE_LABELS[imageRef.size] || imageRef.size}
          </span>
        </div>

        <div className="cip-entity-name">
          {entity?.name || imageRef.entityId}
        </div>

        {entity?.kind && (
          <div className="cip-entity-meta">
            {entity.kind}
            {entity.culture && entity.culture !== "universal" && ` • ${entity.culture}`}
          </div>
        )}

        <AnchorTextEditor
          anchorText={imageRef.anchorText}
          onSave={onUpdateAnchorText}
          disabled={isGenerating}
          anchorIndex={imageRef.anchorIndex}
          chronicleText={chronicleText}
        />
        {anchorMissing && (
          <div className="cip-anchor-missing">
            Anchor text not found in chronicle
          </div>
        )}

        {onUpdateSize && (
          <div className="cip-size-controls">
            <span className="cip-size-label">Size:</span>
            <select
              className="illuminator-select cip-size-select"
              value={imageRef.size}
              onChange={(e) => onUpdateSize(e.target.value as EntityImageRef["size"])}
              disabled={isGenerating}
            >
              {Object.entries(SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isJustifiable && onUpdateJustification && (
              <>
                <span className="cip-size-label">Justify:</span>
                <select
                  className="illuminator-select cip-justify-select"
                  value={imageRef.justification || "left"}
                  onChange={(e) => onUpdateJustification(e.target.value as "left" | "right")}
                  disabled={isGenerating}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </>
            )}
          </div>
        )}

        {imageRef.caption && (
          <div className="cip-caption">
            Caption: {imageRef.caption}
          </div>
        )}

        {!hasImage && (
          <div className="cip-no-image-warning">
            Entity has no image
          </div>
        )}
      </div>
    </div>
  );
}

function PromptRequestCard({
  imageRef,
  onGenerate,
  onReset,
  onRegenerateDescription,
  onSelectExisting,
  onImageClick,
  onUpdateAnchorText,
  onUpdateSize,
  onUpdateJustification,
  chronicleText,
  isGenerating,
  entities,
}: Readonly<{
  imageRef: PromptRequestRef;
  onGenerate?: () => void;
  onReset?: () => void;
  onRegenerateDescription?: () => void;
  onSelectExisting?: () => void;
  onImageClick?: (imageId: string, title: string) => void;
  onUpdateAnchorText?: (next: string) => void;
  onUpdateSize?: (size: PromptRequestRef["size"]) => void;
  onUpdateJustification?: (justification: "left" | "right") => void;
  chronicleText?: string;
  isGenerating?: boolean;
  entities?: Map<string, EntityContext>;
}>) {
  const { containerRef, url, loading, isVisible } = useLazyImageUrl(imageRef.generatedImageId);
  const statusColor = STATUS_COLORS[imageRef.status] || STATUS_COLORS.pending;
  const canGenerate = imageRef.status === "pending" && !isGenerating;
  const canRegenerate = imageRef.status === "complete" && !isGenerating;
  const canReset = imageRef.status === "failed" && !isGenerating;
  const isJustifiable = JUSTIFY_SIZES.has(imageRef.size);
  const anchorMissing = Boolean(
    chronicleText && imageRef.anchorText && !resolveAnchorPhrase(imageRef.anchorText, chronicleText)
  );
  const deferThumbnail = Boolean(imageRef.generatedImageId) && !isVisible;

  // Resolve involved entity names
  const involvedEntityNames = imageRef.involvedEntityIds
    ?.map((id) => entities?.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="cip-ref-card">
      {/* Thumbnail/Placeholder */}
      <div
        ref={containerRef}
        className="cip-thumbnail"
      >
        {loading && (
          <span className="cip-thumbnail-loading">...</span>
        )}
        {!loading && url && (
          <img
            src={url}
            alt="Generated"
            loading="lazy"
            onClick={
              imageRef.generatedImageId && onImageClick
                ? () =>
                    onImageClick(imageRef.generatedImageId, imageRef.sceneDescription.slice(0, 60))
                : undefined
            }
            className="cip-thumbnail-img"
            style={{
              cursor: imageRef.generatedImageId && onImageClick ? "pointer" : undefined,
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          />
        )}
        {!loading && !url && (
          <span className="cip-thumbnail-placeholder">
            {deferThumbnail || imageRef.status === "generating" ? "..." : "\uD83D\uDDBC\uFE0F"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="cip-info">
        <div className="cip-badge-row">
          <span className="cip-scene-badge">
            Scene Image
          </span>
          <span
            className="cip-status-badge"
            style={{
              background: statusColor.bg,
              color: statusColor.text,
            }}
          >
            {imageRef.status}
          </span>
          <span className="cip-size-badge">
            {SIZE_LABELS[imageRef.size] || imageRef.size}
          </span>
        </div>

        <div className="cip-scene-description">
          {imageRef.sceneDescription}
        </div>

        {onRegenerateDescription && !isGenerating && (
          <button
            onClick={onRegenerateDescription}
            className="cip-regen-desc-btn"
          >
            Regenerate Description
          </button>
        )}

        <AnchorTextEditor
          anchorText={imageRef.anchorText}
          onSave={onUpdateAnchorText}
          disabled={isGenerating}
          anchorIndex={imageRef.anchorIndex}
          chronicleText={chronicleText}
        />
        {anchorMissing && (
          <div className="cip-anchor-missing">
            Anchor text not found in chronicle
          </div>
        )}

        {onUpdateSize && (
          <div className="cip-size-controls">
            <span className="cip-size-label">Size:</span>
            <select
              className="illuminator-select cip-size-select"
              value={imageRef.size}
              onChange={(e) => onUpdateSize(e.target.value as PromptRequestRef["size"])}
              disabled={isGenerating}
            >
              {Object.entries(SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isJustifiable && onUpdateJustification && (
              <>
                <span className="cip-size-label">Justify:</span>
                <select
                  className="illuminator-select cip-justify-select"
                  value={imageRef.justification || "left"}
                  onChange={(e) => onUpdateJustification(e.target.value as "left" | "right")}
                  disabled={isGenerating}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </>
            )}
          </div>
        )}

        {involvedEntityNames && involvedEntityNames.length > 0 && (
          <div className="cip-involved-entities">
            <span className="cip-involved-label">Figures:</span>
            {involvedEntityNames.map((name, i) => (
              <span key={i} className="cip-involved-name">
                {name}
              </span>
            ))}
          </div>
        )}

        {imageRef.caption && (
          <div className="cip-caption">
            Caption: {imageRef.caption}
          </div>
        )}

        {imageRef.error && (
          <ErrorMessage message={imageRef.error} className="cip-error-message" />
        )}

        <div className="cip-action-row">
          {canGenerate && onGenerate && (
            <button onClick={onGenerate} className="cip-generate-btn">
              Generate Image
            </button>
          )}
          {canRegenerate && onGenerate && (
            <button onClick={onGenerate} className="cip-generate-btn">
              Regenerate Image
            </button>
          )}
          {onSelectExisting && !isGenerating && (
            <button onClick={onSelectExisting} className="cip-secondary-btn">
              Select Existing
            </button>
          )}
        </div>
        {canReset && onReset && (
          <button onClick={onReset} className="cip-reset-btn">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

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
  imageModel: _imageModel,
  imageGenSettings,
  onOpenImageSettings,
}: Readonly<ChronicleImagePanelProps>) {
  // Use external style selection directly (managed globally by ImageSettingsDrawer)
  const styleSelection = externalStyleSelection || {
    artisticStyleId: "random",
    compositionStyleId: "random",
    colorPaletteId: "random",
  };

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
    };
  }, [styleSelection, derivedCultureId, cultures, styleLibrary, cultureIdentities]);

  // Handle generating a single image
  const handleGenerateImage = useCallback(
    (ref: PromptRequestRef) => {
      if (!onGenerateImage) return;

      const styleInfo = buildStyleInfo();

      const prompt = buildChronicleScenePrompt(
        {
          sceneDescription: ref.sceneDescription,
          size: ref.size,
          chronicleTitle,
          world: worldContext
            ? {
                name: worldContext.name || "Unknown World",
                description: worldContext.description,
                speciesConstraint: worldContext.speciesConstraint,
              }
            : undefined,
        },
        styleInfo
      );

      onGenerateImage(ref, prompt, styleInfo);
    },
    [onGenerateImage, buildStyleInfo, chronicleTitle, worldContext]
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
                onReset={onResetImage ? () => onResetImage(ref) : undefined}
                onRegenerateDescription={
                  onRegenerateDescription ? () => onRegenerateDescription(ref) : undefined
                }
                onSelectExisting={
                  onSelectExistingImage && projectId ? () => handleOpenPicker(ref) : undefined
                }
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
                entities={entities}
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
