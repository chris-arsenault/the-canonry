// drift-generated
/**
 * ESLint rule: no-hint-css-duplication
 *
 * Detects when Illuminator component CSS files redeclare the muted hint text
 * pattern (font-size: 11px/12px + color: var(--text-muted)) that is already
 * provided by the shared .ilu-hint and .ilu-hint-sm utility classes in
 * panel-utilities.css.
 *
 * Components should compose the shared utility class alongside their
 * component-prefixed class in JSX (e.g., className="ilu-hint cfgp-section-desc")
 * and keep only the unique spacing/layout properties in their co-located CSS.
 *
 * See: docs/adr/031-hint-text-css-deduplication.md
 * See: docs/patterns/hint-text-utilities.md
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

// Matches CSS rule blocks that declare both font-size: 11px/12px AND color: var(--text-muted)
// within the same rule block. These should use .ilu-hint or .ilu-hint-sm instead.
const HINT_TEXT_PATTERN =
  /\{[^}]*font-size:\s*1[12]px[^}]*color:\s*var\(--text-muted\)[^}]*\}|{[^}]*color:\s*var\(--text-muted\)[^}]*font-size:\s*1[12]px[^}]*\}/;

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects Illuminator panel CSS files that redeclare the muted hint text " +
        "pattern (font-size + color: var(--text-muted)) already provided by " +
        ".ilu-hint and .ilu-hint-sm in panel-utilities.css.",
    },
    messages: {
      hintCssDuplication:
        "CSS file '{{file}}' redeclares the muted hint text pattern " +
        "(font-size: 11px/12px + color: var(--text-muted)). Use the shared " +
        ".ilu-hint (12px) or .ilu-hint-sm (11px) utility classes from " +
        "panel-utilities.css instead. Compose in JSX: " +
        'className="ilu-hint your-component-class". ' +
        "See docs/patterns/hint-text-utilities.md",
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

        // Skip files that already reference panel-utilities (already migrated)
        if (
          cssContent.includes("panel-utilities") ||
          cssContent.includes("ilu-hint")
        ) {
          return;
        }

        // Check if the CSS file has the duplicated hint text pattern
        if (HINT_TEXT_PATTERN.test(cssContent)) {
          context.report({
            node,
            messageId: "hintCssDuplication",
            data: {
              file: basename(cssPath),
            },
          });
        }
      },
    };
  },
};
