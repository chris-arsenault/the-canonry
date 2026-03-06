/**
 * WikiPageMarkdown - Markdown rendering with entity linking for wiki pages
 *
 * Unified renderer for all page types (entity, chronicle, static, era).
 * Supports: markdown tables, wiki links, click navigation, hover previews.
 */

import React, { useMemo, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";
import type { Optional } from "@the-canonry/shared-components";
import { applyWikiLinks } from "../lib/wikiBuilder.ts";
import styles from "./WikiPage.module.css";

/** Encode a page ID for use in hash URLs, encoding each path segment. */
function encodePageIdForHash(pageId: string): string {
  return pageId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Convert [[Entity Name]] or [[Entity Name|entityId]] wiki links to markdown links.
 * Supports both name-based lookup and direct ID-based linking.
 */
function convertWikiLinks(
  content: string,
  linkableNames: Array<{ name: string; id: string }>,
  entityNameMap: Map<string, string>,
  aliasMap: Map<string, string>,
): string {
  // First apply wiki links to detect entity names
  const linkedContent = applyWikiLinks(content, linkableNames);
  // Then convert [[...]] to markdown-friendly link format with proper URLs
  // eslint-disable-next-line sonarjs/slow-regex -- character-class bounded, no backtracking
  return linkedContent.replace(/\[\[([^\]]+)\]\]/g, (match: string, linkContent: string) => {
    const pipeIndex = linkContent.lastIndexOf("|");
    let displayName: string;
    let pageId: string | undefined;

    if (pipeIndex > 0 && pipeIndex < linkContent.length - 1) {
      displayName = linkContent.slice(0, pipeIndex);
      pageId = linkContent.slice(pipeIndex + 1);
    } else {
      displayName = linkContent;
      const normalized = displayName.toLowerCase().trim().normalize("NFC");
      pageId = entityNameMap.get(normalized) || aliasMap.get(normalized);
    }

    if (pageId) {
      return `[${displayName}](#/page/${encodePageIdForHash(pageId)})`;
    }
    return match;
  });
}

interface MarkdownSectionProps {
  content: string;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter: Optional<(pageId: string, e: React.MouseEvent) => void>;
  onHoverLeave: Optional<() => void>;
  isFirstFragment: Optional<boolean>;
}

/**
 * MarkdownSection - Renders content with markdown support and entity linking
 */
// eslint-disable-next-line max-lines-per-function -- renders markdown with wiki link conversion, click/hover delegation, and inline CSS theme; splitting the CSS block to a separate concern would fragment the rendering pipeline
export function MarkdownSection({
  content,
  entityNameMap,
  aliasMap,
  linkableNames,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  isFirstFragment,
}: Readonly<MarkdownSectionProps>) {
  const processedContent = useMemo(
    () => convertWikiLinks(content, linkableNames, entityNameMap, aliasMap),
    [content, entityNameMap, aliasMap, linkableNames],
  );

  // Handle clicks on page links within the markdown
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href?.startsWith("#/page/")) {
          e.preventDefault();
          const pageId = decodeURIComponent(href.slice(7));
          onNavigate(pageId);
        }
      }
    },
    [onNavigate],
  );

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (!onHoverEnter) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href?.startsWith("#/page/")) {
          const pageId = decodeURIComponent(href.slice(7));
          onHoverEnter(pageId, e);
        }
      }
    },
    [onHoverEnter],
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
    [onHoverLeave],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick(e as unknown as React.MouseEvent);
    },
    [handleClick],
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
      onKeyDown={handleKeyDown}
    >
      <MDEditor.Markdown
        source={processedContent}
        // eslint-disable-next-line local/no-inline-styles -- required by MDEditor.Markdown component API
        style={MD_EDITOR_STYLE}
      />
      <style>{MARKDOWN_THEME_CSS}</style>
    </div>
  );
}

/** Style for the MDEditor.Markdown component (hoisted to avoid re-creation). */
const MD_EDITOR_STYLE = { backgroundColor: "transparent", color: "var(--color-text-secondary)" };

/** Inline CSS theme for the MDEditor markdown renderer. */
const MARKDOWN_THEME_CSS = `
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
`;
