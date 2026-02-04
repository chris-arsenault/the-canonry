/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { WikiPage, WikiSection, WikiSectionImage, WikiHistorianNote, HardState, DisambiguationEntry, ImageAspect } from '../types/world.ts';
import { useImageUrl, useImageMetadata, useImageStore } from '@penguin-tales/image-store';
import { useEntityNarrativeEvents, useNarrativeLoading } from '@penguin-tales/narrative-store';
import { SeedModal, type ChronicleSeedData } from './ChronicleSeedViewer.tsx';
import { applyWikiLinks } from '../lib/wikiBuilder.ts';
import { resolveAnchorPhrase } from '../lib/fuzzyAnchor.ts';
import EntityTimeline from './EntityTimeline.tsx';
import ProminenceTimeline from './ProminenceTimeline.tsx';
import ImageLightbox from './ImageLightbox.tsx';
import { prominenceLabelFromScale, type ProminenceScale } from '@canonry/world-schema';
import styles from './WikiPage.module.css';

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
type LayoutMode = 'flow' | 'margin' | 'centered';

/** Narrative styles that use centered/verse layout */
const CENTERED_STYLES = new Set([
  'folk-song', 'nursery-rhymes', 'haiku-collection',
]);

/** Narrative styles where floats shouldn't interrupt text */
const NO_FLOAT_STYLES = new Set([
  'wanted-notice', 'sacred-text', 'tavern-notices',
  'interrogation-record', 'diplomatic-accord',
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
  narrativeStyleId?: string,
): LayoutMode {
  const imageCount = (section.images || []).length;
  const floatCount = imageCount + fullNoteCount;

  if (narrativeStyleId && CENTERED_STYLES.has(narrativeStyleId)) {
    return floatCount > 0 ? 'margin' : 'centered';
  }
  if (narrativeStyleId && NO_FLOAT_STYLES.has(narrativeStyleId)) {
    return floatCount > 0 ? 'margin' : 'flow';
  }

  if (floatCount === 0) return 'flow';

  const wordCount = section.content.split(/\s+/).length;

  // Short content with float elements → margin to avoid awkward wrapping
  if (wordCount < 150) return 'margin';

  // High float density → margin to avoid float collisions
  if (wordCount / floatCount < 100) return 'margin';

  return 'flow';
}

/**
 * Check if image size is a float (small/medium) vs block (large/full-width)
 */
function isFloatImage(size: WikiSectionImage['size']): boolean {
  return size === 'small' || size === 'medium' || size === 'large';
}

/**
 * Get the combined className for an image in flow layout mode.
 * Float images (small/medium/large): thumb frame + size width
 * Block images (full-width): centered block style
 */
function getImageClassName(size: WikiSectionImage['size'], position: 'left' | 'right' = 'left'): string {
  const isFloat = isFloatImage(size);

  if (isFloat) {
    const thumbClass = position === 'left' ? styles.imageThumbLeft : styles.imageThumbRight;
    const sizeClass = size === 'small'
      ? styles.imageSmall
      : size === 'medium'
      ? styles.imageMedium
      : styles.imageLarge;
    return `${thumbClass} ${sizeClass}`;
  }

  // Block images
  if (size === 'full-width') return styles.imageFullWidth;
  const alignClass = position === 'right' ? styles.imageLargeRight : styles.imageLargeLeft;
  return `${styles.imageLarge} ${alignClass}`;
}


/**
 * Classify aspect ratio from width/height (for runtime detection fallback)
 */
function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
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
  const suffix = isMobile ? 'Mobile' : '';
  switch (aspect) {
    case 'portrait':
      return styles[`infoboxImagePortrait${suffix}`] || styles.infoboxImagePortrait;
    case 'landscape':
      return styles[`infoboxImageLandscape${suffix}`] || styles.infoboxImageLandscape;
    case 'square':
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
  layoutMode = 'flow',
}: {
  image: WikiSectionImage;
  onOpen?: (imageUrl: string, image: WikiSectionImage) => void;
  layoutMode?: LayoutMode;
}) {
  const { url: imageUrl, loading } = useImageUrl(image.imageId);
  const [error, setError] = useState(false);

  const imageClassName = layoutMode === 'margin'
    ? styles.marginImage
    : getImageClassName(image.size, image.justification || 'left');

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
        alt={image.caption || 'Chronicle illustration'}
        className={styles.figureImage}
        onError={() => setError(true)}
        onClick={() => onOpen?.(imageUrl, image)}
      />
      {image.caption && (
        <figcaption className={styles.imageCaption}>{image.caption}</figcaption>
      )}
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
}: {
  imageId: string;
  title: string;
  onOpen?: (imageUrl: string) => void;
}) {
  const { url: imageUrl, loading } = useImageUrl(imageId);
  const [error, setError] = useState(false);

  if (loading || error || !imageUrl) return null;

  return (
    <div className={styles.coverHero}>
      <img
        src={imageUrl}
        alt={title}
        className={styles.coverHeroImage}
        onError={() => setError(true)}
        onClick={() => onOpen?.(imageUrl)}
        style={{ cursor: onOpen ? 'zoom-in' : undefined }}
      />
      <div className={styles.coverHeroOverlay}>
        <h1 className={styles.chronicleTitleHero}>{title}</h1>
      </div>
    </div>
  );
}

