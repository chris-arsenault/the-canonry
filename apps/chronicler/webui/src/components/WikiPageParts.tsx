/**
 * WikiPageParts - Small sub-components used by WikiPageView
 *
 * Extracted to keep WikiPage.tsx under the line limit. Contains:
 * - DisambiguationNotice, TableOfContents, UnmatchedHistorianNotes
 * - BacklinkButton, CategoryButton, SectionBlock
 */

import React, { useMemo, useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type {
  WikiPage,
  WikiSection,
  WikiSectionImage,
  WikiHistorianNote,
  HardState,
  DisambiguationEntry,
  PageLayoutOverride,
} from "../types/world.ts";
import { SectionWithImages } from "./WikiPageSections.tsx";
import { ChronicleGallery } from "./WikiPageImages.tsx";
import { SectionDivider } from "./Ornaments.tsx";
import {
  HISTORIAN_NOTE_COLORS,
  HISTORIAN_NOTE_ICONS,
  HISTORIAN_NOTE_LABELS,
} from "../lib/historianAnnotations.ts";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor.ts";

// ============================================================================
// Disambiguation
// ============================================================================

function disambiguationTypeLabel(page: WikiPage, entityIndex: Map<string, HardState>): string {
  if (page.type === "entity" || page.type === "era") {
    return entityIndex.get(page.id)?.kind || page.type;
  }
  if (page.type === "era_narrative") return "era narrative";
  if (page.type === "static") {
    return page.title.includes(":") ? page.title.split(":")[0].toLowerCase() : "page";
  }
  return page.type;
}

export function DisambiguationNotice({ page, entityIndex, disambiguation, onNavigate }: Readonly<{
  page: WikiPage;
  entityIndex: Map<string, HardState>;
  disambiguation: DisambiguationEntry[];
  onNavigate: (pageId: string) => void;
}>) {
  return (
    <div className="disambiguation-notice">
      This page is about the {disambiguationTypeLabel(page, entityIndex)}. See also:
      {disambiguation
        .filter((d) => d.pageId !== page.id)
        .map((d, i, arr) => (
          <span key={d.pageId}>
            <DisambiguationLink entry={d} onNavigate={onNavigate} />
            {i < arr.length - 1 && ","}
          </span>
        ))}
    </div>
  );
}

function DisambiguationLink({ entry, onNavigate }: Readonly<{
  entry: DisambiguationEntry;
  onNavigate: (pageId: string) => void;
}>) {
  const handleClick = useCallback(() => onNavigate(entry.pageId), [onNavigate, entry.pageId]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onNavigate(entry.pageId);
  }, [onNavigate, entry.pageId]);
  return (
    <span className="disambiguation-link" onClick={handleClick} role="button" tabIndex={0} onKeyDown={handleKeyDown}>
      {entry.title}
    </span>
  );
}

// ============================================================================
// Table of Contents
// ============================================================================

export function TableOfContents({ sections }: Readonly<{ sections: Array<{ id: string; heading: string; level: number }> }>) {
  return (
    <div className="toc">
      <div className="toc-title">Contents</div>
      {sections.map((section, i) => (
        <TocItem key={section.id} section={section} index={i} />
      ))}
    </div>
  );
}

function TocItem({ section, index }: Readonly<{ section: { id: string; heading: string; level: number }; index: number }>) {
  const handleClick = useCallback(() => {
    const el = document.getElementById(section.id);
    el?.scrollIntoView({ behavior: "smooth" });
  }, [section.id]);
  return (
    <button
      className="toc-item"
      style={{ "--toc-indent": `${(section.level - 1) * 16}px` } as React.CSSProperties}
      onClick={handleClick}
    >
      {index + 1}. {section.heading}
    </button>
  );
}

// ============================================================================
// Unmatched Historian Notes
// ============================================================================

