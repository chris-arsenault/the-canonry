/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, useReducer } from "react";
import MDEditor from "@uiw/react-md-editor";
import type {
  WikiPage,
  WikiSection,
  WikiSectionImage,
  WikiHistorianNote,
  HardState,
  DisambiguationEntry,
  ImageAspect,
  PageLayoutOverride,
} from "../types/world.ts";
import {
  useImageUrl,
  useImageUrls,
  useImageMetadata,
  useImageStore,
} from "@penguin-tales/image-store";
import {
  useEntityNarrativeEvents,
  useEntityNarrativeLoading,
} from "@penguin-tales/narrative-store";
import { SeedModal, type ChronicleSeedData } from "./ChronicleSeedViewer.tsx";
import { applyWikiLinks } from "../lib/wikiBuilder.ts";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor.ts";
import EntityTimeline from "./EntityTimeline.tsx";
import ProminenceTimeline from "./ProminenceTimeline.tsx";
import ImageLightbox from "./ImageLightbox.tsx";
import { SectionDivider, FrostEdge } from "./Ornaments.tsx";
import { prominenceLabelFromScale, type ProminenceScale } from "@canonry/world-schema";
import styles from "./WikiPage.module.css";

// ============================================================================
// Layout Engine
// ============================================================================

/**
 * Layout modes for chronicle sections:
 * - 'flow': Text wraps around floated images/callouts (traditional Wikipedia style).
 *           Best for long prose with 1-2 images.
 * - 'margin': 3-column grid with images/callouts in side margins, text in center.
 *             Text flows uninterrupted. Best for short content, verse, documents.
 * - 'centered': Text centered, no floats. For verse/poetry without images.
 */
type LayoutMode = "flow" | "margin" | "centered";

/** Narrative styles that use centered/verse layout */
const CENTERED_STYLES = new Set(["folk-song", "nursery-rhymes", "haiku-collection"]);

/** Narrative styles where floats shouldn't interrupt text */
const NO_FLOAT_STYLES = new Set([
  "wanted-notice",
  "sacred-text",
  "tavern-notices",
  "interrogation-record",
  "diplomatic-accord",
]);

/**
 * Analyze a section's content to determine the optimal layout mode.
 *
 * Decision factors:
 * - Narrative style (centered/no-float styles override other logic)
 * - Word count vs float element count ratio
 * - Total float elements (images + full historian notes)
 *
 * Rules:
 * 1. Centered styles with floats → 'margin' (images in margins, text centered)
 * 2. Centered styles without floats → 'centered' (just centered text)
 * 3. No-float styles with floats → 'margin'
 * 4. Short content (<150 words) with any floats → 'margin'
 * 5. High float density (< 100 words per float element) → 'margin'
 * 6. Otherwise → 'flow'
 */
function analyzeLayout(
  section: WikiSection,
  fullNoteCount: number,
  narrativeStyleId?: string
): LayoutMode {
  const imageCount = (section.images || []).length;
  // Callouts are absolutely positioned in sidenote column — they don't affect text flow.
  // Only images (which use CSS float) count for layout decisions.
  const floatCount = imageCount;

  if (narrativeStyleId && CENTERED_STYLES.has(narrativeStyleId)) {
    return floatCount > 0 ? "margin" : "centered";
  }
  if (narrativeStyleId && NO_FLOAT_STYLES.has(narrativeStyleId)) {
    return floatCount > 0 ? "margin" : "flow";
  }

  if (floatCount === 0) return "flow";

  const wordCount = section.content.split(/\s+/).length;

  // Short content with float elements → margin to avoid awkward wrapping
  if (wordCount < 150) return "margin";

  // High float density → margin to avoid float collisions
  if (wordCount / floatCount < 100) return "margin";

  return "flow";
}

/**
 * Check if image size is a float (small/medium) vs block (large/full-width)
 */
function isFloatImage(size: WikiSectionImage["size"]): boolean {
  return size === "small" || size === "medium" || size === "large";
}

/**
 * Get the combined className for an image in flow layout mode.
 * Float images (small/medium/large): thumb frame + size width
 * Block images (full-width): centered block style
 */
function getImageClassName(
  size: WikiSectionImage["size"],
  position: "left" | "right" = "left"
): string {
  const isFloat = isFloatImage(size);

  if (isFloat) {
    const thumbClass = position === "left" ? styles.imageThumbLeft : styles.imageThumbRight;
    let sizeClass: string;
    if (size === "small") {
      sizeClass = styles.imageSmall;
    } else if (size === "medium") {
      sizeClass = styles.imageMedium;
    } else {
      sizeClass = styles.imageLarge;
    }
    return `${thumbClass} ${sizeClass}`;
  }

  // Block images
  if (size === "full-width") return styles.imageFullWidth;
  const alignClass = position === "right" ? styles.imageLargeRight : styles.imageLargeLeft;
  return `${styles.imageLarge} ${alignClass}`;
}

/**
 * Classify aspect ratio from width/height (for runtime detection fallback)
 */
function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return "portrait";
  if (ratio > 1.1) return "landscape";
  return "square";
}

/**
 * Get infobox image CSS class based on aspect ratio
 */
function getInfoboxImageClass(aspect: ImageAspect | undefined, isMobile: boolean): string {
  // If no aspect info, use the fallback class that handles any aspect gracefully
  if (!aspect) {
    return isMobile ? styles.infoboxImageMobile : styles.infoboxImage;
  }
  // Use aspect-specific classes
  const suffix = isMobile ? "Mobile" : "";
  switch (aspect) {
    case "portrait":
      return styles[`infoboxImagePortrait${suffix}`] || styles.infoboxImagePortrait;
    case "landscape":
      return styles[`infoboxImageLandscape${suffix}`] || styles.infoboxImageLandscape;
    case "square":
      return styles[`infoboxImageSquare${suffix}`] || styles.infoboxImageSquare;
    default:
      return isMobile ? styles.infoboxImageMobile : styles.infoboxImage;
  }
}

/**
 * ChronicleImage - Renders an inline chronicle image
 * Loads images on-demand from the shared image store.
 * Supports flow mode (CSS float) and margin mode (side column in grid).
 */
