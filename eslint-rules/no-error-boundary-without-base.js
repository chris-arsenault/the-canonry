// drift-generated
/**
 * ESLint rule: no-error-boundary-without-base
 *
 * Ensures the error-boundary container always composes on the empty-state
 * base layout classes. The error-boundary.css file only contains overrides;
 * the centered flex-column layout lives in empty-state.css.
 *
 * See ADR 042, docs/patterns/centered-message-layout.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require error-boundary containers to include the empty-state base class.",
    },
    messages: {
      missingBase:
        'Elements with "error-boundary" must also include the "empty-state" base class. ' +
        "error-boundary.css only contains overrides — the centered layout comes from " +
        "empty-state.css. Use className=\"empty-state error-boundary\". " +
        "See docs/patterns/centered-message-layout.md (ADR 042).",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Exempt the ErrorBoundary component itself and its CSS
    if (/ErrorBoundary\.[jt]sx?$/.test(filename)) return {};

    return {
      JSXOpeningElement(node) {
        // Find className attribute
        const classAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.name === "className",
        );
        if (!classAttr || !classAttr.value) return;

        const classValue = extractClassString(classAttr.value);
        if (!classValue) return;

        // Only check elements that use error-boundary (the container class)
        if (!/\berror-boundary\b/.test(classValue)) return;

        // Ensure empty-state base class is also present
        if (!/\bempty-state\b/.test(classValue)) {
          context.report({
            node,
            messageId: "missingBase",
          });
        }
      },
    };
  },
};

/**
 * Extract a class name string from a JSX attribute value node.
 */
function extractClassString(valueNode) {
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    return valueNode.value;
  }
  if (valueNode.type === "JSXExpressionContainer") {
    const expr = valueNode.expression;
    if (expr.type === "Literal" && typeof expr.value === "string") {
      return expr.value;
    }
    if (expr.type === "TemplateLiteral") {
      return expr.quasis.map((q) => q.value.raw).join("");
    }
  }
  return null;
}
