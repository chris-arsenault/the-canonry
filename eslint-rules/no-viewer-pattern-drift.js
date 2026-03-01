// drift-generated
/**
 * Detects component CSS imports inside coherence-engine viewer components
 * that define their own section/header/badge/empty-state patterns instead
 * of using the shared viewer-* utility classes from shared-components.
 *
 * This rule checks for CSS class names in JSX that follow the pattern of
 * reinventing viewer structural patterns with a component-specific prefix.
 *
 * See docs/adr/030-viewer-css-consolidation.md
 * See docs/patterns/viewer-css.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects component-prefixed CSS class names that duplicate shared viewer-* " +
        "utility patterns. New viewer components should compose viewer-* classes " +
        "from shared-components instead of defining their own prefixed copies.",
    },
    messages: {
      viewerPatternDrift:
        'Class "{{className}}" looks like a viewer structural pattern. ' +
        'Use the shared "viewer-{{pattern}}" class from shared-components/viewer.css instead. ' +
        "See docs/patterns/viewer-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only check files inside coherence-engine viewer component directories
    // and any future viewer components in other apps
    if (!filename.includes("/components/") || !filename.match(/\.(jsx|tsx)$/)) {
      return {};
    }

    // Patterns that indicate reinvention of shared viewer utilities.
    // Each entry: [regex to match class name, shared pattern name]
    const driftPatterns = [
      [/-section\b(?!-)/, "section"],
      [/-section-header\b/, "section-header"],
      [/-section-title\b/, "section-title"],
      [/-section-count\b/, "section-count"],
      [/-section-content\b/, "section-content"],
      [/-expand-icon\b/, "expand-icon"],
      [/-empty-state\b/, "empty-state"],
      [/-item-row\b/, "item-row"],
      [/-item-name\b/, "item-name"],
    ];

    // Existing component prefixes that are grandfathered (already tracked as
    // migration backlog in UNIFICATION_LOG.md). Do NOT flag these — the rule
    // is meant to catch NEW drift, not re-flag known tech debt.
    // "viewer-" is the canonical shared prefix — using it IS the fix.
    const grandfatheredPrefixes = [
      "viewer-",
      "dependency-viewer-",
      "dependency-",
      "naming-profile-",
      "validation-",
      "archivist-",
    ];

    function isGrandfathered(className) {
      return grandfatheredPrefixes.some((prefix) =>
        className.startsWith(prefix),
      );
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        // Handle string literal className="..."
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          checkClassNames(node.value.value.split(/\s+/), node);
        }

        // Handle template literal className={`...`}
        if (
          node.value &&
          node.value.type === "JSXExpressionContainer" &&
          node.value.expression.type === "TemplateLiteral"
        ) {
          for (const quasi of node.value.expression.quasis) {
            checkClassNames(quasi.value.raw.split(/\s+/), node);
          }
        }
      },
    };

    function checkClassNames(classNames, node) {
      for (const className of classNames) {
        if (!className || isGrandfathered(className)) continue;

        for (const [pattern, sharedName] of driftPatterns) {
          if (pattern.test(className)) {
            context.report({
              node,
              messageId: "viewerPatternDrift",
              data: { className, pattern: sharedName },
            });
            break;
          }
        }
      }
    }
  },
};
