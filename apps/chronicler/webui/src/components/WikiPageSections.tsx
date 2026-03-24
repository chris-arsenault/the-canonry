/**
 * WikiPageSections - Section rendering with content-aware layout
 *
 * Handles three layout modes:
 * - 'flow': Float images/callouts, text wraps (Wikipedia style). For long prose.
 * - 'margin': 3-column grid with images/callouts in side margins. For short content.
 * - 'centered': Text centered, no floats. For verse/poetry without images.
 */

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
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
  type ResolvedFootnote,
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
  | { type: "image"; image: WikiSectionImage }
  | { type: "callout"; note: WikiHistorianNote; idx: number };

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

/**
 * Inject pre-resolved footnote superscripts into a text slice.
 * Uses positions already computed against the full section content —
 * never re-resolves anchors, so numbering stays globally consistent.
 */
function injectPreResolvedFootnotes(
  slice: string,
  sliceStart: number,
  resolvedEntries: ResolvedFootnote[],
): string {
  // Find entries whose anchor falls within this slice's range in the full content
  const sliceEnd = sliceStart + slice.length;
  const hits = resolvedEntries.filter(
    (e) => e.index >= sliceStart && e.index + e.phraseLen <= sliceEnd
  );
  if (hits.length === 0) return slice;

  let result = slice;
  // Insert back-to-front to preserve positions
  for (let i = hits.length - 1; i >= 0; i--) {
    const entry = hits[i];
    const localInsert = (entry.index - sliceStart) + entry.phraseLen;
    const color = HISTORIAN_NOTE_COLORS[entry.note.type] || "#8b7355";
    const sup = `<sup class="historian-fn" data-note-idx="${entry.globalIdx}" style="color:${color};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${entry.globalIdx + 1}</sup>`;
    result = result.slice(0, localInsert) + sup + result.slice(localInsert);
  }
  return result;
}

/** A positioned insert: image or callout, to be interleaved with text. */
type FlowInsert =
  | { kind: "image"; image: WikiSectionImage; position: number; anchorLen: number }
  | { kind: "callout"; note: WikiHistorianNote; idx: number; position: number; anchorLen: number };

