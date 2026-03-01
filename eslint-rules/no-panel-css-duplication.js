// drift-generated
/**
 * ESLint rule: no-panel-css-duplication
 *
 * Detects when Illuminator component CSS files redeclare structural patterns
 * that are already provided by the shared panel-utilities.css utility classes.
 *
 * This rule checks CSS import statements in JSX/TSX files and warns if the
 * imported CSS file is in the Illuminator components directory but the component
 * doesn't also reference the shared utility classes (ilu-*).
 *
 * See: docs/adr/029-panel-css-utilities.md
 * See: docs/patterns/panel-css-utilities.md
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

// CSS property patterns that indicate duplication of panel-utilities.css
const DUPLICATED_PATTERNS = [
  // .ilu-section pattern
  /background:\s*var\(--bg-secondary\);\s*[\s\S]*?border-radius:\s*8px;\s*[\s\S]*?border:\s*1px solid var\(--border-color\)/,
  // .ilu-action-btn pattern
  /padding:\s*8px 14px;\s*[\s\S]*?background:\s*var\(--bg-tertiary\);\s*[\s\S]*?border-radius:\s*6px/,
  // .ilu-container pattern
  /background:\s*var\(--bg-secondary\);\s*[\s\S]*?overflow:\s*hidden/,
  // .ilu-empty pattern (empty state)
  /text-align:\s*center;\s*[\s\S]*?color:\s*var\(--text-muted\)/,
  // .ilu-selection-bar pattern
  /display:\s*flex;\s*[\s\S]*?align-items:\s*center;\s*[\s\S]*?justify-content:\s*space-between;\s*[\s\S]*?background:\s*var\(--bg-secondary\);\s*[\s\S]*?border:\s*1px solid var\(--accent-color\)/,
  // .ilu-stats-grid pattern
  /display:\s*grid;\s*[\s\S]*?grid-template-columns:\s*repeat\(auto-fit/,
  // .ilu-thumb-cover pattern (absolute positioned cover image)
  /position:\s*absolute;\s*[\s\S]*?object-fit:\s*cover;\s*[\s\S]*?width:\s*100%;\s*[\s\S]*?height:\s*100%/,
];

// Minimum number of duplicated patterns to trigger a warning
const THRESHOLD = 2;

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects Illuminator panel CSS files that redeclare structural patterns " +
        "already provided by panel-utilities.css. Components should compose " +
        "shared .ilu-* utility classes with their prefixed component classes.",
    },
    messages: {
      panelCssDuplication:
        "CSS file '{{file}}' contains {{count}} structural patterns that duplicate " +
        "panel-utilities.css. Compose shared .ilu-* classes (e.g., .ilu-section, " +
        ".ilu-action-btn, .ilu-empty) with component-prefixed classes to reduce " +
        "duplication. See docs/adr/029-panel-css-utilities.md",
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Only check relative CSS imports
        if (!source.startsWith("./") || !source.endsWith(".css")) return;

        const filename = context.filename || context.getFilename();

        // Only check files in Illuminator components directory
        if (!filename.includes("illuminator/webui/src/components/")) return;

        const fileDir = dirname(filename);
        const cssPath = resolve(fileDir, source);

        if (!existsSync(cssPath)) return;

        let cssContent;
        try {
          cssContent = readFileSync(cssPath, "utf-8");
        } catch {
          return;
        }

        // Check if the CSS file already references shared utilities (via comments)
        if (cssContent.includes("panel-utilities") || cssContent.includes("ilu-")) return;

        // Count how many duplicated patterns appear
        let matchCount = 0;
        for (const pattern of DUPLICATED_PATTERNS) {
          if (pattern.test(cssContent)) {
            matchCount++;
          }
        }

        if (matchCount >= THRESHOLD) {
          context.report({
            node,
            messageId: "panelCssDuplication",
            data: {
              file: basename(cssPath),
              count: String(matchCount),
            },
          });
        }
      },
    };
  },
};
