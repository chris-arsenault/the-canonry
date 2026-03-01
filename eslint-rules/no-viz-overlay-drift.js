// drift-generated
/**
 * Bans per-component visualization overlay CSS class names that were unified
 * into the shared visualization-overlay.css pattern.
 *
 * The canonical approach uses `viz-*` classes (viz-container, viz-legend,
 * viz-controls, viz-no-webgl, etc.) with theme variants via viz-theme-blue
 * and viz-theme-golden.
 *
 * Old per-component prefixes (gv-wrapper, gv-legend, gv-controls, gv3d-*,
 * tv3d-container, tv3d-legend, tv3d-controls, tv3d-no-webgl) are banned.
 */

// Banned class name patterns — old per-component overlay classes.
// Component-specific classes that DON'T overlap with shared patterns are allowed:
//   gv-cytoscape, gv-shape-*, tv3d-era-swatch, tv3d-era-link
const BANNED_PATTERNS = [
  // Old GraphView overlay classes (replaced by viz-*)
  /\bgv-wrapper\b/,
  /\bgv-legend\b/,
  /\bgv-legend-header\b/,
  /\bgv-legend-footer\b/,
  /\bgv-legend-swatch\b/,
  /\bgv-controls\b/,
  /\bgv-controls-header\b/,
  // Old GraphView3D overlay classes (replaced by viz-*)
  /\bgv3d-/,
  // Old TimelineView3D overlay classes (replaced by viz-*)
  /\btv3d-container\b/,
  /\btv3d-legend\b/,
  /\btv3d-legend-header\b/,
  /\btv3d-legend-footer\b/,
  /\btv3d-legend-swatch\b/,
  /\btv3d-controls\b/,
  /\btv3d-controls-header\b/,
  /\btv3d-no-webgl/,
];

// Old per-component CSS custom property names
const BANNED_CSS_VARS = [
  "--gv-swatch-color",
  "--gv3d-swatch-color",
  "--tv3d-swatch-color",
];

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans old per-component visualization overlay CSS classes. " +
        "Use the shared viz-* classes from visualization-overlay.css instead.",
    },
    messages: {
      bannedClassName:
        "CSS class '{{className}}' is a deprecated per-component overlay class. " +
        "Use the shared viz-* classes from visualization-overlay.css instead " +
        "(e.g., viz-container, viz-legend, viz-controls, viz-no-webgl). " +
        "See docs/adr/026-visualization-overlay-css.md",
      bannedCssVar:
        "CSS variable '{{varName}}' is deprecated. " +
        "Use '--viz-swatch-color' instead. " +
        "See docs/adr/026-visualization-overlay-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Only apply to archivist visualization components
    if (!filename.includes("archivist")) return {};

    function checkStringForBannedClasses(node, value) {
      for (const pattern of BANNED_PATTERNS) {
        const match = value.match(pattern);
        if (match) {
          context.report({
            node,
            messageId: "bannedClassName",
            data: { className: match[0] },
          });
          return; // one report per string is enough
        }
      }
    }

    function checkStringForBannedVars(node, value) {
      for (const varName of BANNED_CSS_VARS) {
        if (value.includes(varName)) {
          context.report({
            node,
            messageId: "bannedCssVar",
            data: { varName },
          });
          return;
        }
      }
    }

    return {
      // Check className="..." string literals
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        // className="literal string"
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          checkStringForBannedClasses(node, node.value.value);
        }

        // className={`template ${literal}`}
        if (node.value && node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkStringForBannedClasses(node, quasi.value.raw);
            }
          }
          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkStringForBannedClasses(node, expr.value);
          }
        }
      },

      // Check style={{ '--old-var': ... }} property names
      Property(node) {
        if (node.key.type === "Literal" && typeof node.key.value === "string") {
          checkStringForBannedVars(node, node.key.value);
        }
      },
    };
  },
};
