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

/**
 * Normalize chronicle markdown to canonical structure.
 * Returns the normalized content, or the original if no changes were needed.
 */
export function normalizeChronicleMarkdown(content: string): string {
  let lines = content.split("\n");

  // Phase 1: Strip the preamble (cast table + title) — find where prose starts
  const proseStart = findProseStart(lines);

  // Work only on the prose portion
  const preamble = lines.slice(0, proseStart);
  let prose = lines.slice(proseStart);

  // Phase 2: Strip duplicate # title (first # heading in prose is redundant with frontmatter)
  prose = stripDuplicateTitle(prose);

  // Phase 3: Promote ### to ##
  prose = prose.map((line) => {
    if (line.startsWith("### ")) return "## " + line.slice(4);
    return line;
  });

  // Phase 4: Promote bold-as-heading (standalone **TEXT** lines)
  prose = promoteBoldHeadings(prose);

  // Phase 5: Normalize HR variants to ---
  prose = prose.map((line) => {
    const trimmed = line.trim();
    if (/^(\*\s*\*\s*\*|\*{3,}|_{3,}|-\s*-\s*-)$/.test(trimmed)) return "---";
    return line;
  });

  // Phase 6: Remove redundant HRs before ## headings
  prose = removeRedundantHRs(prose);

  // Phase 7: Normalize emphasis — _text_ → *text*, __text__ → **text**
  prose = prose.map(normalizeEmphasis);

  // Phase 8: Whitespace normalization
  prose = normalizeWhitespace(prose);

  // Reassemble
  const result = [...preamble, ...prose].join("\n");

  // Trim trailing whitespace per line and trailing newlines
  return result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd() + "\n";
}

/**
 * Check if normalization would change the content.
 */
export function wouldNormalize(content: string): boolean {
  return normalizeChronicleMarkdown(content) !== content;
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
function promoteBoldHeadings(lines: string[]): string[] {
  return lines.map((line, i) => {
    const trimmed = line.trim();
    // Must be ONLY bold text on the line (no other content)
    const match = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (!match) return line;

    // Check context: should be preceded by a blank line or --- (section break context)
    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    if (prevLine !== "" && prevLine !== "---") return line;

    // Don't promote if it looks like an inline label followed by content on next line
    // (e.g., **Collector's Note:** followed by text)
    const text = match[1];
    if (text.endsWith(":")) return line;

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
