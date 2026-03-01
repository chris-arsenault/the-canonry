// drift-generated
/**
 * Bans component-prefixed SVG visualization utility class names in the
 * ChronicleWizard/visualizations directory. These utilities (display:block,
 * pointer-events:none, cursor variants) live in visualization-base.css
 * and should be referenced with the shared viz-* prefix.
 *
 * See docs/patterns/visualization-base-css.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce shared viz-* utility classes instead of per-component duplicates in visualization CSS",
    },
    messages: {
      useSharedClass:
        'Use "{{shared}}" from visualization-base.css instead of component-prefixed "{{found}}". See docs/patterns/visualization-base-css.md',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only enforce in the visualizations directory
    if (!filename.includes("ChronicleWizard/visualizations") &&
        !filename.includes("ChronicleWizard\\visualizations")) {
      return {};
    }

    // Utility suffixes that belong in visualization-base.css
    // Maps suffix → shared class name
    const UTILITY_SUFFIXES = {
      "no-pointer": "viz-no-pointer",
      "cursor-pointer": "viz-cursor-pointer",
      "grab": "viz-grab",
      "ew-resize": "viz-ew-resize",
    };

    // Pattern: any 2-3 letter prefix followed by a dash and a known utility suffix
    // e.g. ec-no-pointer, tb-grab, nt-cursor-pointer
    const DRIFT_PATTERN = /\b([a-z]{2,4})-(no-pointer|cursor-pointer|grab|ew-resize)\b/g;

    function checkClassString(node, value) {
      let match;
      DRIFT_PATTERN.lastIndex = 0;
      while ((match = DRIFT_PATTERN.exec(value)) !== null) {
        const fullMatch = match[0];
        const suffix = match[2];
        const shared = UTILITY_SUFFIXES[suffix];

        // Don't flag the shared viz-* classes themselves
        if (fullMatch.startsWith("viz-")) continue;

        context.report({
          node,
          messageId: "useSharedClass",
          data: { shared, found: fullMatch },
        });
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        // className="literal string"
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          checkClassString(node, node.value.value);
        }

        // className={`template ${literal}`}
        if (
          node.value &&
          node.value.type === "JSXExpressionContainer" &&
          node.value.expression.type === "TemplateLiteral"
        ) {
          for (const quasi of node.value.expression.quasis) {
            checkClassString(node, quasi.value.raw);
          }
        }
      },
    };
  },
};