// ============================================================================
// Historian Callouts
// ============================================================================

const HISTORIAN_NOTE_COLORS: Record<string, string> = {
  commentary: '#c49a5c',
  correction: '#c0392b',
  tangent: '#8b7355',
  skepticism: '#d4a017',
  pedantic: '#5b7a5e',
};

const HISTORIAN_NOTE_ICONS: Record<string, string> = {
  commentary: '✦',
  correction: '!',
  tangent: '~',
  skepticism: '?',
  pedantic: '#',
};

const HISTORIAN_NOTE_LABELS: Record<string, string> = {
  commentary: 'Commentary',
  correction: 'Correction',
  tangent: 'Tangent',
  skepticism: 'Skepticism',
  pedantic: 'Pedantic',
};

/**
 * Inject footnote-style superscript markers into markdown content for POPOUT notes only.
 * Returns the modified content and the ordered list of matched notes (for tooltip lookup).
 */
function injectPopoutFootnotes(
  content: string,
  notes: WikiHistorianNote[],
): { content: string; orderedNotes: WikiHistorianNote[] } {
  const popout = (notes || []).filter(n => n.display === 'popout');
  if (popout.length === 0) return { content, orderedNotes: [] };

  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number }> = [];
  for (const note of popout) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    if (match) {
      resolved.push({ note, index: match.index, phraseLen: match.phrase.length });
    }
  }
  resolved.sort((a, b) => a.index - b.index);

  const orderedNotes = resolved.map(r => r.note);

  let result = content;
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { index, phraseLen } = resolved[i];
    const insertAt = index + phraseLen;
    const sup = `<sup class="historian-fn" data-note-idx="${i}" style="color:${HISTORIAN_NOTE_COLORS[resolved[i].note.type] || '#8b7355'};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${i + 1}</sup>`;
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return { content: result, orderedNotes };
}

/**
 * Inject popout footnotes into a text slice using global indices from orderedNotes.
 */
function injectPopoutFootnotesWithGlobalIndex(
  slice: string,
  allNotes: WikiHistorianNote[],
  orderedNotes: WikiHistorianNote[],
): string {
  const popout = (allNotes || []).filter(n => n.display === 'popout');
  if (popout.length === 0) return slice;

  const resolved: Array<{ note: WikiHistorianNote; index: number; phraseLen: number; globalIdx: number }> = [];
  for (const note of popout) {
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
    const sup = `<sup class="historian-fn" data-note-idx="${globalIdx}" style="color:${HISTORIAN_NOTE_COLORS[note.type] || '#8b7355'};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${globalIdx + 1}</sup>`;
    result = result.slice(0, insertAt) + sup + result.slice(insertAt);
  }

  return result;
}

/**
 * HistorianCallout - Callout box for 'full' display notes.
 * - 'flow': Floated right, text wraps around
 * - 'margin': Compact callout for side column in 3-column grid
 */
function HistorianCallout({ note, layoutMode = 'flow' }: { note: WikiHistorianNote; layoutMode?: LayoutMode }) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || '✦';
  const label = HISTORIAN_NOTE_LABELS[note.type] || 'Commentary';

  if (layoutMode === 'margin') {
    return (
      <aside className={styles.marginCallout} style={{ borderLeftColor: color }}>
        <div className={styles.marginCalloutLabel} style={{ color }}>
          {icon} {label}
        </div>
        {note.text}
      </aside>
    );
  }

  // Flow mode: floated right with inline styles
  return (
    <aside style={{
      float: 'right',
      clear: 'right',
      width: '300px',
      margin: '4px -40px 8px 20px',
      padding: '14px 16px',
      background: 'rgba(196, 154, 92, 0.06)',
      borderLeft: `3px solid ${color}`,
      borderRadius: '0 4px 4px 0',
      fontSize: '14px',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      color: 'var(--color-text-secondary, #c4b99a)',
      lineHeight: '1.7',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '6px',
        fontStyle: 'normal',
        fontFamily: 'var(--font-family-ui, system-ui, sans-serif)',
      }}>
        {icon} {label}
      </div>
      {note.text}
    </aside>
  );
}

