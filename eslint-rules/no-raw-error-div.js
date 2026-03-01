// drift-generated
/**
 * ESLint rule: no-raw-error-div
 *
 * Bans creating ad-hoc error display divs with error/failed CSS classes.
 * All error display must use the shared <ErrorMessage> component from
 * @the-canonry/shared-components. See ADR 021.
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow ad-hoc error display divs. Use <ErrorMessage> from shared-components.",
    },
    messages: {
      noRawErrorDiv:
        'Do not create ad-hoc error display divs with "error" or "failed" CSS classes. ' +
        'Use <ErrorMessage message={...}> from "@the-canonry/shared-components" instead. ' +
        "See docs/patterns/error-display.md (ADR 021).",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Exempt the ErrorMessage component itself
    if (/ErrorMessage\.[jt]sx?$/.test(filename)) return {};

    return {
      JSXOpeningElement(node) {
        // Only check <div> elements
        if (
          node.name.type !== "JSXIdentifier" ||
          node.name.name !== "div"
        )
          return;

        // Find className attribute
        const classAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.name === "className",
        );
        if (!classAttr || !classAttr.value) return;

        // Extract class string from various JSX patterns
        const classValue = extractClassString(classAttr.value);
        if (!classValue) return;

        // Allow canonical shared-component classes
        if (/\berror-message\b/.test(classValue)) return;
        if (/\berror-boundary\b/.test(classValue)) return;

        // Detect ad-hoc error display patterns:
        //   "error", "error-box", "imod-error", "dgm-failed",
        //   "pp-error-item", "ap-error-detail", etc.
        if (/\b(error|failed)\b/.test(classValue)) {
          context.report({
            node,
            messageId: "noRawErrorDiv",
          });
        }
      },
    };
  },
};

/**
 * Extract a class name string from a JSX attribute value node.
 * Handles: className="foo", className={"foo"}, className={`foo ${bar}`}
 */
function extractClassString(valueNode) {
  // String literal: className="error"
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    return valueNode.value;
  }
  // Expression container: className={...}
  if (valueNode.type === "JSXExpressionContainer") {
    const expr = valueNode.expression;
    // className={"error"}
    if (expr.type === "Literal" && typeof expr.value === "string") {
      return expr.value;
    }
    // className={`error ${x}`} — check template quasis (static parts)
    if (expr.type === "TemplateLiteral") {
      return expr.quasis.map((q) => q.value.raw).join("");
    }
  }
  return null;
}
