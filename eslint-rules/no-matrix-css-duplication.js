// drift-generated
/**
 * ESLint rule: no-matrix-css-duplication
 *
 * Detects when component CSS files redeclare structural patterns that are
 * already provided by the shared matrix-base.css utility classes (mat-*).
 *
 * This rule checks CSS import statements in JSX/TSX files and warns if the
 * imported CSS file contains matrix structural patterns (table, scroll area,
 * toolbar, search, legend) without referencing the shared mat-* utilities.
 *
 * See: docs/adr/037-matrix-css-consolidation.md
 * See: docs/patterns/matrix-css-base.md
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

// CSS property patterns that indicate duplication of matrix-base.css
const DUPLICATED_PATTERNS = [
  // mat-layout pattern: flex column container at full height
  /display:\s*flex;\s*[\s\S]*?flex-direction:\s*column;\s*[\s\S]*?height:\s*100%/,
  // mat-scroll-area pattern: scrollable table container
  /flex:\s*1;\s*[\s\S]*?overflow:\s*auto;\s*[\s\S]*?border-radius:\s*12px/,
  // mat-table pattern: full-width collapsed table
  /width:\s*100%;\s*[\s\S]*?border-collapse:\s*collapse;\s*[\s\S]*?font-size:\s*13px/,
  // mat-table th pattern: sticky uppercase header
  /position:\s*sticky;\s*[\s\S]*?text-transform:\s*uppercase;\s*[\s\S]*?letter-spacing:\s*0\.5px/,
  // mat-search pattern: dark search input with focus accent
  /background:\s*rgb\(15 23 42\s*\/\s*60%\);\s*[\s\S]*?border:\s*1px solid rgb\(59 130 246\s*\/\s*20%\);\s*[\s\S]*?border-radius:\s*6px;\s*[\s\S]*?color:\s*#fff/,
  // mat-legend pattern: legend bar with bg/border
  /background:\s*rgb\(15 23 42\s*\/\s*40%\);\s*[\s\S]*?border:\s*1px solid rgb\(59 130 246\s*\/\s*15%\);\s*[\s\S]*?border-radius:\s*8px/,
];

// Minimum number of duplicated patterns to trigger a warning
const THRESHOLD = 3;

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects CSS files that redeclare structural patterns already provided " +
        "by matrix-base.css. Components should compose shared .mat-* utility " +
        "classes with their prefixed component classes.",
    },
    messages: {
      matrixCssDuplication:
        "CSS file '{{file}}' contains {{count}} structural patterns that duplicate " +
        "matrix-base.css. Use shared .mat-* classes (mat-layout, mat-table, mat-row, " +
        "mat-search, mat-legend) with component-prefixed classes. " +
        "See docs/adr/037-matrix-css-consolidation.md",
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
        const fileDir = dirname(filename);
        const cssPath = resolve(fileDir, source);

        // Skip the shared base file itself
        if (cssPath.includes("matrix-base.css")) return;

        if (!existsSync(cssPath)) return;

        let cssContent;
        try {
          cssContent = readFileSync(cssPath, "utf-8");
        } catch {
          return;
        }

        // Skip if the CSS file already references shared matrix utilities
        if (cssContent.includes("matrix-base") || cssContent.includes("mat-layout") || cssContent.includes("mat-table") || cssContent.includes("mat-row")) return;

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
            messageId: "matrixCssDuplication",
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
