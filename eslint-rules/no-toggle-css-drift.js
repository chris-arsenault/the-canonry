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

// Matches the toggle-starting portion of a class name token
const TOGGLE_SUFFIX_RE = /toggle[-\w]*/i;

function checkStringForNonCanonicalToggle(value, node, context) {
  // Split on whitespace to isolate each class name token
  const tokens = value.trim().split(/\s+/);
  for (const token of tokens) {
    if (!token.toLowerCase().includes("toggle")) continue;
    const m = TOGGLE_SUFFIX_RE.exec(token);
    if (!m) continue;
    const className = m[0].toLowerCase();
    // Only flag if this looks like a toggle class but isn't canonical
    if (!CANONICAL_TOGGLE_CLASSES.has(className)) {
      context.report({
        node,
        messageId: "nonCanonicalToggle",
        data: { className: m[0] },
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
