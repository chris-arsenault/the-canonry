// drift-generated
/**
 * ESLint rule: no-version-toolbar-drift
 *
 * Detects when Illuminator component CSS files redeclare the active version badge,
 * compact toolbar button, or compact select patterns that are provided by the shared
 * panel-utilities.css utility classes (.ilu-active-badge, .ilu-action-btn-sm,
 * .ilu-compact-select).
 *
 * See: docs/adr/033-version-toolbar-css-consolidation.md
 * See: docs/patterns/version-toolbar-css.md
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

// CSS patterns that indicate duplication of panel-utilities.css version toolbar classes
const DUPLICATED_PATTERNS = [
  {
    name: "ilu-active-badge",
    // Active version pill: green background + pill radius
    pattern:
      /border-radius:\s*999px[\s\S]*?(?:rgb\(16[\s, ]+185[\s, ]+129|rgba\(16,\s*185,\s*129|#10b981)/,
    message:
      "Use the shared .ilu-active-badge class from panel-utilities.css instead of " +
      "redeclaring the active version pill badge.",
  },
  {
    name: "ilu-active-badge (reversed)",
    // Same pattern but color before radius
    pattern:
      /(?:rgb\(16[\s, ]+185[\s, ]+129|rgba\(16,\s*185,\s*129|#10b981)[\s\S]*?border-radius:\s*999px/,
    message:
      "Use the shared .ilu-active-badge class from panel-utilities.css instead of " +
      "redeclaring the active version pill badge.",
  },
  {
    name: "ilu-compact-select",
    // Compact select: width: auto + font-size: 12px + padding: 4px 6px
    pattern:
      /width:\s*auto;\s*[\s\S]*?font-size:\s*12px;\s*[\s\S]*?padding:\s*4px 6px/,
    message:
      "Use the shared .ilu-compact-select class from panel-utilities.css instead of " +
      "redeclaring compact select styles. Set only min-width in the component class.",
  },
];

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects Illuminator CSS files that redeclare the active version badge or " +
        "compact toolbar select patterns already provided by panel-utilities.css.",
    },
    messages: {
      versionToolbarDrift:
        "CSS file '{{file}}' redeclares the {{patternName}} pattern. {{patternMessage}} " +
        "See docs/adr/033-version-toolbar-css-consolidation.md",
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

        // Skip files that already reference the shared utilities
        if (
          cssContent.includes("ilu-active-badge") ||
          cssContent.includes("ilu-compact-select")
        )
          return;

        // Check each pattern
        for (const { name, pattern, message } of DUPLICATED_PATTERNS) {
          if (pattern.test(cssContent)) {
            context.report({
              node,
              messageId: "versionToolbarDrift",
              data: {
                file: basename(cssPath),
                patternName: name,
                patternMessage: message,
              },
            });
            break; // One warning per file is enough
          }
        }
      },
    };
  },
};
