// drift-generated
import { readFileSync } from "fs";
import { resolve, dirname } from "path";

/**
 * Detects App.css files that redefine shared arctic-theme-base variables
 * instead of importing @the-canonry/shared-components/styles/arctic-theme-base.
 *
 * The shared base provides: --bg-primary, --bg-secondary, --bg-tertiary,
 * --bg-sidebar, --border-color, --border-light, --text-color, --text-secondary,
 * --text-muted, --arctic-*, --space-*, --text-xs/sm/base/lg/xl/2xl, --card-bg,
 * --card-border, --input-bg, --danger, --success, --warning, plus CSS reset and body.
 *
 * App.css files should only define app-specific accent overrides (--accent-color,
 * --button-primary, --color-accent, --gradient-accent, etc.) and app-specific
 * component classes.
 */

const SHARED_BASE_VARS = [
  "--bg-primary:",
  "--bg-secondary:",
  "--bg-tertiary:",
  "--bg-sidebar:",
  "--border-color:",
  "--text-color:",
  "--arctic-deep:",
  "--arctic-dark:",
  "--space-xs:",
  "--space-sm:",
  "--text-xs:",
  "--text-sm:",
  "--text-base:",
  "--card-bg:",
  "--danger:",
  "--success:",
  "--warning:",
];

const SHARED_IMPORT = "arctic-theme-base";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects App.css files that redefine shared arctic-theme-base variables " +
        "instead of importing the shared base from @the-canonry/shared-components.",
    },
    messages: {
      missingBaseImport:
        "App.css redefines shared base variables ({{vars}}) instead of importing " +
        '@the-canonry/shared-components/styles/arctic-theme-base. Add `@import ' +
        '"@the-canonry/shared-components/styles/arctic-theme-base";` and keep ' +
        "only app-specific accent overrides. See docs/adr/036-app-css-base-consolidation.md",
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Only check imports of App.css from app entry points
        if (!source.endsWith("App.css") && !source.endsWith("/App.css")) return;
        if (!source.startsWith(".")) return;

        const filename = context.filename || context.getFilename();

        // Only applies to files inside apps/
        if (!filename.includes("/apps/")) return;

        const fileDir = dirname(filename);
        const cssPath = resolve(fileDir, source);

        let cssContent;
        try {
          cssContent = readFileSync(cssPath, "utf8");
        } catch {
          return; // Can't read file, skip
        }

        // Check if the shared base import is present
        if (cssContent.includes(SHARED_IMPORT)) return;

        // Check which shared base vars are redefined
        const found = SHARED_BASE_VARS.filter((v) => cssContent.includes(v));

        if (found.length >= 3) {
          context.report({
            node,
            messageId: "missingBaseImport",
            data: {
              vars: found.slice(0, 4).join(", ") + (found.length > 4 ? ", ..." : ""),
            },
          });
        }
      },
    };
  },
};