function ChronicleImage({
  image,
  onOpen,
  layoutMode = "flow",
}: Readonly<{
  image: WikiSectionImage;
  onOpen?: (imageUrl: string, image: WikiSectionImage) => void;
  layoutMode?: LayoutMode;
}>) {
  const { url: imageUrl, loading } = useImageUrl(image.imageId);
  const [error, setError] = useState(false);

  const imageClassName =
    layoutMode === "margin"
      ? styles.marginImage
      : getImageClassName(image.size, image.justification || "left");

  if (loading) {
    return (
      <figure className={imageClassName}>
        <div className={styles.imagePlaceholder}>Loading...</div>
      </figure>
    );
  }

  if (error || !imageUrl) {
    return null; // Don't render if image not found
  }

  return (
    <figure className={imageClassName}>
      <img
        src={imageUrl}
        alt={image.caption || "Chronicle illustration"}
        className={styles.figureImage}
        onError={() => setError(true)}
        onClick={() => onOpen?.(imageUrl, image)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      />
      {image.caption && <figcaption className={styles.imageCaption}>{image.caption}</figcaption>}
    </figure>
  );
}

/**
 * CoverHeroImage - Full-width hero banner for chronicle cover images
 * Displays with a fade-to-background gradient overlay and title
 */
function CoverHeroImage({
  imageId,
  title,
  onOpen,
}: Readonly<{
  imageId: string;
  title: string;
  onOpen?: (imageUrl: string) => void;
}>) {
  const { url: imageUrl, loading } = useImageUrl(imageId);
  const [error, setError] = useState(false);

  if (loading || error || !imageUrl) return null;

  return (
    <div className={styles.coverHero}>
      <img
        src={imageUrl}
        alt={title}
        className={[styles.coverHeroImage, onOpen ? styles.coverHeroImageClickable : ""].filter(Boolean).join(" ")}
        onError={() => setError(true)}
        onClick={() => onOpen?.(imageUrl)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      />
      <div className={styles.coverHeroOverlay}>
        <h1 className={styles.chronicleTitleHero}>{title}</h1>
      </div>
      <FrostEdge position="bottom" className={styles.frostEdgeHero} />
    </div>
  );
}

/**
 * ChronicleGallery - Card grid of chronicle cover images
 * Replaces the old text-only chronicle list with a visual gallery.
 */
function ChronicleGallery({
  title,
  links,
  onNavigate,
}: Readonly<{
  title: string;
  links: WikiPage[];
  onNavigate: (id: string) => void;
}>) {
  const imageIds = useMemo(
    () => links.slice(0, 20).map((l) => l.content.coverImageId ?? null),
    [links]
  );
  const { urls } = useImageUrls(imageIds);
  const capped = links.slice(0, 20);

  return (
    <div className={styles.gallerySection}>
      <h2 className={styles.sectionHeading}>
        {title} ({links.length})
      </h2>
      <SectionDivider className={styles.sectionDividerSvg} />
      <div className={styles.galleryGrid}>
        {capped.map((link) => {
          const coverUrl = link.content.coverImageId ? urls.get(link.content.coverImageId) : null;
          return (
            <button
              key={link.id}
              className={styles.galleryCard}
              onClick={() => onNavigate(link.id)}
            >
              {coverUrl ? (
                <img src={coverUrl} alt={link.title} className={styles.galleryImage} />
              ) : (
                <div className={styles.galleryPlaceholder}>&#x1F4DC;</div>
              )}
              <div className={styles.galleryTitle} title={link.title}>
                {link.title}
              </div>
            </button>
          );
        })}
      </div>
      {links.length > 20 && <div className={styles.moreText}>...and {links.length - 20} more</div>}
    </div>
  );
}

// ============================================================================
// Historian Callouts
// ============================================================================

const HISTORIAN_NOTE_COLORS: Record<string, string> = {
  commentary: "#c49a5c",
  correction: "#c0392b",
  tangent: "#8b7355",
  skepticism: "#d4a017",
  pedantic: "#5b7a5e",
};

const HISTORIAN_NOTE_ICONS: Record<string, string> = {
  commentary: "✦",
  correction: "!",
  tangent: "~",
  skepticism: "?",
  pedantic: "#",
};

const HISTORIAN_NOTE_LABELS: Record<string, string> = {
  commentary: "Commentary",
  correction: "Correction",
  tangent: "Tangent",
  skepticism: "Skepticism",
  pedantic: "Pedantic",
};

/**
 * Inject footnote-style superscript markers into markdown content for POPOUT notes only.
 * Returns the modified content and the ordered list of matched notes (for tooltip lookup).
 */
function injectFootnotes(
  content: string,
  notes: WikiHistorianNote[]
): { content: string; orderedNotes: WikiHistorianNote[] } {
  if (!notes || notes.length === 0) return { content, orderedNotes: [] };

  // Process ALL notes (both full and popout) for unified numbering
  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number }> = [];
  for (const note of notes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    if (match) {
      resolved.push({ note, index: match.index, phraseLen: match.phrase.length });
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  const orderedNotes = resolved.map((r) => r.note);

  let result = content;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = `<sup class="historian-fn" data-note-idx="${i}" style="color:${HISTORIAN_NOTE_COLORS[resolved[i].note.type] || "#8b7355"};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${i + 1}</sup>`;
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return { content: result, orderedNotes };
}

/**
 * Inject footnote superscripts into a text slice using global indices from orderedNotes.
 */
function injectFootnotesWithGlobalIndex(
  slice: string,
  allNotes: WikiHistorianNote[],
  orderedNotes: WikiHistorianNote[]
): string {
  if (!allNotes || allNotes.length === 0) return slice;

  const resolved: Array<{
    note: WikiHistorianNote;
    index: number;
    phraseLen: number;
    globalIdx: number;
  }> = [];
  for (const note of allNotes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, slice);
    if (match) {
      const globalIdx = orderedNotes.indexOf(note);
      if (globalIdx >= 0) {
        resolved.push({ note, index: match.index, phraseLen: match.phrase.length, globalIdx });
      }
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  let result = slice;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen, globalIdx, note } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = `<sup class="historian-fn" data-note-idx="${globalIdx}" style="color:${HISTORIAN_NOTE_COLORS[note.type] || "#8b7355"};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${globalIdx + 1}</sup>`;
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return result;
}

/**
 * HistorianCallout - Callout box for 'full' display notes.
 * - 'flow': Floated right, text wraps around
 * - 'margin': Compact callout for side column in 3-column grid
 */
function HistorianCallout({
  note,
  noteIndex,
  layoutMode = "flow",
}: Readonly<{
  note: WikiHistorianNote;
  noteIndex?: number;
  layoutMode?: LayoutMode;
}>) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || "✦";
  const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
  const indexLabel = noteIndex != null ? `${noteIndex + 1}` : "";

  if (layoutMode === "margin") {
    return (
       
      <aside
        className={styles.marginCallout}
        style={{ "--note-color": color } as React.CSSProperties}
      >
        <div className={styles.marginCalloutLabel}>
          {indexLabel && <span className={styles.noteIndexLabel}>{indexLabel}</span>}
          {icon} {label}
        </div>
        {note.text}
      </aside>
    );
  }

  // Flow mode: floated right callout
  return (
    // eslint-disable-next-line local/no-inline-styles -- dynamic color per historian note type
    <aside className={styles.flowCallout} style={{ "--note-color": color } as React.CSSProperties}>
      <div className={styles.noteTypeLabel}>
        {indexLabel && <span className={styles.noteIndexLabel}>{indexLabel}</span>}
        {icon} {label}
      </div>
      {note.text}
    </aside>
  );
}

/**
 * HistorianFootnoteTooltip - Positioned callout box shown on hover of footnote markers
 */
function HistorianFootnoteTooltip({
  note,
  noteIndex,
  position,
}: Readonly<{
  note: WikiHistorianNote;
  noteIndex?: number;
  position: { x: number; y: number };
}>) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || "✦";
  const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
  const indexLabel = noteIndex != null ? `${noteIndex + 1}` : "";

  // Position below the footnote marker
  const tooltipWidth = 340;
  let left = position.x - tooltipWidth / 2;
  if (left < 10) left = 10;
  if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;

  return (
     
    <div
      className={styles.footnoteTooltip}
      style={
        {
          "--tooltip-left": `${left}px`,
          "--tooltip-top": `${position.y + 8}px`,
          "--note-color": color,
        } as React.CSSProperties
      }
    >
      <div className={styles.noteTypeLabel}>
        {indexLabel && <span className={styles.noteIndexLabel}>{indexLabel}</span>}
        {icon} {label}
      </div>
      {note.text}
    </div>
  );
}

/**
 * SectionWithImages - Renders a section with content-aware layout
 *
 * Layout modes (chosen by analyzeLayout):
 * - 'flow': Float images/callouts, text wraps (Wikipedia style). For long prose.
 * - 'margin': 3-column grid with images/callouts in side margins. For short content.
 * - 'centered': Text centered, no floats. For verse/poetry without images.
 *
 * For flow mode:
 * 1. Float images FIRST in the DOM, before the text they float with
 * 2. Text in a single continuous block (not fragmented into separate divs)
 * 3. Block images inserted at paragraph boundaries
 */
function SectionWithImages({
  section,
  entityNameMap,
  aliasMap,
  linkableNames,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  onImageOpen,
  historianNotes,
  isFirstChronicleSection,
  narrativeStyleId,
  layoutOverride,
}: Readonly<{
  section: WikiSection;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter?: (pageId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
  onImageOpen?: (imageUrl: string, image: WikiSectionImage) => void;
  historianNotes?: WikiHistorianNote[];
  isFirstChronicleSection?: boolean;
  narrativeStyleId?: string;
  layoutOverride?: PageLayoutOverride;
}>) {
  const images = layoutOverride?.imageLayout === "hidden" ? [] : section.images || [];
  const content = section.content;

  // Apply annotation display override: remap or filter notes
  const allNotes = useMemo(() => {
    const raw = historianNotes || [];
    if (!layoutOverride?.annotationDisplay) return raw;
    if (layoutOverride.annotationDisplay === "disabled") return [];
    // Remap all notes to the override display mode
    return raw.map((n) => ({
      ...n,
      display: layoutOverride.annotationDisplay as "full" | "popout",
    }));
  }, [historianNotes, layoutOverride?.annotationDisplay]);

  // Inject footnote markers into content for ALL notes (unified numbering)
  const { content: annotatedContent, orderedNotes } = useMemo(
    () => injectFootnotes(content, allNotes),
    [content, allNotes]
  );

  // Full-display notes with their indices in the unified ordering
  const fullNoteInserts = useMemo(() => {
    return orderedNotes
      .map((note, idx) => ({ note, idx }))
      .filter(({ note }) => note.display === "full");
  }, [orderedNotes]);

  // Determine layout mode: override wins, then heuristic
  const layoutMode = useMemo(
    () =>
      layoutOverride?.layoutMode ??
      analyzeLayout(section, fullNoteInserts.length, narrativeStyleId),
    [layoutOverride?.layoutMode, section, fullNoteInserts.length, narrativeStyleId]
  );

  // Footnote collection mode: collect all notes as a numbered list at section bottom
  const useFootnoteMode = layoutOverride?.annotationPosition === "footnote";

  // Hover state for footnote tooltips (all notes, not just popout)
  const [hoveredNote, setHoveredNote] = React.useState<{
    note: WikiHistorianNote;
    idx: number;
    pos: { x: number; y: number };
  } | null>(null);

  const handleFootnoteHover = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "SUP" && target.classList.contains("historian-fn")) {
        const idx = parseInt(target.getAttribute("data-note-idx") || "", 10);
        if (!isNaN(idx) && orderedNotes[idx]) {
          const rect = target.getBoundingClientRect();
          setHoveredNote({
            note: orderedNotes[idx],
            idx,
            pos: { x: rect.left + rect.width / 2, y: rect.bottom },
          });
        }
      }
    },
    [orderedNotes]
  );

  const handleFootnoteLeave = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "SUP" && target.classList.contains("historian-fn")) {
      setHoveredNote(null);
    }
  }, []);

  // ── Sidenote positioning engine ──
  // Measures superscript positions in the DOM and positions callouts alongside them
  const sectionRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef<Map<number, HTMLElement>>(new Map());
  const resolvedPositionsRef = useRef<Map<number, number>>(new Map());
  const [layoutVersion, bumpLayoutVersion] = useReducer((x: number) => x + 1, 0);

  useLayoutEffect(() => {
    const container = sectionRef.current;
    if (!container || fullNoteInserts.length === 0) {
      resolvedPositionsRef.current = new Map();
      bumpLayoutVersion();
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const supPositions = new Map<number, number>();

    container.querySelectorAll("sup.historian-fn[data-note-idx]").forEach((sup) => {
      const idx = parseInt(sup.getAttribute("data-note-idx") || "", 10);
      if (!isNaN(idx) && fullNoteInserts.some((f) => f.idx === idx)) {
        supPositions.set(idx, (sup as HTMLElement).getBoundingClientRect().top - containerRect.top);
      }
    });

    const calloutHeights = new Map<number, number>();
    calloutRefs.current.forEach((el, idx) => {
      calloutHeights.set(idx, el.offsetHeight);
    });

    // Resolve overlapping callouts by pushing them down
    const sorted = [...fullNoteInserts].sort((a, b) => {
      const posA = supPositions.get(a.idx) ?? 0;
      const posB = supPositions.get(b.idx) ?? 0;
      return posA - posB;
    });

    const resolved = new Map<number, number>();
    const GAP = 8;
    let lastBottom = -Infinity;

    for (const { idx } of sorted) {
      let top = supPositions.get(idx) ?? 0;
      if (top < lastBottom + GAP) {
        top = lastBottom + GAP;
      }
      resolved.set(idx, top);
      const height = calloutHeights.get(idx) ?? 80;
      lastBottom = top + height;
    }

    resolvedPositionsRef.current = resolved;
    bumpLayoutVersion();
  }, [annotatedContent, fullNoteInserts]);

  // Read computed positions (re-renders when layoutVersion bumps)
  // eslint-disable-next-line sonarjs/void-use -- intentional read to trigger re-render
  void layoutVersion;
  const resolvedPositions = resolvedPositionsRef.current;

  // In footnote mode, full notes don't need inline/sidenote rendering — they collect at bottom
  const effectiveFullNoteInserts = useFootnoteMode ? [] : fullNoteInserts;
  const hasInserts = images.length > 0 || effectiveFullNoteInserts.length > 0;

  // Footnote list rendered at section bottom when annotationPosition is 'footnote'
  const footnoteList =
    useFootnoteMode && orderedNotes.length > 0 ? (
      <ol className={styles.footnoteList}>
        {orderedNotes.map((note, idx) => {
          const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
          const icon = HISTORIAN_NOTE_ICONS[note.type] || "\u2726";
          const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
          return (
            <li
              key={note.noteId}
              className={styles.footnoteItem}
              // eslint-disable-next-line local/no-inline-styles -- dynamic color per note type
              style={{ "--note-color": color } as React.CSSProperties}
            >
              <span className={styles.footnoteLabel}>
                {icon} {label}
              </span>
              <span className={styles.footnoteText}>{note.text}</span>
            </li>
          );
        })}
      </ol>
    ) : null;

  if (!hasInserts) {
    const wrapperClass = layoutMode === "centered" ? styles.centeredLayout : undefined;
    return (
      <div
        className={wrapperClass}
        onMouseOver={handleFootnoteHover}
        onMouseOut={handleFootnoteLeave}
        onBlur={handleFootnoteLeave}
        onFocus={handleFootnoteHover}
      >
        <MarkdownSection
          content={annotatedContent}
          entityNameMap={entityNameMap}
          aliasMap={aliasMap}
          linkableNames={linkableNames}
          onNavigate={onNavigate}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          isFirstFragment={isFirstChronicleSection}
        />
        {footnoteList}
        {hoveredNote && (
          <HistorianFootnoteTooltip
            note={hoveredNote.note}
            noteIndex={hoveredNote.idx}
            position={hoveredNote.pos}
          />
        )}
      </div>
    );
  }

  // ── Margin mode: 3-column grid with images/callouts in side margins ──
  if (layoutMode === "margin") {
    // Distribute images and callouts to left/right margin columns
    type MarginItem =
      | { kind: "image"; image: WikiSectionImage }
      | { kind: "callout"; note: WikiHistorianNote; noteIndex: number };

    const leftItems: MarginItem[] = [];
    const rightItems: MarginItem[] = [];

    // Collect all margin items (images + callouts) then distribute balanced
    const allMarginItems: MarginItem[] = [];
    for (const img of images) {
      allMarginItems.push({ kind: "image", image: img });
    }
    for (const { note, idx } of effectiveFullNoteInserts) {
      allMarginItems.push({ kind: "callout", note, noteIndex: idx });
    }

    // Distribute: respect explicit image justification, balance everything else
    for (const item of allMarginItems) {
      if (item.kind === "image" && item.image.justification === "left") {
        leftItems.push(item);
      } else if (item.kind === "image" && item.image.justification === "right") {
        rightItems.push(item);
      } else {
        // Balance: put in the column with fewer items
        if (leftItems.length <= rightItems.length) {
          leftItems.push(item);
        } else {
          rightItems.push(item);
        }
      }
    }

    return (
      <div
        className={styles.marginLayout}
        onMouseOver={handleFootnoteHover}
        onMouseOut={handleFootnoteLeave}
        onBlur={handleFootnoteLeave}
        onFocus={handleFootnoteHover}
      >
        <div className={styles.marginLeft}>
          {leftItems.map((item, i) =>
            item.kind === "image" ? (
              <ChronicleImage
                key={`ml-img-${item.image.refId}-${i}`}
                image={item.image}
                onOpen={onImageOpen}
                layoutMode="margin"
              />
            ) : (
              <HistorianCallout
                key={`ml-fn-${item.note.noteId}`}
                note={item.note}
                noteIndex={item.noteIndex}
                layoutMode="margin"
              />
            )
          )}
        </div>
        <div className={styles.marginCenter}>
          <MarkdownSection
            content={annotatedContent}
            entityNameMap={entityNameMap}
            aliasMap={aliasMap}
            linkableNames={linkableNames}
            onNavigate={onNavigate}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
            isFirstFragment={isFirstChronicleSection}
          />
        </div>
        <div className={styles.marginRight}>
          {rightItems.map((item, i) =>
            item.kind === "image" ? (
              <ChronicleImage
                key={`mr-img-${item.image.refId}-${i}`}
                image={item.image}
                onOpen={onImageOpen}
                layoutMode="margin"
              />
            ) : (
              <HistorianCallout
                key={`mr-fn-${item.note.noteId}`}
                note={item.note}
                noteIndex={item.noteIndex}
                layoutMode="margin"
              />
            )
          )}
        </div>
        {footnoteList}
        {hoveredNote && (
          <HistorianFootnoteTooltip
            note={hoveredNote.note}
            noteIndex={hoveredNote.idx}
            position={hoveredNote.pos}
          />
        )}
      </div>
    );
  }

  // ── Flow mode: fragment-based rendering with interleaved images ──
  // Callouts are NOT interleaved — they render in an absolutely positioned sidenote column

  // Build insert list: only images (callouts handled separately as sidenotes)
  type InsertItem = { kind: "image"; image: WikiSectionImage; position: number };

  const insertItems: InsertItem[] = [];

  for (const img of images) {
    const resolved = img.anchorText ? resolveAnchorPhrase(img.anchorText, content) : null;
    let position = resolved ? resolved.index : -1;
    if (position < 0 && img.anchorIndex !== undefined && img.anchorIndex < content.length) {
      position = img.anchorIndex;
    }
    if (position < 0) {
      position = content.length;
    }
    insertItems.push({ kind: "image", image: img, position });
  }

  insertItems.sort((a, b) => a.position - b.position);

  // Build fragments: split content at paragraph boundaries near each image
  const fragments: Array<
    { type: "text"; content: string } | { type: "image"; image: WikiSectionImage }
  > = [];
  let lastIndex = 0;

  for (const item of insertItems) {
    const anchorEnd = item.position + (item.image.anchorText?.length || 0);
    const paragraphEnd = content.indexOf("\n\n", anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;

    if (insertPoint > lastIndex) {
      const slice = content.slice(lastIndex, insertPoint);
      const annotated = injectFootnotesWithGlobalIndex(slice, allNotes, orderedNotes);
      fragments.push({ type: "text", content: annotated });
    }
    fragments.push({ type: "image", image: item.image });
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : insertPoint;
  }

  if (lastIndex < content.length) {
    const slice = content.slice(lastIndex);
    const annotated = injectFootnotesWithGlobalIndex(slice, allNotes, orderedNotes);
    fragments.push({ type: "text", content: annotated });
  }

  let firstTextSeen = false;

  return (
    <div
      className={styles.sectionWithImages}
      ref={sectionRef}
      onMouseOver={handleFootnoteHover}
      onMouseOut={handleFootnoteLeave}
      onBlur={handleFootnoteLeave}
      onFocus={handleFootnoteHover}
    >
      {/* Inline fallback callouts: floated right, before text so float wraps (narrow viewports only) */}
      {effectiveFullNoteInserts.length > 0 && (
        <div className={styles.inlineCallouts}>
          {effectiveFullNoteInserts.map(({ note, idx }) => (
            <HistorianCallout
              key={`il-${note.noteId}`}
              note={note}
              noteIndex={idx}
              layoutMode="flow"
            />
          ))}
        </div>
      )}
      {fragments.map((fragment, i) => {
        if (fragment.type === "image") {
          const isFloat = isFloatImage(fragment.image.size);
          if (isFloat) {
            return (
              <ChronicleImage
                key={`img-${fragment.image.refId}-${i}`}
                image={fragment.image}
                onOpen={onImageOpen}
                layoutMode="flow"
              />
            );
          } else {
            return (
              <React.Fragment key={`img-${fragment.image.refId}-${i}`}>
                <div className={styles.clearfix} />
                <ChronicleImage image={fragment.image} onOpen={onImageOpen} layoutMode="flow" />
              </React.Fragment>
            );
          }
        } else {
          const isFirst = isFirstChronicleSection && !firstTextSeen;
          firstTextSeen = true;
          return (
            <MarkdownSection
              key={`text-${i}`}
              content={fragment.content}
              entityNameMap={entityNameMap}
              aliasMap={aliasMap}
              linkableNames={linkableNames}
              onNavigate={onNavigate}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              isFirstFragment={isFirst}
            />
          );
        }
      })}
      <div className={styles.clearfix} />
      {/* Sidenote column: absolutely positioned callouts in right margin (wide viewports) */}
      {effectiveFullNoteInserts.length > 0 && (
        <div className={styles.sidenoteColumn}>
          {effectiveFullNoteInserts.map(({ note, idx }) => (
            <div
              key={`sn-${note.noteId}`}
              ref={(el) => {
                if (el) calloutRefs.current.set(idx, el);
                else calloutRefs.current.delete(idx);
              }}
              className={styles.sidenoteCallout}
              // eslint-disable-next-line local/no-inline-styles -- dynamic vertical position computed by layout engine
              style={
                { "--sidenote-top": `${resolvedPositions.get(idx) ?? 0}px` } as React.CSSProperties
              }
            >
              <HistorianCallout note={note} noteIndex={idx} layoutMode="margin" />
            </div>
          ))}
        </div>
      )}
      {footnoteList}
      {hoveredNote && (
        <HistorianFootnoteTooltip
          note={hoveredNote.note}
          noteIndex={hoveredNote.idx}
          position={hoveredNote.pos}
        />
      )}
    </div>
  );
}

/**
 * EntityPreviewCard - Hover preview for entity links
 * Shows thumbnail, badges for metadata, and short summary
 */
interface EntityPreviewCardProps {
  entity: HardState;
  summary?: string;
  position: { x: number; y: number };
  imageUrl?: string | null;
  prominenceScale: ProminenceScale;
}

function EntityPreviewCard({
  entity,
  summary,
  position,
  imageUrl,
  prominenceScale,
}: Readonly<EntityPreviewCardProps>) {
  // Position the card to the right of cursor, adjusting if it would go off-screen
  const cardWidth = 260;
  const cardHeight = 180;

  let left = position.x + 16;
  let top = position.y - 20;

  // Check if card would go off right edge
  if (left + cardWidth > window.innerWidth - 20) {
    left = position.x - cardWidth - 16;
  }

  // Check if card would go off bottom edge
  if (top + cardHeight > window.innerHeight - 20) {
    top = window.innerHeight - cardHeight - 20;
  }

  // Keep within top boundary
  if (top < 20) {
    top = 20;
  }

  // Get first letter for placeholder
  const initial = entity.name.charAt(0).toUpperCase();

  return (
     
    <div
      className={styles.previewCard}
      style={{ "--preview-left": `${left}px`, "--preview-top": `${top}px` } as React.CSSProperties}
    >
      <div className={styles.previewHeader}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.previewThumbnail} />
        ) : (
          <div className={styles.previewThumbnailPlaceholder}>{initial}</div>
        )}
        <div className={styles.previewTitle}>{entity.name}</div>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewBadges}>
          <span className={styles.previewBadgeKind}>{entity.kind}</span>
          {entity.subtype && <span className={styles.previewBadge}>{entity.subtype}</span>}
          <span className={styles.previewBadgeStatus}>{entity.status}</span>
          <span className={styles.previewBadge}>
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && <span className={styles.previewBadge}>{entity.culture}</span>}
        </div>
        {summary && (
          <div className={styles.previewSummary}>
            {summary.length > 250 ? `${summary.slice(0, 250)}...` : summary}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MarkdownSection - Renders content with markdown support and entity linking
 * Unified renderer for all page types (entity, chronicle, static, era)
 * Supports: markdown tables, wiki links, click navigation, hover previews
 */
function MarkdownSection({
  content,
  entityNameMap,
  aliasMap,
  linkableNames,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  isFirstFragment,
}: Readonly<{
  content: string;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter?: (pageId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
  isFirstFragment?: boolean;
}>) {
  const encodePageIdForHash = useCallback((pageId: string) => {
    return pageId
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }, []);

  // Pre-process content:
  // 1. Apply wiki links to wrap entity names with [[...]]
  // 2. Convert [[Entity Name]] or [[Entity Name|entityId]] to markdown links with proper URLs
  const processedContent = useMemo(() => {
    // First apply wiki links to detect entity names
    const linkedContent = applyWikiLinks(content, linkableNames);
    // Then convert [[...]] to markdown-friendly link format with proper URLs
    // Supports both [[EntityName]] (lookup by name) and [[EntityName|entityId]] (direct ID)
    // eslint-disable-next-line sonarjs/slow-regex -- character-class bounded, no backtracking
    return linkedContent.replace(/\[\[([^\]]+)\]\]/g, (match: string, linkContent: string) => {
      // Support [[EntityName|entityId]] format for ID-based linking
      const pipeIndex = linkContent.lastIndexOf("|");
      let displayName: string;
      let pageId: string | undefined;

      if (pipeIndex > 0 && pipeIndex < linkContent.length - 1) {
        // Format: [[DisplayName|entityId]] - use provided ID directly
        displayName = linkContent.slice(0, pipeIndex);
        pageId = linkContent.slice(pipeIndex + 1);
      } else {
        // Format: [[EntityName]] - look up by name
        displayName = linkContent;
        // Use Unicode NFC normalization for consistent lookup with entityNameMap
        const normalized = displayName.toLowerCase().trim().normalize("NFC");
        pageId = entityNameMap.get(normalized) || aliasMap.get(normalized);
      }

      if (pageId) {
        // Use #/page/{pageId|slug} format that matches the router
        return `[${displayName}](#/page/${encodePageIdForHash(pageId)})`;
      }
      // Keep as-is if page not found
      return match;
    });
  }, [content, entityNameMap, aliasMap, linkableNames, encodePageIdForHash]);

  // Handle clicks on page links within the markdown
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        // Handle #/page/{pageId} format
        if (href?.startsWith("#/page/")) {
          e.preventDefault();
          const pageId = decodeURIComponent(href.slice(7)); // Remove '#/page/'
          onNavigate(pageId);
        }
      }
    },
    [onNavigate]
  );

  // Handle hover on page links
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (!onHoverEnter) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        // Handle #/page/{pageId} format
        if (href?.startsWith("#/page/")) {
          const pageId = decodeURIComponent(href.slice(7));
          onHoverEnter(pageId, e);
        }
      }
    },
    [onHoverEnter]
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      if (!onHoverLeave) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href?.startsWith("#/page/")) {
          onHoverLeave();
        }
      }
    },
    [onHoverLeave]
  );

  return (
    <div
      data-color-mode="dark"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      className={styles.markdownSection}
      {...(isFirstFragment ? { "data-first": "" } : {})}
      onBlur={handleMouseOut}
      onFocus={handleMouseOver}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(e); }}
    >
      <MDEditor.Markdown
        source={processedContent}
        // eslint-disable-next-line local/no-inline-styles -- required by MDEditor.Markdown component API
        style={{ backgroundColor: "transparent", color: "var(--color-text-secondary)" }}
      />
      <style>{`
        .wmde-markdown {
          background: transparent !important;
          color: var(--color-text-secondary) !important;
          font-size: var(--font-size-base, 16px) !important;
          line-height: var(--line-height-relaxed, 1.85) !important;
          font-family: var(--font-family) !important;
        }
        .wmde-markdown p {
          margin-bottom: 1em !important;
        }
        .wmde-markdown h1,
        .wmde-markdown h2,
        .wmde-markdown h3,
        .wmde-markdown h4 {
          color: var(--color-text-primary) !important;
          font-family: var(--font-family-display) !important;
          border-bottom: none !important;
          margin-top: 1.8em !important;
          margin-bottom: 0.6em !important;
          letter-spacing: -0.01em !important;
        }
        .wmde-markdown h3 {
          font-size: 1.15em !important;
          color: var(--color-text-secondary) !important;
        }
        .wmde-markdown h4 {
          font-size: 1em !important;
          font-family: var(--font-family-ui) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
          color: var(--color-text-muted) !important;
        }
        .wmde-markdown a {
          color: var(--color-accent) !important;
          text-decoration: none !important;
          border-bottom: 1px dotted var(--color-accent);
        }
        .wmde-markdown a:hover {
          opacity: 0.8;
        }
        .wmde-markdown h1 a,
        .wmde-markdown h2 a,
        .wmde-markdown h3 a,
        .wmde-markdown h4 a {
          border-bottom: none !important;
          color: inherit !important;
        }
        .wmde-markdown code {
          background: var(--color-bg-tertiary) !important;
          color: var(--color-text-secondary) !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .wmde-markdown pre {
          background: var(--color-bg-secondary) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 6px !important;
        }
        .wmde-markdown pre code {
          background: transparent !important;
          padding: 0 !important;
        }
        .wmde-markdown blockquote {
          border-left: 3px solid var(--color-accent) !important;
          color: var(--color-text-muted) !important;
          background: rgba(196, 154, 92, 0.06) !important;
          padding: 8px 16px !important;
          margin: 1.2em 0 !important;
          border-radius: 0 4px 4px 0 !important;
          font-style: italic !important;
        }
        .wmde-markdown ul,
        .wmde-markdown ol {
          padding-left: 24px !important;
          margin-bottom: 1em !important;
        }
        .wmde-markdown li {
          margin-bottom: 6px !important;
        }
        .wmde-markdown table {
          border-collapse: collapse !important;
          margin: 1em 0 !important;
        }
        .wmde-markdown th,
        .wmde-markdown td {
          border: 1px solid var(--color-border) !important;
          padding: 8px 12px !important;
        }
        .wmde-markdown th {
          background: var(--color-bg-secondary) !important;
          font-family: var(--font-family-ui) !important;
          font-size: var(--font-size-sm) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
        }
        .wmde-markdown table tr {
          background-color: transparent !important;
        }
        .wmde-markdown table tr:nth-child(2n) {
          background-color: rgba(196, 154, 92, 0.06) !important;
        }
        .wmde-markdown hr {
          border-color: var(--color-border) !important;
          margin: 1.5em 0 !important;
        }
        .wmde-markdown strong {
          color: var(--color-text-primary) !important;
        }
      `}</style>
    </div>
  );
}

