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

// Explicit mapping for classes with known viz-* equivalents
const CLASS_MAPPING = {
  "gv-wrapper": "viz-container",
  "gv-legend": "viz-legend",
  "gv-legend-header": "viz-legend-header",
  "gv-legend-footer": "viz-legend-footer",
  "gv-legend-swatch": "viz-legend-swatch",
  "gv-controls": "viz-controls",
  "gv-controls-header": "viz-controls-header",
  "tv3d-container": "viz-container",
  "tv3d-legend": "viz-legend",
  "tv3d-legend-header": "viz-legend-header",
  "tv3d-legend-footer": "viz-legend-footer",
  "tv3d-legend-swatch": "viz-legend-swatch",
  "tv3d-controls": "viz-controls",
  "tv3d-controls-header": "viz-controls-header",
  "tv3d-no-webgl": "viz-no-webgl",
};

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

// Old per-component CSS custom property names → canonical
const CSS_VAR_MAPPING = {
  "--gv-swatch-color": "--viz-swatch-color",
  "--gv3d-swatch-color": "--viz-swatch-color",
  "--tv3d-swatch-color": "--viz-swatch-color",
};
const BANNED_CSS_VARS = Object.keys(CSS_VAR_MAPPING);

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
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
        "Use '{{replacement}}' instead. " +
        "See docs/adr/026-visualization-overlay-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Only apply to archivist visualization components
    if (!filename.includes("archivist")) return {};

    function checkStringForBannedClasses(node, value, valueNode) {
      for (const pattern of BANNED_PATTERNS) {
        const match = value.match(pattern);
        if (match) {
          const oldClass = match[0];
          const replacement = CLASS_MAPPING[oldClass];
          context.report({
            node,
            messageId: "bannedClassName",
            data: { className: oldClass },
            fix: replacement
              ? (fixer) => replaceInNode(fixer, valueNode, oldClass, replacement)
              : undefined,
          });
          return; // one report per string is enough
        }
      }
    }

    function checkStringForBannedVars(node, value) {
      for (const varName of BANNED_CSS_VARS) {
        if (value.includes(varName)) {
          const replacement = CSS_VAR_MAPPING[varName];
          context.report({
            node,
            messageId: "bannedCssVar",
            data: { varName, replacement },
            fix(fixer) {
              // node.key is the Property key Literal
              return fixer.replaceText(node.key, `"${replacement}"`);
            },
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
          checkStringForBannedClasses(node, node.value.value, node.value);
        }

        // className={`template ${literal}`}
        if (node.value && node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkStringForBannedClasses(node, quasi.value.raw, quasi);
            }
          }
          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkStringForBannedClasses(node, expr.value, expr);
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

/**
 * Replace oldStr with newStr in a Literal or TemplateElement node.
 */
function replaceInNode(fixer, valueNode, oldStr, newStr) {
  if (!valueNode) return null;

  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    const newValue = valueNode.value.replace(oldStr, newStr);
    return fixer.replaceText(valueNode, `"${newValue}"`);
  }

  if (valueNode.type === "TemplateElement") {
    const idx = valueNode.value.raw.indexOf(oldStr);
    if (idx >= 0) {
      const start = valueNode.range[0] + 1 + idx;
      const end = start + oldStr.length;
      return fixer.replaceTextRange([start, end], newStr);
    }
  }

  return null;
}
