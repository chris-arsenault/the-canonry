/**
 * ESLint rule: no-inline-styles
 *
 * Bans the `style` attribute on JSX elements. All styling should use
 * CSS classes in component-local .css files or global framework styles.
 *
 * See: docs/adr/004-css-architecture.md
 * See: docs/patterns/css-architecture.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow inline style attributes on JSX elements. Use CSS classes instead.",
    },
    messages: {
      noInlineStyle:
        "Inline style attribute found. Move styling to a component-local .css file using CSS classes. " +
        "For dynamic values, use CSS custom properties set via className + a scoped CSS rule. " +
        "See docs/adr/004-css-architecture.md",
    },
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.type === "JSXIdentifier" &&
          node.name.name === "style"
        ) {
          context.report({
            node,
            messageId: "noInlineStyle",
          });
        }
      },
    };
  },
};
