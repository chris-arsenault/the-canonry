// drift-generated
/**
 * Prevents re-introduction of non-canonical toggle CSS class names.
 *
 * The canonical toggle classes live in shared-components/src/styles/components/toggle.css:
 *   .toggle, .toggle-on, .toggle-disabled, .toggle-knob, .toggle-container, .toggle-label
 *
 * This rule flags JSX className values that contain toggle-related class names
 * NOT in the canonical set (e.g. "enable-toggle", "custom-toggle-switch").
 */

const CANONICAL_TOGGLE_CLASSES = new Set([
  "toggle",
  "toggle-on",
  "toggle-disabled",
  "toggle-knob",
  "toggle-container",
  "toggle-label",
]);

// Matches class-name-like tokens that contain "toggle" (hyphenated identifiers)
const TOGGLE_CLASS_PATTERN = /\b[\w]*(toggle[\w-]*)\b/gi;

function checkStringForNonCanonicalToggle(value, node, context) {
  let match;
  TOGGLE_CLASS_PATTERN.lastIndex = 0;
  while ((match = TOGGLE_CLASS_PATTERN.exec(value)) !== null) {
    const className = match[1].toLowerCase();
    // Only flag if this looks like a toggle class but isn't canonical
    if (className.includes("toggle") && !CANONICAL_TOGGLE_CLASSES.has(className)) {
      context.report({
        node,
        messageId: "nonCanonicalToggle",
        data: { className: match[1] },
      });
    }
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans non-canonical toggle CSS class names in JSX. " +
        "Use the shared .toggle classes from toggle.css instead of inventing new toggle variants.",
    },
    messages: {
      nonCanonicalToggle:
        "Non-canonical toggle class '{{className}}' — use the shared .toggle / .toggle-on / .toggle-knob classes " +
        "from packages/shared-components/src/styles/components/toggle.css. " +
        "See docs/adr/038-toggle-css-consolidation.md",
    },
    schema: [],
  },

  create(context) {
    return {
      // Check className="..." string literals
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        // className="literal string"
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          checkStringForNonCanonicalToggle(node.value.value, node, context);
        }

        // className={`template ${literal}`}
        if (node.value && node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkStringForNonCanonicalToggle(quasi.value.raw, node, context);
            }
          }
          // className={"string"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkStringForNonCanonicalToggle(expr.value, node, context);
          }
        }
      },
    };
  },
};
