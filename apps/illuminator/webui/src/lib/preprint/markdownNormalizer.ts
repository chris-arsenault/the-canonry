/**
 * markdownNormalizer — Deterministic structural normalization for chronicle markdown.
 *
 * Enforces a canonical document structure so the layout engine has a
 * consistent contract. Pure function, no LLM, no async.
 *
 * Rules:
 * 1. Bold-as-heading promotion: standalone **BOLD** lines → ## Heading
 * 2. ### → ## (no sub-heading levels in chronicles)
 * 3. Strip duplicate # title after frontmatter cast section
 * 4. Normalize HRs: --- only, remove redundant HRs before ## headings
 * 5. Emphasis: _ → * (italic), __ → ** (bold)
 * 6. Whitespace: consistent blank lines around headings/HRs, no trailing spaces
 */

/** Summary of changes made by the normalizer */
export interface NormalizeReport {
  titlesStripped: number;
  boldPromoted: string[];
  headingsFlattened: number;
  hrsNormalized: number;
  hrsRemoved: number;
  emphasisFixed: number;
  whitespaceFixed: boolean;
}

export function emptyReport(): NormalizeReport {
  return { titlesStripped: 0, boldPromoted: [], headingsFlattened: 0, hrsNormalized: 0, hrsRemoved: 0, emphasisFixed: 0, whitespaceFixed: false };
}

/**
 * Normalize chronicle markdown to canonical structure.
 * Returns the normalized content and a report of what changed.
 */
export function normalizeChronicleMarkdown(content: string): { content: string; report: NormalizeReport } {
  const report = emptyReport();
  let lines = content.split("\n");

  // Phase 1: Strip the preamble (cast table + title) — find where prose starts
  const proseStart = findProseStart(lines);

  // Work only on the prose portion
  const preamble = lines.slice(0, proseStart);
  let prose = lines.slice(proseStart);

  // Phase 2: Strip duplicate # title
  const beforeTitles = prose.length;
  prose = stripDuplicateTitle(prose);
  report.titlesStripped = beforeTitles - prose.length;

  // Phase 3: Promote ### to ##
  prose = prose.map((line) => {
    if (line.startsWith("### ")) {
      report.headingsFlattened++;
      return "## " + line.slice(4);
    }
    return line;
  });

  // Phase 4: Promote bold-as-heading
  prose = promoteBoldHeadings(prose, report);

  // Phase 5: Normalize HR variants to ---
  prose = prose.map((line) => {
    const trimmed = line.trim();
    if (/^(\*\s*\*\s*\*|\*{3,}|_{3,}|-\s*-\s*-)$/.test(trimmed)) {
      if (trimmed !== "---") report.hrsNormalized++;
      return "---";
    }
    return line;
  });

  // Phase 6: Remove redundant HRs before ## headings
  const beforeHRs = prose.filter((l) => l.trim() === "---").length;
  prose = removeRedundantHRs(prose);
  report.hrsRemoved = beforeHRs - prose.filter((l) => l.trim() === "---").length;

  // Phase 7: Normalize emphasis
  prose = prose.map((line) => {
    const fixed = normalizeEmphasis(line);
    if (fixed !== line) report.emphasisFixed++;
    return fixed;
  });

  // Phase 8: Whitespace normalization
  const beforeWS = prose.join("\n");
  prose = normalizeWhitespace(prose);
  if (prose.join("\n") !== beforeWS) report.whitespaceFixed = true;

  // Reassemble
  const result = [...preamble, ...prose].join("\n");
  const normalized = result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd() + "\n";

  return { content: normalized, report };
}

/**
 * Check if normalization would change the content.
 */
export function wouldNormalize(content: string): boolean {
  const original = content;
  const { content: normalized } = normalizeChronicleMarkdown(content);
  return normalized !== original;
}