export function UnmatchedHistorianNotes({ page }: Readonly<{ page: WikiPage }>) {
  const unmatched = useMemo(() => {
    if (!page.content.historianNotes || page.content.historianNotes.length === 0) return [];
    const allSectionContent = page.content.sections.map((s) => s.content).join("\n");
    return page.content.historianNotes.filter(
      (n) => !resolveAnchorPhrase(n.anchorPhrase, allSectionContent),
    );
  }, [page.content.historianNotes, page.content.sections]);

  if (unmatched.length === 0) return null;

  return (
    <div className="unmatched-notes-section">
      <div className="unmatched-notes-heading">Historian&apos;s Notes</div>
      {unmatched.map((note) => {
        const color = HISTORIAN_NOTE_COLORS[note.type] || HISTORIAN_NOTE_COLORS.commentary;
        const icon = HISTORIAN_NOTE_ICONS[note.type] || "\u2726";
        const label = HISTORIAN_NOTE_LABELS[note.type] || "Commentary";
        return (
          <div
            key={note.noteId}
            className="unmatched-note-card"
            style={{ "--note-color": color } as React.CSSProperties}
          >
            <div className="note-type-label">
              {icon} {label}
            </div>
            {note.text}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Backlink & Category buttons
// ============================================================================

export function BacklinkButton({ link, onNavigate }: Readonly<{ link: WikiPage; onNavigate: (id: string) => void }>) {
  const handleClick = useCallback(() => onNavigate(link.id), [onNavigate, link.id]);
  return (
    <button className="backlink-item" onClick={handleClick}>
      {link.title}
    </button>
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

export function CategoryButton({ catId, onNavigate }: Readonly<{ catId: string; onNavigate: (id: string) => void }>) {
  const handleClick = useCallback(() => onNavigate(`category-${catId}`), [onNavigate, catId]);
  return (
    <button className="category-tag" onClick={handleClick}>
      {formatCategoryName(catId)}
    </button>
  );
}

// ============================================================================
// Section rendering block
// ============================================================================

/** Link resolution data for wiki cross-linking. */
export interface WikiLinkData {
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
}

/** Interaction callbacks for section content. */
export interface SectionCallbacks {
  onNavigate: (pageId: string) => void;
  onEntityClick: (pageId: string) => void;
  onHoverEnter: Optional<(pageId: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
  onImageOpen: Optional<(imageUrl: string, image: WikiSectionImage) => void>;
}

interface SectionBlockProps {
  section: WikiSection;
  sectionIndex: number;
  isLongFormProse: boolean;
  sourceChronicleLinks: WikiPage[];
  chronicleLinks: WikiPage[];
  linkData: WikiLinkData;
  callbacks: SectionCallbacks;
  historianNotes: Optional<WikiHistorianNote[]>;
  narrativeStyleId: Optional<string>;
  layoutOverride: Optional<PageLayoutOverride>;
}

export function SectionBlock({
  section, sectionIndex, isLongFormProse,
  sourceChronicleLinks, chronicleLinks,
  linkData, callbacks,
  historianNotes, narrativeStyleId, layoutOverride,
}: Readonly<SectionBlockProps>) {
  const hideHeading = isLongFormProse && (section.heading === "Chronicle" || section.heading === "Narrative");

  return (
    <React.Fragment>
      {section.heading === "Relationships" && sourceChronicleLinks.length > 0 && (
        <ChronicleGallery title="Source Chronicles" links={sourceChronicleLinks} onNavigate={callbacks.onNavigate} />
      )}
      {section.heading === "Relationships" && chronicleLinks.length > 0 && (
        <ChronicleGallery title="Chronicles" links={chronicleLinks} onNavigate={callbacks.onNavigate} />
      )}
      <div id={section.id} className="wp-section">
        {!hideHeading && (
          <>
            <h2 className="section-heading">{section.heading}</h2>
            <SectionDivider className="section-divider-svg" />
          </>
        )}
        <SectionWithImages
          section={section}
          entityNameMap={linkData.entityNameMap}
          aliasMap={linkData.aliasMap}
          linkableNames={linkData.linkableNames}
          onNavigate={callbacks.onEntityClick}
          onHoverEnter={callbacks.onHoverEnter}
          onHoverLeave={callbacks.onHoverLeave}
          onImageOpen={callbacks.onImageOpen}
          historianNotes={historianNotes}
          isFirstChronicleSection={isLongFormProse && sectionIndex === 0}
          narrativeStyleId={narrativeStyleId}
          layoutOverride={layoutOverride}
        />
      </div>
    </React.Fragment>
  );
}
