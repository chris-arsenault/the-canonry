/**
 * Entity Linking - Unified module for detecting and linking entity names in text
 *
 * Provides utilities for:
 * - Building regex patterns that handle special characters (☽, ~, (), ', etc.)
 * - String-based linking (wraps names with [[...]] for markdown)
 * - React-based linking (returns React nodes with clickable elements)
 *
 * The key insight is that \b word boundaries only work for standard word characters
 * [a-zA-Z0-9_]. For names starting/ending with special chars, we use lookaround
 * assertions instead: (?<!\w) and (?!\w).
 */

import React from 'react';

// ============================================================================
// Core Utilities
// ============================================================================

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex pattern for a single name with smart word boundaries.
 *
 * Uses \b for names starting/ending with word chars ([a-zA-Z0-9_]),
 * but uses lookaround for non-word chars (☽, ~, (, ), ', etc.) where \b fails.
 *
 * Examples:
 * - "Aurora Berg" -> \bAurora Berg\b
 * - "The Syndicate (aw-sworn)" -> \bThe Syndicate \(aw-sworn\)(?!\w)
 * - "☽'whelm Noctnecsiavcaeis~" -> (?<!\w)☽'whelm Noctnecsiavcaeis~(?!\w)
 */
export function buildNamePattern(name: string): string {
  const escaped = escapeRegex(name);
  const firstChar = name.charAt(0);
  const lastChar = name.charAt(name.length - 1);
  const startBoundary = /\w/.test(firstChar) ? '\\b' : '(?<!\\w)';
  const endBoundary = /\w/.test(lastChar) ? '\\b' : '(?!\\w)';
  return `${startBoundary}${escaped}${endBoundary}`;
}

/**
 * Build a combined regex pattern that matches any of the given names.
 * Names are sorted by length (longest first) to ensure longer matches take priority.
 *
 * @param names - Array of names to match (minimum 3 chars each)
 * @param flags - Regex flags (default: 'gi' for global, case-insensitive)
 */
export function buildCombinedPattern(
  names: string[],
  flags: string = 'gi'
): RegExp | null {
  const validNames = names
    .filter((name) => name.length >= 3)
    .sort((a, b) => b.length - a.length); // Longer names first

  if (validNames.length === 0) return null;

  const patterns = validNames.map(buildNamePattern);
  return new RegExp(`(${patterns.join('|')})`, flags);
}

// ============================================================================
// String-based Linking (for Markdown content)
// ============================================================================

/**
 * Check if a position in text is already inside a [[wikilink]]
 */
function isInsideWikilink(text: string, position: number): boolean {
  let depth = 0;
  for (let i = 0; i < position; i++) {
    if (text[i] === '[' && text[i + 1] === '[') {
      depth++;
      i++; // Skip next char
    } else if (text[i] === ']' && text[i + 1] === ']') {
      depth = Math.max(0, depth - 1);
      i++; // Skip next char
    }
  }
  return depth > 0;
}

/**
 * Apply wikilinks to a single section - wraps entity/page name mentions with [[...]] syntax.
 * Only links the first occurrence of each name per section (Wikipedia style).
 */
function applyWikiLinksToSection(
  section: string,
  combinedPattern: RegExp
): string {
  // Track which names have been linked in this section (lowercase for case-insensitive matching)
  const linkedInSection = new Set<string>();

  return section.replace(combinedPattern, (match, _group, offset) => {
    // Check if this position is already inside a wikilink
    if (isInsideWikilink(section, offset)) {
      return match;
    }

    // Check if we've already linked this name in this section
    const matchLower = match.toLowerCase();
    if (linkedInSection.has(matchLower)) {
      return match; // Don't link again
    }

    // Mark as linked and wrap with [[...]]
    linkedInSection.add(matchLower);
    return `[[${match}]]`;
  });
}

/**
 * Apply wikilinks to content - wraps entity/page name mentions with [[...]] syntax.
 * Only links first occurrence of each name per section (Wikipedia MOS:LINK style).
 * Used at render time to make entity names clickable in markdown content.
 *
 * @param content - Raw text content (may contain markdown headings)
 * @param names - Array of { name, id } for entities and static pages to link
 */
export function applyWikiLinks(
  content: string,
  names: Array<{ name: string; id: string }>
): string {
  const nameStrings = names.map((n) => n.name);
  const combinedPattern = buildCombinedPattern(nameStrings);

  if (!combinedPattern) return content;

  // Split by section headings (## or #), keeping the delimiter
  // This regex captures the heading line so we can preserve it
  const sectionSplitRegex = /^(#{1,3}\s+.*)$/gm;
  const parts = content.split(sectionSplitRegex);

  // Process each part - headings pass through, content gets wiki-linked
  const result: string[] = [];
  for (const part of parts) {
    if (part.match(/^#{1,3}\s+/)) {
      // This is a heading - pass through unchanged
      result.push(part);
    } else {
      // This is content - apply wiki links (first occurrence per section)
      result.push(applyWikiLinksToSection(part, combinedPattern));
    }
  }

  return result.join('');
}

// ============================================================================
// React-based Linking (for non-markdown content like tables)
// ============================================================================

export interface LinkableEntity {
  name: string;
  id: string;
}

export interface LinkifyOptions {
  /** CSS styles for the link element */
  linkStyle?: React.CSSProperties;
  /** Whether to link only the first occurrence of each name (default: true) */
  firstOccurrenceOnly?: boolean;
  /** Callback when mouse enters a link (for hover previews) */
  onHoverEnter?: (entityId: string, e: React.MouseEvent) => void;
  /** Callback when mouse leaves a link */
  onHoverLeave?: () => void;
}

const defaultLinkStyle: React.CSSProperties = {
  color: '#10b981',
  cursor: 'pointer',
  borderBottom: '1px dotted #10b981',
  textDecoration: 'none',
};

/**
 * Convert text to React nodes with clickable entity links.
 * Used for non-markdown content like timeline tables where we need React elements.
 *
 * @param text - Plain text to process
 * @param entities - Array of { name, id } for entities to link
 * @param onNavigate - Callback when an entity link is clicked
 * @param options - Optional configuration
 */
export function linkifyText(
  text: string,
  entities: LinkableEntity[],
  onNavigate: (entityId: string) => void,
  options: LinkifyOptions = {}
): React.ReactNode {
  const {
    linkStyle = defaultLinkStyle,
    firstOccurrenceOnly = true,
    onHoverEnter,
    onHoverLeave,
  } = options;

  // Sort by name length (longest first) to match longer names first
  const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length);

  let result: React.ReactNode[] = [text];
  const linkedNames = new Set<string>();

  for (const { name, id } of sortedEntities) {
    if (name.length < 3) continue;

    // Skip if we already linked this name and firstOccurrenceOnly is true
    const nameLower = name.toLowerCase();
    if (firstOccurrenceOnly && linkedNames.has(nameLower)) continue;

    const regex = new RegExp(buildNamePattern(name), 'gi');
    const newResult: React.ReactNode[] = [];
    let foundMatch = false;

    for (const part of result) {
      if (typeof part !== 'string') {
        newResult.push(part);
        continue;
      }

      // Skip if firstOccurrenceOnly and we already found a match for this name
      if (firstOccurrenceOnly && foundMatch) {
        newResult.push(part);
        continue;
      }

      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const segments: React.ReactNode[] = [];

      while ((match = regex.exec(part)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          segments.push(part.slice(lastIndex, match.index));
        }

        // Add linked entity
        segments.push(
          React.createElement(
            'span',
            {
              key: `${id}-${match.index}`,
              style: linkStyle,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                onNavigate(id);
              },
              onMouseEnter: onHoverEnter ? (e: React.MouseEvent) => onHoverEnter(id, e) : undefined,
              onMouseLeave: onHoverLeave,
            },
            match[0]
          )
        );

        lastIndex = regex.lastIndex;
        foundMatch = true;

        // If firstOccurrenceOnly, stop after first match
        if (firstOccurrenceOnly) break;
      }

      if (segments.length > 0) {
        // Add remaining text after last match
        if (lastIndex < part.length) {
          segments.push(part.slice(lastIndex));
        }
        newResult.push(...segments);
      } else {
        newResult.push(part);
      }
    }

    if (foundMatch) {
      linkedNames.add(nameLower);
    }
    result = newResult;
  }

  return React.createElement(React.Fragment, null, ...result);
}
