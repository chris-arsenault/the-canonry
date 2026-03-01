/**
 * ChronicleImagePanel sub-components
 *
 * EntityImageRefCard, PromptRequestCard, AnchorTextEditor, AnchorContextTooltip
 * extracted from ChronicleImagePanel to reduce file size and complexity.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor";
import { useImageUrl } from "@the-canonry/image-store";
import { ErrorMessage } from "@the-canonry/shared-components";
import type { EntityImageRef, PromptRequestRef } from "../lib/chronicleTypes";
import {
  SIZE_LABELS,
  STATUS_COLORS,
  JUSTIFY_SIZES,
  type EntityContext,
} from "./ChronicleImagePanelTypes";

// ─── useLazyImageUrl ───────────────────────────────────────────────────────

export function useLazyImageUrl(imageId: string | null | undefined) {
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

// ─── AnchorContextTooltip ──────────────────────────────────────────────────

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

  const handleMouseEnter = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left, y: rect.bottom + 4 });
    }
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  if (!snippet) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="cip-tooltip-trigger"
    >
      {children}
      {showTooltip &&
        createPortal(
          <div
            className="cip-tooltip"
            style={{
              '--cip-tooltip-left': `${Math.min(tooltipPos.x, window.innerWidth - 420)}px`,
              '--cip-tooltip-top': `${tooltipPos.y}px`,
            } as React.CSSProperties}
          >
            {snippet.hasPrefix && "..."}
            {snippet.before}
            <mark className="cip-tooltip-highlight">{snippet.match}</mark>
            {snippet.after}
            {snippet.hasSuffix && "..."}
          </div>,
          document.body
        )}
    </span>
  );
}

// ─── AnchorTextEditor ──────────────────────────────────────────────────────

export function AnchorTextEditor({
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
      <span className="cip-anchor-underline">&quot;{preview}&quot;</span>
    </AnchorContextTooltip>
  );

  const handleSave = useCallback(() => {
    const next = draft.trim();
    if (!next) return;
    if (next !== anchorText && onSave) onSave(next);
    setIsEditing(false);
  }, [draft, anchorText, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(anchorText);
    setIsEditing(false);
  }, [anchorText]);

  const handleStartEdit = useCallback(() => setIsEditing(true), []);
  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value), []);

  if (!onSave) {
    return <div className="cip-anchor-info">Anchor: {anchorLabel}</div>;
  }

  if (!isEditing) {
    return (
      <div className="cip-anchor-row">
        <span className="cip-anchor-label">Anchor: {anchorLabel}</span>
        <button
          type="button"
          className="illuminator-button-small"
          onClick={handleStartEdit}
          disabled={disabled}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="cip-anchor-row">
      <span className="cip-anchor-edit-label">Anchor:</span>
      <input
        className="illuminator-input cip-anchor-input"
        value={draft}
        onChange={handleDraftChange}
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

// ─── Shared image thumbnail renderer ───────────────────────────────────────

function ImageCardThumbnail({
  containerRef,
  loading,
  url,
  alt,
  imageId,
  deferThumbnail,
  hasImage,
  fallbackText,
  onImageClick,
}: Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  url: string | null;
  alt: string;
  imageId: string | null | undefined;
  deferThumbnail: boolean;
  hasImage: boolean;
  fallbackText: string;
  onImageClick?: (imageId: string, title: string) => void;
}>) {
  const isClickable = Boolean(imageId && onImageClick);
  const handleClick = useCallback(() => {
    if (imageId && onImageClick) onImageClick(imageId, alt);
  }, [imageId, onImageClick, alt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick();
    },
    [handleClick]
  );

  return (
    <div ref={containerRef} className="cip-thumbnail">
      {loading && <span className="cip-thumbnail-loading">...</span>}
      {!loading && url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onClick={isClickable ? handleClick : undefined}
          className={`cip-thumbnail-img${isClickable ? " cip-thumbnail-img-clickable" : ""}`}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={isClickable ? handleKeyDown : undefined}
        />
      )}
      {!loading && !url && (
        <span className="cip-thumbnail-placeholder">
          {deferThumbnail ? "..." : hasImage ? "?" : fallbackText}
        </span>
      )}
    </div>
  );
}

// ─── SizeControls ──────────────────────────────────────────────────────────

function SizeControls({
  size,
  justification,
  onUpdateSize,
  onUpdateJustification,
  isGenerating,
}: Readonly<{
  size: string;
  justification?: string;
  onUpdateSize?: (size: string) => void;
  onUpdateJustification?: (justification: "left" | "right") => void;
  isGenerating?: boolean;
}>) {
  if (!onUpdateSize) return null;
  const isJustifiable = JUSTIFY_SIZES.has(size);

  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateSize(e.target.value),
    [onUpdateSize]
  );

  const handleJustifyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onUpdateJustification) onUpdateJustification(e.target.value as "left" | "right");
    },
    [onUpdateJustification]
  );

  return (
    <div className="cip-size-controls">
      <span className="cip-size-label">Size:</span>
      <select
        className="illuminator-select cip-size-select"
        value={size}
        onChange={handleSizeChange}
        disabled={isGenerating}
      >
        {Object.entries(SIZE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {isJustifiable && onUpdateJustification && (
        <>
          <span className="cip-size-label">Justify:</span>
          <select
            className="illuminator-select cip-justify-select"
            value={justification || "left"}
            onChange={handleJustifyChange}
            disabled={isGenerating}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </>
      )}
    </div>
  );
}

// ─── EntityImageRefCard ────────────────────────────────────────────────────

export function EntityImageRefCard({
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
  const imageId = entity?.enrichment?.image?.imageId ?? null;
  const { containerRef, url, loading, isVisible } = useLazyImageUrl(imageId);
  const hasImage = Boolean(imageId);
  const anchorMissing = Boolean(
    chronicleText && imageRef.anchorText && !resolveAnchorPhrase(imageRef.anchorText, chronicleText)
  );
  const deferThumbnail = hasImage && !isVisible;

  return (
    <div className="cip-ref-card">
      <ImageCardThumbnail
        containerRef={containerRef}
        loading={loading}
        url={url}
        alt={entity?.name || "Entity image"}
        imageId={imageId}
        deferThumbnail={deferThumbnail}
        hasImage={hasImage}
        fallbackText={"\u2014"}
        onImageClick={onImageClick}
      />
      <div className="cip-info">
        <div className="cip-badge-row">
          <span className="cip-entity-ref-badge">Entity Ref</span>
          <span className="cip-size-badge">{SIZE_LABELS[imageRef.size] || imageRef.size}</span>
        </div>
        <div className="cip-entity-name">{entity?.name || imageRef.entityId}</div>
        {entity?.kind && (
          <div className="cip-entity-meta">
            {entity.kind}
            {entity.culture && entity.culture !== "universal" && ` \u2022 ${entity.culture}`}
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
          <div className="cip-anchor-missing">Anchor text not found in chronicle</div>
        )}
        <SizeControls
          size={imageRef.size}
          justification={imageRef.justification}
          onUpdateSize={onUpdateSize as ((size: string) => void) | undefined}
          onUpdateJustification={onUpdateJustification}
          isGenerating={isGenerating}
        />
        {imageRef.caption && <div className="cip-caption">Caption: {imageRef.caption}</div>}
        {!hasImage && <div className="cip-no-image-warning">Entity has no image</div>}
      </div>
    </div>
  );
}

// ─── PromptRequestCard ─────────────────────────────────────────────────────

export function PromptRequestCard({
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
  const anchorMissing = Boolean(
    chronicleText && imageRef.anchorText && !resolveAnchorPhrase(imageRef.anchorText, chronicleText)
  );
  const deferThumbnail = Boolean(imageRef.generatedImageId) && !isVisible;
  const placeholderText =
    deferThumbnail || imageRef.status === "generating" ? "..." : "\uD83D\uDDBC\uFE0F";

  const involvedEntityNames = imageRef.involvedEntityIds
    ?.map((id) => entities?.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="cip-ref-card">
      <ImageCardThumbnail
        containerRef={containerRef}
        loading={loading}
        url={url}
        alt="Generated"
        imageId={imageRef.generatedImageId ?? null}
        deferThumbnail={deferThumbnail}
        hasImage={Boolean(imageRef.generatedImageId)}
        fallbackText={placeholderText}
        onImageClick={onImageClick}
      />
      <div className="cip-info">
        <div className="cip-badge-row">
          <span className="cip-scene-badge">Scene Image</span>
          <span
            className="cip-status-badge"
            style={{ '--cip-status-bg': statusColor.bg, '--cip-status-text': statusColor.text } as React.CSSProperties}
          >
            {imageRef.status}
          </span>
          <span className="cip-size-badge">{SIZE_LABELS[imageRef.size] || imageRef.size}</span>
        </div>
        <div className="cip-scene-description">{imageRef.sceneDescription}</div>
        {onRegenerateDescription && !isGenerating && (
          <button onClick={onRegenerateDescription} className="cip-regen-desc-btn">
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
          <div className="cip-anchor-missing">Anchor text not found in chronicle</div>
        )}
        <SizeControls
          size={imageRef.size}
          justification={imageRef.justification}
          onUpdateSize={onUpdateSize as ((size: string) => void) | undefined}
          onUpdateJustification={onUpdateJustification}
          isGenerating={isGenerating}
        />
        {involvedEntityNames && involvedEntityNames.length > 0 && (
          <div className="cip-involved-entities">
            <span className="cip-involved-label">Figures:</span>
            {involvedEntityNames.map((name, i) => (
              <span key={i} className="cip-involved-name">{name}</span>
            ))}
          </div>
        )}
        {imageRef.caption && <div className="cip-caption">Caption: {imageRef.caption}</div>}
        {imageRef.error && <ErrorMessage message={imageRef.error} className="cip-error-message" />}
        <PromptRequestActions
          canGenerate={canGenerate}
          canRegenerate={canRegenerate}
          canReset={canReset}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
          onReset={onReset}
          onSelectExisting={onSelectExisting}
        />
      </div>
    </div>
  );
}

// ─── PromptRequestActions ──────────────────────────────────────────────────

function PromptRequestActions({
  canGenerate,
  canRegenerate,
  canReset,
  isGenerating,
  onGenerate,
  onReset,
  onSelectExisting,
}: Readonly<{
  canGenerate: boolean;
  canRegenerate: boolean;
  canReset: boolean;
  isGenerating?: boolean;
  onGenerate?: () => void;
  onReset?: () => void;
  onSelectExisting?: () => void;
}>) {
  return (
    <>
      <div className="cip-action-row">
        {canGenerate && onGenerate && (
          <button onClick={onGenerate} className="cip-generate-btn">Generate Image</button>
        )}
        {canRegenerate && onGenerate && (
          <button onClick={onGenerate} className="cip-generate-btn">Regenerate Image</button>
        )}
        {onSelectExisting && !isGenerating && (
          <button onClick={onSelectExisting} className="cip-secondary-btn">Select Existing</button>
        )}
      </div>
      {canReset && onReset && (
        <button onClick={onReset} className="cip-reset-btn">Reset</button>
      )}
    </>
  );
}
