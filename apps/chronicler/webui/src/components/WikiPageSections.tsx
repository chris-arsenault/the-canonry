/**
 * WikiPageSections - Section rendering with content-aware layout
 *
 * Handles three layout modes:
 * - 'flow': Float images/callouts, text wraps (Wikipedia style). For long prose.
 * - 'margin': 3-column grid with images/callouts in side margins. For short content.
 * - 'centered': Text centered, no floats. For verse/poetry without images.
 */

import React, { useMemo, useState, useLayoutEffect, useRef, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { WikiSection, WikiSectionImage, WikiHistorianNote, PageLayoutOverride } from "../types/world.ts";
import { analyzeLayout, isFloatImage } from "./WikiPageLayout.ts";
import { ChronicleImage } from "./WikiPageImages.tsx";
import { MarkdownSection } from "./WikiPageMarkdown.tsx";
import { HistorianCallout, HistorianFootnoteTooltip } from "./WikiPageHistorian.tsx";
import {
  HISTORIAN_NOTE_COLORS,
  HISTORIAN_NOTE_ICONS,
  HISTORIAN_NOTE_LABELS,
  injectFootnotes,
  injectFootnotesWithGlobalIndex,
} from "../lib/historianAnnotations.ts";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor.ts";

// ============================================================================
// SectionWithImages helpers
// ============================================================================

type MarginItem =
  | { kind: "image"; image: WikiSectionImage }
  | { kind: "callout"; note: WikiHistorianNote; noteIndex: number };

type FlowFragment =
  | { type: "text"; content: string }
  | { type: "image"; image: WikiSectionImage };

/** Measure DOM sidenote positions and resolve overlapping callouts. */
function computeSidenotePositions(
  container: HTMLElement,
  fullNoteInserts: Array<{ note: WikiHistorianNote; idx: number }>,
): Map<number, number> {
  const containerRect = container.getBoundingClientRect();
  const supPositions = new Map<number, number>();
  container.querySelectorAll("sup.historian-fn[data-note-idx]").forEach((sup) => {
    const idx = parseInt(sup.getAttribute("data-note-idx") || "", 10);
    if (!isNaN(idx) && fullNoteInserts.some((f) => f.idx === idx)) {
      supPositions.set(idx, (sup as HTMLElement).getBoundingClientRect().top - containerRect.top);
    }
  });
  const calloutHeights = new Map<number, number>();
  container.querySelectorAll<HTMLElement>("[data-sidenote-callout-idx]").forEach((el) => {
    const rawIdx = el.getAttribute("data-sidenote-callout-idx");
    const idx = rawIdx ? parseInt(rawIdx, 10) : NaN;
    if (!isNaN(idx)) calloutHeights.set(idx, el.offsetHeight);
  });
  const sorted = [...fullNoteInserts].sort((a, b) => {
    return (supPositions.get(a.idx) ?? 0) - (supPositions.get(b.idx) ?? 0);
  });
  const resolved = new Map<number, number>();
  const GAP = 8;
  let lastBottom = -Infinity;
  for (const { idx } of sorted) {
    let top = supPositions.get(idx) ?? 0;
    if (top < lastBottom + GAP) top = lastBottom + GAP;
    resolved.set(idx, top);
    lastBottom = top + (calloutHeights.get(idx) ?? 80);
  }
  return resolved;
}

/** Distribute images and callouts into left/right margin columns. */
function distributeToMarginColumns(
  images: WikiSectionImage[],
  noteInserts: Array<{ note: WikiHistorianNote; idx: number }>,
): { leftItems: MarginItem[]; rightItems: MarginItem[] } {
  const leftItems: MarginItem[] = [];
  const rightItems: MarginItem[] = [];
  const allItems: MarginItem[] = [
    ...images.map((img) => ({ kind: "image" as const, image: img })),
    ...noteInserts.map(({ note, idx }) => ({ kind: "callout" as const, note, noteIndex: idx })),
  ];
  for (const item of allItems) {
    if (item.kind === "image" && item.image.justification === "left") {
      leftItems.push(item);
    } else if (item.kind === "image" && item.image.justification === "right") {
      rightItems.push(item);
    } else if (leftItems.length <= rightItems.length) {
      leftItems.push(item);
    } else {
      rightItems.push(item);
    }
  }
  return { leftItems, rightItems };
}

/** Resolve the insertion position for an image within content. */
function resolveImagePosition(img: WikiSectionImage, content: string): number {
  const resolved = img.anchorText ? resolveAnchorPhrase(img.anchorText, content) : null;
  if (resolved) return resolved.index;
  if (img.anchorIndex !== undefined && img.anchorIndex < content.length) return img.anchorIndex;
  return content.length;
}

/** Build interleaved text/image fragments for flow layout. */
function buildFlowFragments(
  content: string,
  images: WikiSectionImage[],
  allNotes: WikiHistorianNote[],
  orderedNotes: WikiHistorianNote[],
): FlowFragment[] {
  const insertItems = images
    .map((image) => ({ image, position: resolveImagePosition(image, content) }))
    .sort((a, b) => a.position - b.position);
  const fragments: FlowFragment[] = [];
  let lastIndex = 0;
  for (const item of insertItems) {
    const anchorEnd = item.position + (item.image.anchorText?.length || 0);
    const paragraphEnd = content.indexOf("\n\n", anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;
    if (insertPoint > lastIndex) {
      fragments.push({ type: "text", content: injectFootnotesWithGlobalIndex(content.slice(lastIndex, insertPoint), allNotes, orderedNotes) });
    }
    fragments.push({ type: "image", image: item.image });
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : insertPoint;
  }
  if (lastIndex < content.length) {
    fragments.push({ type: "text", content: injectFootnotesWithGlobalIndex(content.slice(lastIndex), allNotes, orderedNotes) });
  }
  return fragments;
}

// ============================================================================
// Footnote list renderer
// ============================================================================

function FootnoteList({ orderedNotes }: Readonly<{ orderedNotes: WikiHistorianNote[] }>) {
  return (
    <ol className="footnote-list">
      {orderedNotes.map((note) => {
        const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
        const icon = HISTORIAN_NOTE_ICONS[note.type] || "\u2726";
        const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
        return (
          <li
            key={note.noteId}
            className="footnote-item"
            style={{ "--note-color": color } as React.CSSProperties}
          >
            <span className="footnote-label">
              {icon} {label}
            </span>
            <span className="footnote-text">{note.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================================
// Margin column renderer
// ============================================================================

function MarginColumn({ items, prefix, onImageOpen }: Readonly<{
  items: MarginItem[];
  prefix: string;
  onImageOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
}>) {
  return (
    <>
      {items.map((item, i) =>
        item.kind === "image" ? (
          <ChronicleImage
            key={`${prefix}-img-${item.image.refId}-${i}`}
            image={item.image}
            onOpen={onImageOpen}
            layoutMode="margin"
          />
        ) : (
          <HistorianCallout
            key={`${prefix}-fn-${item.note.noteId}`}
            note={item.note}
            noteIndex={item.noteIndex}
            layoutMode="margin"
          />
        ),
      )}
    </>
  );
}

// ============================================================================
// Shared props type for section content rendering
// ============================================================================

interface SectionContentProps {
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter: Optional<(pageId: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
  isFirstChronicleSection: Optional<boolean>;
}

// ============================================================================
// SectionWithImages
// ============================================================================

interface SectionWithImagesProps extends SectionContentProps {
  section: WikiSection;
  onImageOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
  historianNotes: Optional<WikiHistorianNote[]>;
  narrativeStyleId: Optional<string>;
  layoutOverride: Optional<PageLayoutOverride>;
}

// eslint-disable-next-line max-lines-per-function, complexity -- section layout component managing footnote injection, hover tooltips, sidenote positioning, and three distinct rendering modes (centered/margin/flow); each mode renders different DOM structures requiring distinct conditional rendering paths
export function SectionWithImages({
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
}: Readonly<SectionWithImagesProps>) {
  const images = layoutOverride?.imageLayout === "hidden" ? [] : section.images || [];
  const content = section.content;

  // Apply annotation display override: remap or filter notes
  const annotationDisplay = layoutOverride?.annotationDisplay;
  const allNotes = useMemo(() => {
    const raw = historianNotes || [];
    if (!annotationDisplay) return raw;
    if (annotationDisplay === "disabled") return [];
    // Remap all notes to the override display mode
    return raw.map((n) => ({
      ...n,
      display: annotationDisplay,
    }));
  }, [historianNotes, annotationDisplay]);

  // Inject footnote markers into content for ALL notes (unified numbering)
  const { content: annotatedContent, orderedNotes } = useMemo(
    () => injectFootnotes(content, allNotes),
    [content, allNotes],
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
    [layoutOverride?.layoutMode, section, fullNoteInserts.length, narrativeStyleId],
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
    [orderedNotes],
  );

  const handleFootnoteLeave = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "SUP" && target.classList.contains("historian-fn")) {
      setHoveredNote(null);
    }
  }, []);

  // ── Sidenote positioning engine ──
  const sectionRef = useRef<HTMLDivElement>(null);
  const [resolvedPositions, setResolvedPositions] = useState<Map<number, number>>(new Map());

  useLayoutEffect(() => {
    const container = sectionRef.current;
    if (!container || fullNoteInserts.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- useLayoutEffect intentionally clears positions synchronously before paint when no inserts exist
      setResolvedPositions(new Map());
      return;
    }
    setResolvedPositions(computeSidenotePositions(container, fullNoteInserts));
  }, [annotatedContent, fullNoteInserts]);

  // In footnote mode, full notes don't need inline/sidenote rendering — they collect at bottom
  const effectiveFullNoteInserts = useFootnoteMode ? [] : fullNoteInserts;
  const hasInserts = images.length > 0 || effectiveFullNoteInserts.length > 0;

  const footnoteList =
    useFootnoteMode && orderedNotes.length > 0 ? <FootnoteList orderedNotes={orderedNotes} /> : null;

  const tooltipElement = hoveredNote ? (
    <HistorianFootnoteTooltip
      note={hoveredNote.note}
      noteIndex={hoveredNote.idx}
      position={hoveredNote.pos}
    />
  ) : null;

  const contentProps: SectionContentProps = {
    entityNameMap, aliasMap, linkableNames, onNavigate,
    onHoverEnter, onHoverLeave, isFirstChronicleSection,
  };

  const footnoteEvents = {
    onMouseOver: handleFootnoteHover,
    onMouseOut: handleFootnoteLeave,
    onBlur: handleFootnoteLeave,
    onFocus: handleFootnoteHover,
  };

  if (!hasInserts) {
    const wrapperClass = layoutMode === "centered" ? "centered-layout" : undefined;
    return (
      <div className={wrapperClass} {...footnoteEvents}>
        <MarkdownSection content={annotatedContent} {...contentProps} isFirstFragment={isFirstChronicleSection} />
        {footnoteList}
        {tooltipElement}
      </div>
    );
  }

  // ── Margin mode: 3-column grid with images/callouts in side margins ──
  if (layoutMode === "margin") {
    const { leftItems, rightItems } = distributeToMarginColumns(images, effectiveFullNoteInserts);
    return (
      <div className="margin-layout" {...footnoteEvents}>
        <div className="margin-left">
          <MarginColumn items={leftItems} prefix="ml" onImageOpen={onImageOpen} />
        </div>
        <div className="margin-center">
          <MarkdownSection content={annotatedContent} {...contentProps} isFirstFragment={isFirstChronicleSection} />
        </div>
        <div className="margin-right">
          <MarginColumn items={rightItems} prefix="mr" onImageOpen={onImageOpen} />
        </div>
        {footnoteList}
        {tooltipElement}
      </div>
    );
  }

  // ── Flow mode: fragment-based rendering with interleaved images ──
  const fragments = buildFlowFragments(content, images, allNotes, orderedNotes);
  const firstTextIndex = fragments.findIndex((f) => f.type !== "image");

  return (
    <div className="section-with-images" ref={sectionRef} {...footnoteEvents}>
      {/* Inline fallback callouts: floated right, before text so float wraps (narrow viewports only) */}
      {effectiveFullNoteInserts.length > 0 && (
        <div className="inline-callouts">
          {effectiveFullNoteInserts.map(({ note, idx }) => (
            <HistorianCallout key={`il-${note.noteId}`} note={note} noteIndex={idx} layoutMode="flow" />
          ))}
        </div>
      )}
      {fragments.map((fragment, i) => {
        if (fragment.type === "image") {
          return isFloatImage(fragment.image.size) ? (
            <ChronicleImage key={`img-${fragment.image.refId}-${i}`} image={fragment.image} onOpen={onImageOpen} layoutMode="flow" />
          ) : (
            <React.Fragment key={`img-${fragment.image.refId}-${i}`}>
              <div className="clearfix" />
              <ChronicleImage image={fragment.image} onOpen={onImageOpen} layoutMode="flow" />
            </React.Fragment>
          );
        }
        const isFirst = isFirstChronicleSection && i === firstTextIndex;
        return (
          <MarkdownSection key={`text-${i}`} content={fragment.content} {...contentProps} isFirstFragment={isFirst} />
        );
      })}
      <div className="clearfix" />
      {/* Sidenote column: absolutely positioned callouts in right margin (wide viewports) */}
      {effectiveFullNoteInserts.length > 0 && (
        <div className="sidenote-column">
          {effectiveFullNoteInserts.map(({ note, idx }) => (
            <div
              key={`sn-${note.noteId}`}
              data-sidenote-callout-idx={idx}
              className="sidenote-callout"
              style={{ "--sidenote-top": `${resolvedPositions.get(idx) ?? 0}px` } as React.CSSProperties}
            >
              <HistorianCallout note={note} noteIndex={idx} layoutMode="margin" />
            </div>
          ))}
        </div>
      )}
      {footnoteList}
      {tooltipElement}
    </div>
  );
}