/** Summarize a report as a short string */
export function summarizeReport(report: NormalizeReport): string {
  const parts: string[] = [];
  if (report.boldPromoted.length > 0) parts.push(`${report.boldPromoted.length} bold→heading`);
  if (report.headingsFlattened > 0) parts.push(`${report.headingsFlattened} ###→##`);
  if (report.titlesStripped > 0) parts.push(`titles stripped`);
  if (report.hrsRemoved > 0) parts.push(`${report.hrsRemoved} HR removed`);
  if (report.hrsNormalized > 0) parts.push(`${report.hrsNormalized} HR normalized`);
  if (report.emphasisFixed > 0) parts.push(`${report.emphasisFixed} emphasis`);
  if (report.whitespaceFixed) parts.push("whitespace");
  return parts.length > 0 ? parts.join(", ") : "no changes";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find the line index where prose content starts (after cast table and --- separator) */
function findProseStart(lines: string[]): number {
  // Look for the --- after the cast table
  let pastCast = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## Cast") pastCast = true;
    if (pastCast && lines[i].trim() === "---") {
      // This is the separator after the cast table — prose starts after it
      return i + 1;
    }
  }
  // No cast section found — entire content is prose
  return 0;
}

/** Strip the first # heading in prose (redundant with frontmatter title) and any ### subtitle */
function stripDuplicateTitle(lines: string[]): string[] {
  const result: string[] = [];
  let stripped = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!stripped && trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      // Skip this title line
      stripped = true;
      // Also skip a following ### subtitle line if present
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("### ")) {
        i++;
      }
      // Skip blank lines after the stripped title
      while (i + 1 < lines.length && lines[i + 1].trim() === "") {
        i++;
      }
      continue;
    }
    // Skip additional # titles (some documents have two)
    if (stripped && trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      // Also skip following ### subtitle
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("### ")) {
        i++;
      }
      while (i + 1 < lines.length && lines[i + 1].trim() === "") {
        i++;
      }
      continue;
    }
    result.push(lines[i]);
  }
  return result;
}

/** Promote standalone **BOLD TEXT** lines to ## headings */
function promoteBoldHeadings(lines: string[], report?: NormalizeReport): string[] {
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (!match) return line;

    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    if (prevLine !== "" && prevLine !== "---") return line;

    const text = match[1];
    if (text.endsWith(":")) return line;

    if (report) report.boldPromoted.push(text);
    return "## " + text;
  });
}

/** Remove --- lines that immediately precede a ## heading (the heading IS the section break) */
function removeRedundantHRs(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      // Look ahead past blank lines to see if a ## heading follows
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && lines[j].trim().startsWith("## ")) {
        // Skip this HR — the heading serves as the section break
        continue;
      }
    }
    result.push(lines[i]);
  }
  return result;
}

/** Normalize underscore emphasis to asterisk emphasis */
function normalizeEmphasis(line: string): string {
  // Don't touch lines that are headings, HRs, or image/comment markers
  if (line.trim().startsWith("#") || line.trim().startsWith("---") ||
      line.trim().startsWith("<!--") || line.trim().startsWith("![")) {
    return line;
  }
  // __bold__ → **bold** (must do before single _)
  let result = line.replace(/__([^_]+?)__/g, "**$1**");
  // _italic_ → *italic* (but not in words like_this or __already_handled__)
  // Only match _ at word boundary
  result = result.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, "*$1*");
  return result;
}

/** Ensure consistent blank lines around headings and HRs */
function normalizeWhitespace(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isHeading = trimmed.startsWith("## ");
    const isHR = trimmed === "---";
    const isStructural = isHeading || isHR;

    if (isStructural) {
      // Ensure blank line before (unless at start)
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push("");
      }
      result.push(lines[i]);
      // Ensure blank line after
      if (i + 1 < lines.length && lines[i + 1].trim() !== "") {
        result.push("");
      }
    } else {
      // Collapse runs of 3+ blank lines to 1
      if (trimmed === "" && result.length > 0 && result[result.length - 1].trim() === "") {
        // Already have a blank line, skip additional
        if (result.length > 1 && result[result.length - 2].trim() === "") continue;
      }
      result.push(lines[i]);
    }
  }
  return result;
}