/**
 * HistorianFootnoteTooltip - Positioned callout box shown on hover of footnote markers
 */
function HistorianFootnoteTooltip({ note, position }: { note: WikiHistorianNote; position: { x: number; y: number } }) {
  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
  const icon = HISTORIAN_NOTE_ICONS[note.type] || '✦';
  const label = HISTORIAN_NOTE_LABELS[note.type] || 'Commentary';

  // Position below the footnote marker
  const tooltipWidth = 340;
  let left = position.x - tooltipWidth / 2;
  if (left < 10) left = 10;
  if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;

  return (
    <div style={{
      position: 'fixed',
      left,
      top: position.y + 8,
      width: tooltipWidth,
      padding: '12px 16px',
      background: 'var(--color-bg-elevated, #3a3228)',
      borderLeft: `3px solid ${color}`,
      borderRadius: '0 4px 4px 0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      fontSize: '14px',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontStyle: 'italic',
      color: 'var(--color-text-secondary, #c4b99a)',
      lineHeight: '1.7',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '6px',
        fontStyle: 'normal',
        fontFamily: 'var(--font-family-ui, system-ui, sans-serif)',
      }}>
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
}: {
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
}) {
  const images = section.images || [];
  const content = section.content;
  const allNotes = historianNotes || [];

  // Inject popout footnote markers into content (popout notes only)
  const { content: annotatedContent, orderedNotes } = useMemo(
    () => injectPopoutFootnotes(content, allNotes),
    [content, allNotes],
  );

  // Resolve full-display notes to positions for fragment insertion
  const fullNoteInserts = useMemo(() => {
    const full = allNotes.filter(n => n.display === 'full');
    if (full.length === 0) return [];
    return full
      .map(n => {
        const match = resolveAnchorPhrase(n.anchorPhrase, content);
        if (!match) return null;
        return { note: n, position: match.index + match.phrase.length };
      })
      .filter((x): x is { note: WikiHistorianNote; position: number } => x !== null)
      .sort((a, b) => a.position - b.position);
  }, [allNotes, content]);

  // Determine layout mode based on content analysis
  const layoutMode = useMemo(
    () => analyzeLayout(section, fullNoteInserts.length, narrativeStyleId),
    [section, fullNoteInserts.length, narrativeStyleId],
  );

  // Hover state for popout footnote tooltips
  const [hoveredNote, setHoveredNote] = React.useState<{ note: WikiHistorianNote; pos: { x: number; y: number } } | null>(null);

  const handleFootnoteHover = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'SUP' && target.classList.contains('historian-fn')) {
      const idx = parseInt(target.getAttribute('data-note-idx') || '', 10);
      if (!isNaN(idx) && orderedNotes[idx]) {
        const rect = target.getBoundingClientRect();
        setHoveredNote({ note: orderedNotes[idx], pos: { x: rect.left + rect.width / 2, y: rect.bottom } });
      }
    }
  }, [orderedNotes]);

  const handleFootnoteLeave = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'SUP' && target.classList.contains('historian-fn')) {
      setHoveredNote(null);
    }
  }, []);

  const hasInserts = images.length > 0 || fullNoteInserts.length > 0;

  if (!hasInserts) {
    const wrapperClass = layoutMode === 'centered' ? styles.centeredLayout : undefined;
    return (
      <div className={wrapperClass} onMouseOver={handleFootnoteHover} onMouseOut={handleFootnoteLeave}>
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
        {hoveredNote && <HistorianFootnoteTooltip note={hoveredNote.note} position={hoveredNote.pos} />}
      </div>
    );
  }

  // ── Margin mode: 3-column grid with images/callouts in side margins ──
  if (layoutMode === 'margin') {
    // Distribute images and callouts to left/right margin columns
    type MarginItem =
      | { kind: 'image'; image: WikiSectionImage }
      | { kind: 'callout'; note: WikiHistorianNote };

    const leftItems: MarginItem[] = [];
    const rightItems: MarginItem[] = [];

    // Collect all margin items (images + callouts) then distribute balanced
    const allMarginItems: MarginItem[] = [];
    for (const img of images) {
      allMarginItems.push({ kind: 'image', image: img });
    }
    for (const { note } of fullNoteInserts) {
      allMarginItems.push({ kind: 'callout', note });
    }

    // Distribute: respect explicit image justification, balance everything else
    for (const item of allMarginItems) {
      if (item.kind === 'image' && item.image.justification === 'left') {
        leftItems.push(item);
      } else if (item.kind === 'image' && item.image.justification === 'right') {
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
      <div className={styles.marginLayout} onMouseOver={handleFootnoteHover} onMouseOut={handleFootnoteLeave}>
        <div className={styles.marginLeft}>
          {leftItems.map((item, i) =>
            item.kind === 'image' ? (
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
            item.kind === 'image' ? (
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
                layoutMode="margin"
              />
            )
          )}
        </div>
        {hoveredNote && <HistorianFootnoteTooltip note={hoveredNote.note} position={hoveredNote.pos} />}
      </div>
    );
  }

  // ── Flow mode: fragment-based rendering with floated images/callouts ──

  // Build unified insert list: images + full notes, sorted by position in original content
  type InsertItem =
    | { kind: 'image'; image: WikiSectionImage; position: number }
    | { kind: 'fullNote'; note: WikiHistorianNote; position: number };

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
    insertItems.push({ kind: 'image', image: img, position });
  }

  for (const { note, position } of fullNoteInserts) {
    insertItems.push({ kind: 'fullNote', note, position });
  }

  insertItems.sort((a, b) => a.position - b.position);

  // Build fragments: split original content at paragraph boundaries, then inject
  // popout footnotes into each text slice for consistent numbering
  const fragments: Array<
    | { type: 'text'; content: string }
    | { type: 'image'; image: WikiSectionImage }
    | { type: 'fullNote'; note: WikiHistorianNote }
  > = [];
  let lastIndex = 0;

  for (const item of insertItems) {
    const anchorEnd = item.kind === 'image'
      ? item.position + (item.image.anchorText?.length || 0)
      : item.position;
    const paragraphEnd = content.indexOf('\n\n', anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;

    if (insertPoint > lastIndex) {
      const slice = content.slice(lastIndex, insertPoint);
      const annotated = injectPopoutFootnotesWithGlobalIndex(slice, allNotes, orderedNotes);
      fragments.push({ type: 'text', content: annotated });
    }
    if (item.kind === 'image') {
      fragments.push({ type: 'image', image: item.image });
    } else {
      fragments.push({ type: 'fullNote', note: item.note });
    }
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : insertPoint;
  }

  if (lastIndex < content.length) {
    const slice = content.slice(lastIndex);
    const annotated = injectPopoutFootnotesWithGlobalIndex(slice, allNotes, orderedNotes);
    fragments.push({ type: 'text', content: annotated });
  }

  let firstTextSeen = false;

  return (
    <div className={styles.sectionWithImages} onMouseOver={handleFootnoteHover} onMouseOut={handleFootnoteLeave}>
      {fragments.map((fragment, i) => {
        if (fragment.type === 'image') {
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
                <ChronicleImage
                  image={fragment.image}
                  onOpen={onImageOpen}
                  layoutMode="flow"
                />
              </React.Fragment>
            );
          }
        } else if (fragment.type === 'fullNote') {
          return (
            <HistorianCallout
              key={`fn-${fragment.note.noteId}`}
              note={fragment.note}
              layoutMode="flow"
            />
          );
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
      {hoveredNote && <HistorianFootnoteTooltip note={hoveredNote.note} position={hoveredNote.pos} />}
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
}: EntityPreviewCardProps) {
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
    <div className={styles.previewCard} style={{ left, top }}>
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
          <span className={styles.previewBadgeKind}>
            {entity.kind}
          </span>
          {entity.subtype && (
            <span className={styles.previewBadge}>{entity.subtype}</span>
          )}
          <span className={styles.previewBadgeStatus}>
            {entity.status}
          </span>
          <span className={styles.previewBadge}>
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && (
            <span className={styles.previewBadge}>{entity.culture}</span>
          )}
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
}: {
  content: string;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter?: (pageId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
  isFirstFragment?: boolean;
}) {
  const encodePageIdForHash = useCallback((pageId: string) => {
    return pageId.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }, []);

  // Pre-process content:
  // 1. Apply wiki links to wrap entity names with [[...]]
  // 2. Convert [[Entity Name]] or [[Entity Name|entityId]] to markdown links with proper URLs
  const processedContent = useMemo(() => {
    // First apply wiki links to detect entity names
    const linkedContent = applyWikiLinks(content, linkableNames);
    // Then convert [[...]] to markdown-friendly link format with proper URLs
    // Supports both [[EntityName]] (lookup by name) and [[EntityName|entityId]] (direct ID)
    return linkedContent.replace(/\[\[([^\]]+)\]\]/g, (match, linkContent) => {
      // Support [[EntityName|entityId]] format for ID-based linking
      // This is used by conflux pages where entities may exist in narrativeHistory
      // but not in hardState (entityNameMap is built from hardState)
      const pipeIndex = linkContent.lastIndexOf('|');
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
        const normalized = displayName.toLowerCase().trim().normalize('NFC');
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
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      // Handle #/page/{pageId} format
      if (href?.startsWith('#/page/')) {
        e.preventDefault();
        const pageId = decodeURIComponent(href.slice(7)); // Remove '#/page/'
        onNavigate(pageId);
      }
    }
  }, [onNavigate]);

  // Handle hover on page links
  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    if (!onHoverEnter) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      // Handle #/page/{pageId} format
      if (href?.startsWith('#/page/')) {
        const pageId = decodeURIComponent(href.slice(7));
        onHoverEnter(pageId, e);
      }
    }
  }, [onHoverEnter]);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    if (!onHoverLeave) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href?.startsWith('#/page/')) {
        onHoverLeave();
      }
    }
  }, [onHoverLeave]);

  return (
    <div
      data-color-mode="dark"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      className={styles.markdownSection}
      {...(isFirstFragment ? { 'data-first': '' } : {})}
    >
      <MDEditor.Markdown
        source={processedContent}
        style={{ backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
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
  breakpoint?: 'mobile' | 'tablet' | 'desktop';
}

export default function WikiPageView({
  page,
  pages,
  entityIndex,
  disambiguation,
  onNavigate,
  onNavigateToEntity,
  prominenceScale,
  breakpoint = 'desktop',
}: WikiPageViewProps) {
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const showInfoboxInline = isMobile || isTablet;
  const isEntityPage = page.type === 'entity' || page.type === 'era';
  const narrativeEvents = useEntityNarrativeEvents(isEntityPage ? page.id : null);
  const narrativeLoading = useNarrativeLoading();
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [activeImage, setActiveImage] = useState<{
    url: string;
    title: string;
    summary?: string;
  } | null>(null);
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
  const handleEntityClick = useCallback((entityId: string) => {
    handleEntityHoverLeave();
    onNavigateToEntity(entityId);
  }, [handleEntityHoverLeave, onNavigateToEntity]);

  // Get hovered entity data for preview
  const hoveredEntity = useMemo(() => {
    if (!hoveredBacklink) return null;
    return entityIndex.get(hoveredBacklink.id) || null;
  }, [hoveredBacklink, entityIndex]);

  // Get summary for hovered entity
  const hoveredSummary = useMemo(() => {
    if (!hoveredBacklink) return undefined;
    const page = pages.find(p => p.id === hoveredBacklink.id);
    return page?.content?.summary;
  }, [hoveredBacklink, pages]);

  // Load image for hovered entity on demand
  const hoveredImageId = hoveredEntity?.enrichment?.image?.imageId;
  const { url: hoveredImageUrl } = useImageUrl(hoveredImageId);

  const pageById = useMemo(() => new Map(pages.map(p => [p.id, p])), [pages]);
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

  const resolveImageDetails = useCallback(({
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
      return { title: caption || '', summary: '' };
    }
    let resolvedEntityId = entityId;
    if (!resolvedEntityId && imageId) {
      resolvedEntityId = imageIdToEntityId.get(imageId);
    }

    let title = '';
    let summary = '';

    if (resolvedEntityId) {
      const entity = entityIndex.get(resolvedEntityId);
      const entityPage = pageById.get(resolvedEntityId);
      title = entity?.name || entityPage?.title || '';
      summary = entityPage?.content.summary || '';
    }

    if (!title) {
      title = fallbackTitle || caption || page.title;
    }
    if (!summary) {
      if (suppressSummaryFallback) {
        summary = fallbackSummary || caption || '';
      } else {
        summary = fallbackSummary || page.content.summary || caption || '';
      }
    }

    return { title, summary };
  }, [imageIdToEntityId, entityIndex, pageById, page.content.summary, page.title]);

  const openImageModal = useCallback((imageUrl: string, info: {
    entityId?: string;
    imageId?: string;
    caption?: string;
    fallbackTitle?: string;
    fallbackSummary?: string;
    suppressSummaryFallback?: boolean;
    captionOnly?: boolean;
  }) => {
    if (!imageUrl) return;
    const { title, summary } = resolveImageDetails(info);
    setActiveImage({ url: imageUrl, title, summary });
  }, [resolveImageDetails]);

  const closeImageModal = useCallback(() => {
    setActiveImage(null);
  }, []);

  const handleInlineImageOpen = useCallback(async (thumbUrl: string, image: WikiSectionImage) => {
    // Try to load full-size image for lightbox, fall back to thumbnail
    let fullUrl = thumbUrl;
    if (image.imageId) {
      try {
        const loaded = await useImageStore.getState().loadUrl(image.imageId, 'full');
        if (loaded) fullUrl = loaded;
      } catch {
        // Fall back to thumbnail
      }
    }
    openImageModal(fullUrl, {
      entityId: image.entityId,
      imageId: image.imageId,
      caption: image.caption,
      suppressSummaryFallback: image.type === 'chronicle_image',
      captionOnly: image.type === 'chronicle_image',
    });
  }, [openImageModal]);

  // Build seed data for chronicle pages
  const seedData = useMemo((): ChronicleSeedData | null => {
    if (page.type !== 'chronicle' || !page.chronicle) return null;
    const chronicle = page.chronicle;
    if (!chronicle.narrativeStyleId && !chronicle.roleAssignments?.length) return null;

    // Get entrypoint name
    const entrypoint = chronicle.entrypointId
      ? entityIndex.get(chronicle.entrypointId)
      : undefined;

    return {
      narrativeStyleId: chronicle.narrativeStyleId || '',
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
    return pages.filter(p =>
      p.type === 'chronicle' &&
      p.chronicle &&
      p.id !== page.id &&
      p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  const backlinks = useMemo(() => {
    return pages.filter(p =>
      p.id !== page.id &&
      p.type !== 'chronicle' &&
      p.type !== 'category' &&
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
      map.set(entity.name.toLowerCase().normalize('NFC'), id);
    }
    // Add static page titles (full title and base name without namespace)
    for (const p of pages) {
      if (p.type !== 'static') continue;
      const titleLower = p.title.toLowerCase().normalize('NFC');
      if (!map.has(titleLower)) {
        map.set(titleLower, p.id);
      }
      // Also add base name (e.g., "The Berg" from "World:The Berg")
      const colonIdx = p.title.indexOf(':');
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim().toLowerCase().normalize('NFC');
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
      if (candidate.type !== 'entity' || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        // Use Unicode NFC normalization for consistent string comparison
        const normalized = alias.toLowerCase().trim().normalize('NFC');
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
      if (candidate.type !== 'entity' || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        if (alias.length >= 3) {
          names.push({ name: alias, id: candidate.id });
        }
      }
    }
    // Add static page names (full title and base name)
    for (const p of pages) {
      if (p.type !== 'static') continue;
      names.push({ name: p.title, id: p.id });
      const colonIdx = p.title.indexOf(':');
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
  const handleInfoboxImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!infoboxImageAspect) {
      const img = e.currentTarget;
      const detected = classifyAspect(img.naturalWidth, img.naturalHeight);
      setDetectedAspect(detected);
    }
  }, [infoboxImageAspect]);

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
        const loaded = await useImageStore.getState().loadUrl(infoboxImageId, 'full');
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
  }, [infoboxImageUrl, infoboxImageId, entityIndex, page.id, page.title, page.content.summary, openImageModal]);

  const isChronicle = page.type === 'chronicle';

  const staticTitle = useMemo(() => {
    if (page.type !== 'static') {
      return { namespace: null as string | null, baseName: page.title, displayTitle: page.title };
    }
    const colonIdx = page.title.indexOf(':');
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
        <span
          className={styles.breadcrumbLink}
          onClick={() => onNavigate('')}
        >
          Home
        </span>
        {' / '}
        <span>
          {page.type === 'static'
            ? (staticTitle.namespace || 'Pages')
            : page.type === 'category'
            ? 'Categories'
            : page.type === 'chronicle'
            ? 'Chronicles'
            : page.type === 'conflux'
            ? 'Confluxes'
            : page.type}
        </span>
        {' / '}
        <span className={styles.breadcrumbCurrent}>
          {page.type === 'static' ? staticTitle.baseName : page.title}
        </span>
      </div>

      {/* Chronicle hero banner with cover image */}
      {isChronicle && page.content.coverImageId && (
        <CoverHeroImage
          imageId={page.content.coverImageId}
          title={page.title}
          onOpen={(url) => setActiveImage({ url, title: page.title })}
        />
      )}

      {/* Header */}
      <div className={styles.header}>

        {/* Chronicle title: centered display serif (skip if already in hero) */}
        {isChronicle && !page.content.coverImageId && (
          <h1 className={styles.chronicleTitle}>{page.title}</h1>
        )}
        {/* Non-chronicle title: standard */}
        {!isChronicle && (
          <h1 className={styles.title}>
            {page.type === 'static' ? staticTitle.displayTitle : page.title}
          </h1>
        )}

        {/* Disambiguation notice - Wikipedia-style hatnote */}
        {disambiguation && disambiguation.length > 0 && (
          <div className={styles.disambiguationNotice}>
            This page is about the {
              page.type === 'entity' || page.type === 'era'
                ? (entityIndex.get(page.id)?.kind || page.type)
                : page.type === 'static'
                  ? (page.title.includes(':') ? page.title.split(':')[0].toLowerCase() : 'page')
                  : page.type === 'conflux'
                    ? 'conflux'
                    : page.type
            }.
            {' '}See also:
            {disambiguation
              .filter(d => d.pageId !== page.id)
              .map((d, i, arr) => (
                <span key={d.pageId}>
                  <span
                    className={styles.disambiguationLink}
                    onClick={() => onNavigate(d.pageId)}
                  >
                    {d.title}
                  </span>
                  {i < arr.length - 1 && ','}
                </span>
              ))}
          </div>
        )}

        {/* Summary + cover image for non-chronicle, non-static pages only */}
        {!isChronicle && page.type !== 'static' && page.content.summary && (
          <div className={styles.summary}>
            {page.content.coverImageId && (
              <ChronicleImage
                image={{
                  refId: 'cover',
                  type: 'chronicle_image',
                  imageId: page.content.coverImageId,
                  anchorText: '',
                  size: 'medium',
                  justification: 'left',
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
          <button
            className={styles.seedButton}
            onClick={() => setShowSeedModal(true)}
          >
            View Generation Context
          </button>
        )}
      </div>

      <div className={showInfoboxInline ? styles.contentColumn : styles.content}>
        {/* Infobox - inline on mobile/tablet (rendered first, above content) */}
        {showInfoboxInline && page.content.infobox && (
          <div className={styles.infoboxInline}>
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImageUrl && (
              <img
                src={infoboxImageUrl}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, isMobile)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {field.linkedEntity ? (
                      <span
                        className={styles.entityLink}
                        onClick={() => onNavigateToEntity(field.linkedEntity!)}
                      >
                        {Array.isArray(field.value) ? field.value.join(', ') : field.value}
                      </span>
                    ) : (
                      Array.isArray(field.value) ? field.value.join(', ') : field.value
                    )}
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
                  style={{ paddingLeft: `${(section.level - 1) * 16}px` }}
                  onClick={() => {
                    const el = document.getElementById(section.id);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {i + 1}. {section.heading}
                </button>
              ))}
            </div>
          )}

        {chronicleLinks.length > 0 && (
          <div className={styles.chronicles}>
            <div className={styles.chroniclesTitle}>
              Chronicles ({chronicleLinks.length})
            </div>
            {chronicleLinks.slice(0, 20).map(link => (
              <button
                key={link.id}
                className={styles.chronicleItem}
                onClick={() => onNavigate(link.id)}
              >
                <span>{link.title}</span>
                {link.chronicle?.format && (
                  <span className={styles.chronicleMeta}>
                    {link.chronicle.format === 'document' ? 'Document' : 'Story'}
                  </span>
                )}
              </button>
            ))}
            {chronicleLinks.length > 20 && (
              <div className={styles.moreText}>
                ...and {chronicleLinks.length - 20} more
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        <div
          className={isChronicle ? styles.chronicleBody : undefined}
          data-style={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
          {...(isChronicle && page.content.sections[0]?.content && (() => {
            const stripped = page.content.sections[0].content.replace(/^[\s*_#>]+/, '');
            // Must start with a letter, but not a Roman numeral section marker (e.g. "IV. Title")
            return /^[a-zA-Z]/.test(stripped) && !/^[IVXLCDM]+\.\s/.test(stripped);
          })() ? { 'data-dropcap': '' } : {})}
        >
        {page.content.sections.map((section, sectionIndex) => (
          <div key={section.id} id={section.id} className={styles.section}>
            {/* Hide default "Chronicle" heading on chronicle pages */}
            {!(isChronicle && section.heading === 'Chronicle') && (
              <h2 className={styles.sectionHeading}>{section.heading}</h2>
            )}
            <SectionWithImages
              section={section}
              entityNameMap={entityNameMap}
              aliasMap={aliasMap}
              linkableNames={linkableNames}
              onNavigate={handleEntityClick}
              onHoverEnter={handleEntityHoverEnter}
              onHoverLeave={handleEntityHoverLeave}
              onImageOpen={handleInlineImageOpen}
              historianNotes={page.content.historianNotes}
              isFirstChronicleSection={isChronicle && sectionIndex === 0}
              narrativeStyleId={isChronicle ? page.chronicle?.narrativeStyleId : undefined}
            />
          </div>
        ))}
        </div>

        {isEntityPage && (narrativeLoading || narrativeEvents.length > 0) && (
          <div id="timeline" className={styles.section}>
            <h2 className={styles.sectionHeading}>Timeline</h2>
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
          </div>
        )}

          {/* Unmatched historian notes (not anchored to any section) */}
          {page.content.historianNotes && page.content.historianNotes.length > 0 && (() => {
            const allSectionContent = page.content.sections.map(s => s.content).join('\n');
            const unmatched = page.content.historianNotes.filter(
              n => !resolveAnchorPhrase(n.anchorPhrase, allSectionContent)
            );
            if (unmatched.length === 0) return null;
            return (
              <div style={{ marginTop: '16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent, #c49a5c)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontFamily: 'var(--font-family-ui, system-ui, sans-serif)' }}>
                  Historian's Notes
                </div>
                {unmatched.map(note => {
                  const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
                  const icon = HISTORIAN_NOTE_ICONS[note.type] || '✦';
                  const label = HISTORIAN_NOTE_LABELS[note.type] || 'Commentary';
                  return (
                    <div key={note.noteId} style={{
                      margin: '6px 0 6px 16px', padding: '10px 14px',
                      background: 'rgba(196, 154, 92, 0.06)', borderLeft: `3px solid ${color}`,
                      borderRadius: '0 4px 4px 0', fontSize: '14px',
                      fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic',
                      color: 'var(--color-text-secondary, #c4b99a)', lineHeight: '1.7',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontStyle: 'normal', fontFamily: 'var(--font-family-ui, system-ui, sans-serif)' }}>
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
              <div className={styles.backlinksTitle}>
                What links here ({backlinks.length})
              </div>
              {backlinks.slice(0, 20).map(link => (
                <button
                  key={link.id}
                  className={styles.backlinkItem}
                  onClick={() => onNavigate(link.id)}
                >
                  {link.title}
                </button>
              ))}
              {backlinks.length > 20 && (
                <div className={styles.moreText}>
                  ...and {backlinks.length - 20} more
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {page.categories.length > 0 && (
            <div className={styles.categories}>
              <div className={styles.categoriesLabel}>Categories:</div>
              {page.categories.map(catId => (
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

        {/* Infobox - sidebar on desktop (rendered after main content) */}
        {!showInfoboxInline && page.content.infobox && (
          <div className={styles.infobox}>
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImageUrl && (
              <img
                src={infoboxImageUrl}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, false)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {field.linkedEntity ? (
                      <span
                        className={styles.entityLink}
                        onClick={() => onNavigateToEntity(field.linkedEntity!)}
                      >
                        {Array.isArray(field.value) ? field.value.join(', ') : field.value}
                      </span>
                    ) : (
                      Array.isArray(field.value) ? field.value.join(', ') : field.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        title={activeImage?.title || ''}
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
  const parts = catId.split('-');
  if (parts.length >= 2) {
    const value = parts.slice(1).join('-');
    return value.replace(/_/g, ' ');
  }
  return catId.replace(/_/g, ' ');
}