/** Build interleaved text/image/callout fragments for flow layout. */
function buildFlowFragments(
  content: string,
  images: WikiSectionImage[],
  resolvedEntries: ResolvedFootnote[],
  fullNoteInserts: Array<{ note: WikiHistorianNote; idx: number }>,
): FlowFragment[] {
  // Merge images and callouts into a single sorted insert list
  const inserts: FlowInsert[] = [];
  for (const image of images) {
    const pos = resolveImagePosition(image, content);
    inserts.push({ kind: "image", image, position: pos, anchorLen: image.anchorText?.length || 0 });
  }
  for (const { note, idx } of fullNoteInserts) {
    // Use the pre-resolved position from resolvedEntries
    const entry = resolvedEntries.find((e) => e.globalIdx === idx);
    if (entry) {
      inserts.push({ kind: "callout", note, idx, position: entry.index, anchorLen: entry.phraseLen });
    }
  }
  inserts.sort((a, b) => a.position - b.position);

  const fragments: FlowFragment[] = [];
  let lastIndex = 0;
  for (const item of inserts) {
    const anchorEnd = item.position + item.anchorLen;
    const paragraphEnd = content.indexOf("\n\n", anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;
    if (insertPoint > lastIndex) {
      fragments.push({ type: "text", content: injectPreResolvedFootnotes(content.slice(lastIndex, insertPoint), lastIndex, resolvedEntries) });
    }
    if (item.kind === "image") {
      fragments.push({ type: "image", image: item.image });
    } else {
      fragments.push({ type: "callout", note: item.note, idx: item.idx });
    }
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : insertPoint;
  }
  if (lastIndex < content.length) {
    fragments.push({ type: "text", content: injectPreResolvedFootnotes(content.slice(lastIndex), lastIndex, resolvedEntries) });
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
// Positioned margin column — items placed at their anchor's Y coordinate
// ============================================================================

function PositionedMarginColumn({ items, prefix, onImageOpen, resolvedPositions, content, containerHeight }: Readonly<{
  items: MarginItem[];
  prefix: string;
  onImageOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
  resolvedPositions: Map<number, number>;
  content: string;
  containerHeight: number;
}>) {
  const contentLen = content.length || 1;
  const columnRef = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState<number[]>([]);

  // Compute ideal anchor positions for each item
  const idealTops = useMemo(() => {
    return items.map((item) => {
      if (item.kind === "callout") {
        return resolvedPositions.get(item.noteIndex) ?? 0;
      }
      const charPos = resolveImagePosition(item.image, content);
      return containerHeight > 0 ? (charPos / contentLen) * containerHeight : 0;
    });
  }, [items, resolvedPositions, content, contentLen, containerHeight]);

  const resolveOverlaps = useCallback(() => {
    const col = columnRef.current;
    if (!col || items.length === 0) { setTops([]); return; }

    const children = col.querySelectorAll<HTMLElement>(".margin-positioned-item");
    const GAP = 8;
    const resolved: number[] = [];
    let lastBottom = -Infinity;

    for (let i = 0; i < items.length; i++) {
      let top = idealTops[i] ?? 0;
      if (top < lastBottom + GAP) top = lastBottom + GAP;
      resolved.push(top);
      const height = children[i]?.offsetHeight ?? 80;
      lastBottom = top + height;
    }

    setTops(resolved);
  }, [idealTops, items.length]);

  // Resolve on initial layout
  useLayoutEffect(() => { resolveOverlaps(); }, [resolveOverlaps]);

  // Re-resolve after images load — use ResizeObserver on the column to catch any height changes
  useEffect(() => {
    const col = columnRef.current;
    if (!col) return;
    const observer = new ResizeObserver(() => resolveOverlaps());
    // Observe each positioned item so we catch image loads changing their height
    col.querySelectorAll<HTMLElement>(".margin-positioned-item").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [resolveOverlaps, items]);

  return (
    <div ref={columnRef}>
      {items.map((item, i) => (
        <div key={item.kind === "image" ? `${prefix}-img-${item.image.refId}-${i}` : `${prefix}-fn-${item.note.noteId}`}
          className="margin-positioned-item"
          style={{ "--margin-item-top": `${tops[i] ?? idealTops[i] ?? 0}px` } as React.CSSProperties}>
          {item.kind === "image" ? (
            <ChronicleImage image={item.image} onOpen={onImageOpen} layoutMode="margin" />
          ) : (
            <HistorianCallout note={item.note} noteIndex={item.noteIndex} layoutMode="margin" />
          )}
        </div>
      ))}
    </div>
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
  /** Pre-resolved footnotes for this section with global indices (from resolveGlobalFootnotes) */
  preResolvedNotes: Optional<ResolvedFootnote[]>;
  /** Global ordered notes across all sections (for tooltip lookup by global index) */
  globalOrderedNotes: Optional<WikiHistorianNote[]>;
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
  preResolvedNotes,
  globalOrderedNotes,
}: Readonly<SectionWithImagesProps>) {
  const images = layoutOverride?.imageLayout === "hidden" ? [] : section.images || [];
  const content = section.content;

  // Apply annotation display override: remap or filter notes
  const annotationDisplay = layoutOverride?.annotationDisplay;
  const allNotes = useMemo(() => {
    const raw = historianNotes || [];
    if (!annotationDisplay) return raw;
    if (annotationDisplay === "disabled") return [];
    return raw.map((n) => ({
      ...n,
      display: annotationDisplay,
    }));
  }, [historianNotes, annotationDisplay]);

  // Use pre-resolved global data if available, otherwise fall back to per-section resolution
  const { content: annotatedContent, orderedNotes, resolvedEntries } = useMemo(() => {
    if (preResolvedNotes && globalOrderedNotes) {
      // Inject superscripts using pre-resolved global indices
      let result = content;
      for (let i = preResolvedNotes.length - 1; i >= 0; i--) {
        const entry = preResolvedNotes[i];
        // Skip notes that were filtered out by annotation display override
        if (annotationDisplay === "disabled") continue;
        const insertAt = entry.index + entry.phraseLen;
        const color = HISTORIAN_NOTE_COLORS[entry.note.type] || "#8b7355";
        const sup = `<sup class="historian-fn" data-note-idx="${entry.globalIdx}" style="color:${color};cursor:pointer;font-weight:700;font-size:12px;margin-left:2px">${entry.globalIdx + 1}</sup>`;
        result = result.slice(0, insertAt) + sup + result.slice(insertAt);
      }
      // Apply display override to the pre-resolved notes for this section
      const sectionNotes = annotationDisplay
        ? preResolvedNotes.map((e) => ({ ...e, note: { ...e.note, display: annotationDisplay } }))
        : preResolvedNotes;
      return {
        content: result,
        orderedNotes: globalOrderedNotes,
        resolvedEntries: sectionNotes,
      };
    }
    return injectFootnotes(content, allNotes);
  }, [content, allNotes, preResolvedNotes, globalOrderedNotes, annotationDisplay]);

  // Full-display notes with their indices in the unified ordering
  const fullNoteInserts = useMemo(() => {
    if (preResolvedNotes && globalOrderedNotes) {
      // Use pre-resolved entries for this section with global indices
      const displayMode = annotationDisplay;
      return preResolvedNotes
        .map((e) => ({ note: displayMode ? { ...e.note, display: displayMode } : e.note, idx: e.globalIdx }))
        .filter(({ note }) => note.display === "full");
    }
    return orderedNotes
      .map((note, idx) => ({ note, idx }))
      .filter(({ note }) => note.display === "full");
  }, [orderedNotes, preResolvedNotes, globalOrderedNotes, annotationDisplay]);

  // Determine layout mode: override wins, then heuristic
  const layoutMode = useMemo(
    () =>
      layoutOverride?.layoutMode ??
      analyzeLayout(section, fullNoteInserts.length, narrativeStyleId),
    [layoutOverride?.layoutMode, section, fullNoteInserts.length, narrativeStyleId],
  );

  // Annotation position: "sidenote" forces margin, "inline" forces at-anchor, "footnote" collects at bottom
  const annotationPosition = layoutOverride?.annotationPosition;
  const useFootnoteMode = annotationPosition === "footnote";


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

  // ── Sidenote/margin positioning engine ──
  const sectionRef = useRef<HTMLDivElement>(null);
  const [resolvedPositions, setResolvedPositions] = useState<Map<number, number>>(new Map());
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const container = sectionRef.current;
    if (!container) {
      setResolvedPositions(new Map());
      setContainerHeight(0);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- useLayoutEffect intentionally measures DOM synchronously before paint
    setContainerHeight(container.offsetHeight);
    if (fullNoteInserts.length > 0) {
      setResolvedPositions(computeSidenotePositions(container, fullNoteInserts));
    } else {
      setResolvedPositions(new Map());
    }
  }, [annotatedContent, fullNoteInserts]);

  // In footnote mode, full notes don't need inline/sidenote rendering — they collect at bottom
  const effectiveFullNoteInserts = useFootnoteMode ? [] : fullNoteInserts;
  const hasInserts = images.length > 0 || effectiveFullNoteInserts.length > 0;


  // In footnote mode, show only this section's notes (with global numbering)
  const sectionFootnoteNotes = useMemo(() => {
    if (!useFootnoteMode) return [];
    if (preResolvedNotes) {
      return preResolvedNotes.map((e) => ({
        ...e.note,
        ...(annotationDisplay ? { display: annotationDisplay } : {}),
        _globalIdx: e.globalIdx,
      }));
    }
    return orderedNotes;
  }, [useFootnoteMode, preResolvedNotes, orderedNotes, annotationDisplay]);

  const footnoteList =
    useFootnoteMode && sectionFootnoteNotes.length > 0 ? <FootnoteList orderedNotes={sectionFootnoteNotes} /> : null;

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

  // ── Margin mode: 3-column grid with images/callouts in side margins,
  //    positioned to align with their anchors in the center column ──
  if (layoutMode === "margin") {
    const { leftItems, rightItems } = distributeToMarginColumns(images, effectiveFullNoteInserts);
    return (
      <div className="margin-layout" ref={sectionRef} data-note-position={annotationPosition || undefined} {...footnoteEvents}>
        <div className="margin-left margin-positioned">
          <PositionedMarginColumn items={leftItems} prefix="ml" onImageOpen={onImageOpen}
            resolvedPositions={resolvedPositions} content={content} containerHeight={containerHeight} />
        </div>
        <div className="margin-center">
          <MarkdownSection content={annotatedContent} {...contentProps} isFirstFragment={isFirstChronicleSection} />
          {/* Narrow-screen fallback: callouts inline below text when margins collapse */}
          {effectiveFullNoteInserts.length > 0 && (
            <div className="margin-callout-fallback">
              {effectiveFullNoteInserts.map(({ note, idx }) => (
                <HistorianCallout key={`mf-${note.noteId}`} note={note} noteIndex={idx} layoutMode="flow" />
              ))}
            </div>
          )}
        </div>
        <div className="margin-right margin-positioned">
          <PositionedMarginColumn items={rightItems} prefix="mr" onImageOpen={onImageOpen}
            resolvedPositions={resolvedPositions} content={content} containerHeight={containerHeight} />
        </div>
        {footnoteList}
        {tooltipElement}
      </div>
    );
  }

  // ── Flow mode: fragment-based rendering with interleaved images + callouts ──
  const fragments = buildFlowFragments(content, images, resolvedEntries, effectiveFullNoteInserts);
  const firstTextIndex = fragments.findIndex((f) => f.type === "text");

  return (
    <div className="section-with-images" ref={sectionRef} data-note-position={annotationPosition || undefined} {...footnoteEvents}>
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
        if (fragment.type === "callout") {
          return (
            <div key={`fc-${fragment.note.noteId}`} className="inline-anchor-callout">
              <HistorianCallout note={fragment.note} noteIndex={fragment.idx} layoutMode="flow" />
            </div>
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