interface WikiPageViewProps {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
  /** Other pages that share this page's base name (for disambiguation) */
  disambiguation?: DisambiguationEntry[];
  onNavigate: (pageId: string) => void;
  onNavigateToEntity: (entityId: string) => void;
  prominenceScale: ProminenceScale;
  breakpoint?: "mobile" | "tablet" | "desktop";
  /** Per-page layout override from Illuminator */
  layoutOverride?: PageLayoutOverride;
}

export default function WikiPageView({
  page,
  pages,
  entityIndex,
  disambiguation,
  onNavigate,
  onNavigateToEntity,
  prominenceScale,
  breakpoint = "desktop",
  layoutOverride,
}: Readonly<WikiPageViewProps>) {
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";
  const showInfoboxInline = isMobile || isTablet;
  const isEntityPage = page.type === "entity" || page.type === "era";
  const entityIdForTimeline = isEntityPage ? page.id : null;
  const narrativeEvents = useEntityNarrativeEvents(entityIdForTimeline);
  const narrativeLoading = useEntityNarrativeLoading(entityIdForTimeline);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [activeImage, setActiveImage] = useState<{
    url: string;
    title: string;
    summary?: string;
  } | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [hoveredBacklink, setHoveredBacklink] = useState<{
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Handle entity link hover with delay to prevent flicker
  const handleEntityHoverEnter = useCallback((id: string, e: React.MouseEvent) => {
    // Capture position immediately - React synthetic events are pooled
    const x = e.clientX;
    const y = e.clientY;

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredBacklink({
        id,
        position: { x, y },
      });
    }, 200); // 200ms delay before showing preview
  }, []);

  const handleEntityHoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredBacklink(null);
  }, []);

  // Clear hover when clicking to navigate
  const handleEntityClick = useCallback(
    (entityId: string) => {
      handleEntityHoverLeave();
      onNavigateToEntity(entityId);
    },
    [handleEntityHoverLeave, onNavigateToEntity]
  );

  // Get hovered entity data for preview
  const hoveredEntity = useMemo(() => {
    if (!hoveredBacklink) return null;
    return entityIndex.get(hoveredBacklink.id) || null;
  }, [hoveredBacklink, entityIndex]);

  // Get summary for hovered entity
  const hoveredSummary = useMemo(() => {
    if (!hoveredBacklink) return undefined;
    const page = pages.find((p) => p.id === hoveredBacklink.id);
    return page?.content?.summary;
  }, [hoveredBacklink, pages]);

  // Load image for hovered entity on demand
  const hoveredImageId = hoveredEntity?.enrichment?.image?.imageId;
  const { url: hoveredImageUrl } = useImageUrl(hoveredImageId);

  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const imageIdToEntityId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entity of entityIndex.values()) {
      const imageId = entity.enrichment?.image?.imageId;
      if (imageId && !map.has(imageId)) {
        map.set(imageId, entity.id);
      }
    }
    return map;
  }, [entityIndex]);

  const resolveImageDetails = useCallback(
    ({
      entityId,
      imageId,
      caption,
      fallbackTitle,
      fallbackSummary,
      suppressSummaryFallback,
      captionOnly,
    }: {
      entityId?: string;
      imageId?: string;
      caption?: string;
      fallbackTitle?: string;
      fallbackSummary?: string;
      suppressSummaryFallback?: boolean;
      captionOnly?: boolean;
    }) => {
      if (captionOnly) {
        return { title: caption || "", summary: "" };
      }
      let resolvedEntityId = entityId;
      if (!resolvedEntityId && imageId) {
        resolvedEntityId = imageIdToEntityId.get(imageId);
      }

      let title = "";
      let summary = "";

      if (resolvedEntityId) {
        const entity = entityIndex.get(resolvedEntityId);
        const entityPage = pageById.get(resolvedEntityId);
        title = entity?.name || entityPage?.title || "";
        summary = entityPage?.content.summary || "";
      }

      if (!title) {
        title = fallbackTitle || caption || page.title;
      }
      if (!summary) {
        if (suppressSummaryFallback) {
          summary = fallbackSummary || caption || "";
        } else {
          summary = fallbackSummary || page.content.summary || caption || "";
        }
      }

      return { title, summary };
    },
    [imageIdToEntityId, entityIndex, pageById, page.content.summary, page.title]
  );

  const openImageModal = useCallback(
    (
      imageUrl: string,
      info: {
        entityId?: string;
        imageId?: string;
        caption?: string;
        fallbackTitle?: string;
        fallbackSummary?: string;
        suppressSummaryFallback?: boolean;
        captionOnly?: boolean;
      }
    ) => {
      if (!imageUrl) return;
      const { title, summary } = resolveImageDetails(info);
      setActiveImage({ url: imageUrl, title, summary });
    },
    [resolveImageDetails]
  );

  const closeImageModal = useCallback(() => {
    setActiveImage(null);
  }, []);

  const handleInlineImageOpen = useCallback(
    async (thumbUrl: string, image: WikiSectionImage) => {
      // Try to load full-size image for lightbox, fall back to thumbnail
      let fullUrl = thumbUrl;
      if (image.imageId) {
        try {
          const loaded = await useImageStore.getState().loadUrl(image.imageId, "full");
          if (loaded) fullUrl = loaded;
        } catch {
          // Fall back to thumbnail
        }
      }
      openImageModal(fullUrl, {
        entityId: image.entityId,
        imageId: image.imageId,
        caption: image.caption,
        suppressSummaryFallback: image.type === "chronicle_image",
        captionOnly: image.type === "chronicle_image",
      });
    },
    [openImageModal]
  );

  // Build seed data for chronicle pages
  const seedData = useMemo((): ChronicleSeedData | null => {
    if (page.type !== "chronicle" || !page.chronicle) return null;
    const chronicle = page.chronicle;
    if (!chronicle.narrativeStyleId && !chronicle.roleAssignments?.length) return null;

    // Get entrypoint name
    const entrypoint = chronicle.entrypointId ? entityIndex.get(chronicle.entrypointId) : undefined;

    return {
      narrativeStyleId: chronicle.narrativeStyleId || "",
      entrypointId: chronicle.entrypointId,
      entrypointName: entrypoint?.name,
      roleAssignments: chronicle.roleAssignments || [],
      selectedEventIds: chronicle.selectedEventIds || [],
      selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
      temporalContext: chronicle.temporalContext,
    };
  }, [page, entityIndex]);

  // Compute backlinks
  const chronicleLinks = useMemo(() => {
    return pages.filter(
      (p) =>
        p.type === "chronicle" &&
        p.chronicle &&
        p.id !== page.id &&
        p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  // Era narrative source chronicle pages (resolved from IDs)
  const sourceChronicleLinks = useMemo(() => {
    const ids = page.eraNarrative?.sourceChronicleIds;
    if (!ids || ids.length === 0) return [];
    return ids.map((id) => pages.find((p) => p.id === id)).filter((p): p is WikiPage => p != null);
  }, [pages, page.eraNarrative?.sourceChronicleIds]);

  const backlinks = useMemo(() => {
    return pages.filter(
      (p) =>
        p.id !== page.id &&
        p.type !== "chronicle" &&
        p.type !== "category" &&
        p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  // Build name to ID map for link resolution (entities + static pages)
  // Use Unicode NFC normalization to ensure consistent string comparison
  // (important for names with special characters like ☽, ~, accents, etc.)
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    // Add entity names
    for (const [id, entity] of entityIndex) {
      map.set(entity.name.toLowerCase().normalize("NFC"), id);
    }
    // Add static page titles (full title and base name without namespace)
    for (const p of pages) {
      if (p.type !== "static") continue;
      const titleLower = p.title.toLowerCase().normalize("NFC");
      if (!map.has(titleLower)) {
        map.set(titleLower, p.id);
      }
      // Also add base name (e.g., "The Berg" from "World:The Berg")
      const colonIdx = p.title.indexOf(":");
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title
          .slice(colonIdx + 1)
          .trim()
          .toLowerCase()
          .normalize("NFC");
        if (baseName && !map.has(baseName)) {
          map.set(baseName, p.id);
        }
      }
    }
    return map;
  }, [entityIndex, pages]);

  const aliasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of pages) {
      if (candidate.type !== "entity" || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        // Use Unicode NFC normalization for consistent string comparison
        const normalized = alias.toLowerCase().trim().normalize("NFC");
        if (!normalized || entityNameMap.has(normalized)) continue;
        if (!map.has(normalized)) {
          map.set(normalized, candidate.id);
        }
      }
    }
    return map;
  }, [pages, entityNameMap]);

  // Build linkable names for auto-linking (used by applyWikiLinks)
  const linkableNames = useMemo(() => {
    const names: Array<{ name: string; id: string }> = [];
    // Add entity names
    for (const [id, entity] of entityIndex) {
      names.push({ name: entity.name, id });
    }
    // Add entity aliases
    for (const candidate of pages) {
      if (candidate.type !== "entity" || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        if (alias.length >= 3) {
          names.push({ name: alias, id: candidate.id });
        }
      }
    }
    // Add static page names (full title and base name)
    for (const p of pages) {
      if (p.type !== "static") continue;
      names.push({ name: p.title, id: p.id });
      const colonIdx = p.title.indexOf(":");
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim();
        if (baseName && baseName !== p.title) {
          names.push({ name: baseName, id: p.id });
        }
      }
    }
    return names;
  }, [entityIndex, pages]);

  const infoboxEntity = entityIndex.get(page.id);
  const infoboxImageId = infoboxEntity?.enrichment?.image?.imageId;
  const { url: infoboxImageUrl } = useImageUrl(infoboxImageId);
  const infoboxMetadataMap = useImageMetadata(infoboxImageId ? [infoboxImageId] : []);
  const infoboxMetadata = infoboxImageId ? infoboxMetadataMap.get(infoboxImageId) : undefined;
  const infoboxImageAspect = infoboxMetadata?.aspect;

  // State for detected aspect (fallback when metadata is missing)
  const [detectedAspect, setDetectedAspect] = useState<ImageAspect | undefined>(undefined);

  // Effective aspect: use metadata if available, otherwise use detected
  const effectiveAspect = infoboxImageAspect || detectedAspect;

  // Handle image load to detect aspect for images without metadata
  const handleInfoboxImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!infoboxImageAspect) {
        const img = e.currentTarget;
        const detected = classifyAspect(img.naturalWidth, img.naturalHeight);
        setDetectedAspect(detected);
      }
    },
    [infoboxImageAspect]
  );

  // Reset detected aspect when page changes
  useEffect(() => {
    setDetectedAspect(undefined);
  }, [page.id]);

  // Handle infobox image click - load full-size for lightbox
  const handleInfoboxImageClick = useCallback(async () => {
    if (!infoboxImageUrl) return;
    const entityId = entityIndex.has(page.id) ? page.id : undefined;
    // Try to load full-size image for lightbox
    let fullUrl = infoboxImageUrl;
    if (entityId && infoboxImageId) {
      try {
        const loaded = await useImageStore.getState().loadUrl(infoboxImageId, "full");
        if (loaded) fullUrl = loaded;
      } catch {
        // Fall back to infobox image path
      }
    }
    openImageModal(fullUrl, {
      entityId,
      fallbackTitle: page.title,
      fallbackSummary: page.content.summary,
    });
  }, [
    infoboxImageUrl,
    infoboxImageId,
    entityIndex,
    page.id,
    page.title,
    page.content.summary,
    openImageModal,
  ]);

  const isChronicle = page.type === "chronicle";
  const isEraNarrative = page.type === "era_narrative";
  const isLongFormProse = isChronicle || isEraNarrative;

  const staticTitle = useMemo(() => {
    if (page.type !== "static") {
      return { namespace: null as string | null, baseName: page.title, displayTitle: page.title };
    }
    const colonIdx = page.title.indexOf(":");
    if (colonIdx > 0 && colonIdx < page.title.length - 1) {
      const namespace = page.title.slice(0, colonIdx).trim();
      const baseName = page.title.slice(colonIdx + 1).trim();
      return {
        namespace: namespace || null,
        baseName: baseName || page.title,
        displayTitle: baseName || page.title,
      };
    }
    return { namespace: null, baseName: page.title, displayTitle: page.title };
  }, [page.title, page.type]);

  return (
    <div className={styles.container}>
      {/* Breadcrumbs - always above everything including hero */}
      <div className={styles.breadcrumbs}>
        <span className={styles.breadcrumbLink} onClick={() => onNavigate("")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
          Home
        </span>
        {" / "}
        <span>
          {(() => {
            if (page.type === "static") return staticTitle.namespace || "Pages";
            if (page.type === "category") return "Categories";
            if (page.type === "chronicle") return "Chronicles";
            if (page.type === "era_narrative") return "Era Narratives";
            return page.type;
          })()}
        </span>
        {" / "}
        <span className={styles.breadcrumbCurrent}>
          {page.type === "static" ? staticTitle.baseName : page.title}
        </span>
      </div>

      {/* Chronicle/era narrative hero banner with cover image */}
      {isLongFormProse && page.content.coverImageId && (
        <CoverHeroImage
          imageId={page.content.coverImageId}
          title={page.title}
          onOpen={(url) => setActiveImage({ url, title: page.title })}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        {/* Chronicle/era narrative title: centered display serif (skip if already in hero) */}
        {isLongFormProse && !page.content.coverImageId && (
          <h1 className={styles.chronicleTitle}>{page.title}</h1>
        )}
        {/* Era narrative subtitle */}
        {isEraNarrative && page.eraNarrative && (
          <div className={styles.eraNarrativeSubtitle}>
            Era Narrative (synthetic) · {page.eraNarrative.tone}
          </div>
        )}
        {/* Non-chronicle, non-era-narrative title: standard */}
        {!isLongFormProse && (
          <h1 className={styles.title}>
            {page.type === "static" ? staticTitle.displayTitle : page.title}
          </h1>
        )}

        {/* Disambiguation notice - Wikipedia-style hatnote */}
        {disambiguation && disambiguation.length > 0 && (
          <div className={styles.disambiguationNotice}>
            This page is about the{" "}
            {(() => {
              if (page.type === "entity" || page.type === "era") {
                return entityIndex.get(page.id)?.kind || page.type;
              }
              if (page.type === "era_narrative") return "era narrative";
              if (page.type === "static") {
                return page.title.includes(":") ? page.title.split(":")[0].toLowerCase() : "page";
              }
              return page.type;
            })()}
            . See also:
            {disambiguation
              .filter((d) => d.pageId !== page.id)
              .map((d, i, arr) => (
                <span key={d.pageId}>
                  <span className={styles.disambiguationLink} onClick={() => onNavigate(d.pageId)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
                    {d.title}
                  </span>
                  {i < arr.length - 1 && ","}
                </span>
              ))}
          </div>
        )}

        {/* Summary + cover image for non-chronicle, non-era-narrative, non-static pages only */}
        {!isLongFormProse && page.type !== "static" && page.content.summary && (
          <div className={styles.summary}>
            {page.content.coverImageId && (
              <ChronicleImage
                image={{
                  refId: "cover",
                  type: "chronicle_image",
                  imageId: page.content.coverImageId,
                  anchorText: "",
                  size: "medium",
                  justification: "left",
                  caption: page.title,
                }}
                onOpen={(url, img) => setActiveImage({ url, title: img.caption || page.title })}
              />
            )}
            {page.content.summary}
            {page.content.coverImageId && <div className={styles.clearfix} />}
          </div>
        )}
        {/* Generation context button for non-chronicle pages only */}
        {!isChronicle && seedData && (
          <button className={styles.seedButton} onClick={() => setShowSeedModal(true)}>
            View Generation Context
          </button>
        )}
      </div>

      <div className={showInfoboxInline ? styles.contentColumn : styles.content}>
        {/* Infobox - inline on mobile/tablet (rendered first, above content) */}
        {showInfoboxInline && page.content.infobox && (
          <div className={styles.infoboxInline}>
            <FrostEdge className={styles.frostEdge} />
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImageUrl && (
              <img
                src={infoboxImageUrl}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, isMobile)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                onClick={() => void handleInfoboxImageClick()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void handleInfoboxImageClick(); }}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {(() => {
                      const displayValue = Array.isArray(field.value) ? field.value.join(", ") : field.value;
                      return field.linkedEntity ? (
                        <span
                          className={styles.entityLink}
                          onClick={() => onNavigateToEntity(field.linkedEntity!)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                        >
                          {displayValue}
                        </span>
                      ) : (
                        displayValue
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infobox - floated on desktop (must precede main content in DOM for float) */}
        {!showInfoboxInline && page.content.infobox && (
          <div className={styles.infobox}>
            <FrostEdge className={styles.frostEdge} />
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImageUrl && (
              <img
                src={infoboxImageUrl}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, false)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
                onClick={() => void handleInfoboxImageClick()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void handleInfoboxImageClick(); }}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {(() => {
                      const displayValue = Array.isArray(field.value) ? field.value.join(", ") : field.value;
                      return field.linkedEntity ? (
                        <span
                          className={styles.entityLink}
                          onClick={() => onNavigateToEntity(field.linkedEntity!)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                        >
                          {displayValue}
                        </span>
                      ) : (
                        displayValue
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={styles.main}>
          {/* Table of Contents (if > 2 sections) */}
          {page.content.sections.length > 2 && (
            <div className={styles.toc}>
              <div className={styles.tocTitle}>Contents</div>
              {page.content.sections.map((section, i) => (
                <button
                  key={section.id}
                  className={styles.tocItem}
                  // eslint-disable-next-line local/no-inline-styles -- dynamic indent depth per section level
                  style={{ "--toc-indent": `${(section.level - 1) * 16}px` } as React.CSSProperties}
                  onClick={() => {
                    const el = document.getElementById(section.id);
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {i + 1}. {section.heading}
                </button>
              ))}
            </div>
          )}

          {/* Sections */}
          <div
            className={
              [isLongFormProse ? styles.chronicleBody : "", layoutOverride?.customClass || ""].filter(Boolean).join(" ") ||
              undefined
            }
            data-style={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
            data-content-width={layoutOverride?.contentWidth}
            data-text-align={layoutOverride?.textAlign}
            {...(() => {
              // Dropcap: override wins, then heuristic
              if (layoutOverride?.dropcap === false) return {};
              if (layoutOverride?.dropcap === true) return { "data-dropcap": "" };
              if (isLongFormProse && page.content.sections[0]?.content) {
                const stripped = page.content.sections[0].content.replace(/^[\s*_#>]+/, "");
                if (/^[a-zA-Z]/.test(stripped) && !/^[IVXLCDM]+\.\s/.test(stripped)) {
                  return { "data-dropcap": "" };
                }
              }
              return {};
            })()}
          >
            {page.content.sections.map((section, sectionIndex) => (
              <React.Fragment key={section.id}>
                {/* Chronicle gallery inserted before Relationships */}
                {section.heading === "Relationships" && sourceChronicleLinks.length > 0 && (
                  <ChronicleGallery
                    title="Source Chronicles"
                    links={sourceChronicleLinks}
                    onNavigate={onNavigate}
                  />
                )}
                {section.heading === "Relationships" && chronicleLinks.length > 0 && (
                  <ChronicleGallery
                    title="Chronicles"
                    links={chronicleLinks}
                    onNavigate={onNavigate}
                  />
                )}
                <div id={section.id} className={styles.section}>
                  {/* Hide default "Chronicle"/"Narrative" heading on long-form prose pages */}
                  {!(
                    isLongFormProse &&
                    (section.heading === "Chronicle" || section.heading === "Narrative")
                  ) && (
                    <>
                      <h2 className={styles.sectionHeading}>{section.heading}</h2>
                      <SectionDivider className={styles.sectionDividerSvg} />
                    </>
                  )}
                  <SectionWithImages
                    section={section}
                    entityNameMap={entityNameMap}
                    aliasMap={aliasMap}
                    linkableNames={linkableNames}
                    onNavigate={handleEntityClick}
                    onHoverEnter={handleEntityHoverEnter}
                    onHoverLeave={handleEntityHoverLeave}
                    onImageOpen={(url, img) => void handleInlineImageOpen(url, img)}
                    historianNotes={page.content.historianNotes}
                    isFirstChronicleSection={isLongFormProse && sectionIndex === 0}
                    narrativeStyleId={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
                    layoutOverride={layoutOverride}
                  />
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Chronicle galleries for pages without a Relationships section */}
          {!page.content.sections.some((s) => s.heading === "Relationships") && (
            <>
              {sourceChronicleLinks.length > 0 && (
                <ChronicleGallery
                  title="Source Chronicles"
                  links={sourceChronicleLinks}
                  onNavigate={onNavigate}
                />
              )}
              {chronicleLinks.length > 0 && (
                <ChronicleGallery
                  title="Chronicles"
                  links={chronicleLinks}
                  onNavigate={onNavigate}
                />
              )}
            </>
          )}

          {isEntityPage && (
            <div id="timeline" className={styles.section}>
              <button
                className={styles.sectionHeadingToggle}
                onClick={() => setTimelineOpen((o) => !o)}
              >
                <span className={timelineOpen ? styles.expandArrowOpen : styles.expandArrow}>
                  ▶
                </span>
                <h2 className={styles.sectionHeading}>Timeline</h2>
              </button>
              <SectionDivider className={styles.sectionDividerSvg} />
              {timelineOpen && (
                <>
                  <ProminenceTimeline
                    events={narrativeEvents}
                    entityId={page.id}
                    prominenceScale={prominenceScale}
                  />
                  <EntityTimeline
                    events={narrativeEvents}
                    entityId={page.id}
                    entityIndex={entityIndex}
                    onNavigate={handleEntityClick}
                    onHoverEnter={handleEntityHoverEnter}
                    onHoverLeave={handleEntityHoverLeave}
                    loading={narrativeLoading}
                  />
                </>
              )}
            </div>
          )}

          {/* Unmatched historian notes (not anchored to any section) */}
          {page.content.historianNotes &&
            page.content.historianNotes.length > 0 &&
            (() => {
              const allSectionContent = page.content.sections.map((s) => s.content).join("\n");
              const unmatched = page.content.historianNotes.filter(
                (n) => !resolveAnchorPhrase(n.anchorPhrase, allSectionContent)
              );
              if (unmatched.length === 0) return null;
              return (
                <div className={styles.unmatchedNotesSection}>
                  <div className={styles.unmatchedNotesHeading}>Historian&apos;s Notes</div>
                  {unmatched.map((note) => {
                    const color =
                      HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
                    const icon = HISTORIAN_NOTE_ICONS[note.type] || "✦";
                    const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
                    return (
                      <div
                        key={note.noteId}
                        className={styles.unmatchedNoteCard}
                        // eslint-disable-next-line local/no-inline-styles -- dynamic color per note type
                        style={{ "--note-color": color } as React.CSSProperties}
                      >
                        <div className={styles.noteTypeLabel}>
                          {icon} {label}
                        </div>
                        {note.text}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className={styles.backlinks}>
              <FrostEdge className={styles.frostEdgeDivider} />
              <div className={styles.backlinksTitle}>What links here ({backlinks.length})</div>
              {backlinks.slice(0, 20).map((link) => (
                <button
                  key={link.id}
                  className={styles.backlinkItem}
                  onClick={() => onNavigate(link.id)}
                >
                  {link.title}
                </button>
              ))}
              {backlinks.length > 20 && (
                <div className={styles.moreText}>...and {backlinks.length - 20} more</div>
              )}
            </div>
          )}

          {/* Categories */}
          {page.categories.length > 0 && (
            <div className={styles.categories}>
              <div className={styles.categoriesLabel}>Categories:</div>
              {page.categories.map((catId) => (
                <button
                  key={catId}
                  className={styles.categoryTag}
                  onClick={() => onNavigate(`category-${catId}`)}
                >
                  {formatCategoryName(catId)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generation Context Modal */}
      {seedData && (
        <SeedModal
          isOpen={showSeedModal}
          onClose={() => setShowSeedModal(false)}
          seed={seedData}
          title="Generation Context"
        />
      )}

      <ImageLightbox
        isOpen={Boolean(activeImage)}
        imageUrl={activeImage?.url || null}
        title={activeImage?.title || ""}
        summary={activeImage?.summary}
        onClose={closeImageModal}
      />

      {/* Entity Preview Card (hover) */}
      {hoveredBacklink && hoveredEntity && (
        <EntityPreviewCard
          entity={hoveredEntity}
          summary={hoveredSummary}
          position={hoveredBacklink.position}
          imageUrl={hoveredImageUrl}
          prominenceScale={prominenceScale}
        />
      )}
    </div>
  );
}

function formatCategoryName(catId: string): string {
  const parts = catId.split("-");
  if (parts.length >= 2) {
    const value = parts.slice(1).join("-");
    return value.replace(/_/g, " ");
  }
  return catId.replace(/_/g, " ");
}
