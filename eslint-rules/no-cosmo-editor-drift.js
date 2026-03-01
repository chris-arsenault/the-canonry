// drift-generated
/**
 * Bans per-component CSS class names in cosmographer editor components
 * that were unified into the shared cosmographer-editor.css pattern.
 *
 * The canonical approach uses `cosmo-*` classes (cosmo-modal, cosmo-form-group,
 * cosmo-input, cosmo-add-btn, cosmo-delete-btn, cosmo-empty-state, etc.)
 * from apps/cosmographer/webui/src/styles/cosmographer-editor.css.
 *
 * Old per-component prefixes for shared concerns are banned:
 *   axr-modal, axr-form-group, axr-label, axr-input, axr-add-button, etc.
 *   re-modal, re-form-group, re-label, re-input, re-add-button, etc.
 */

// Explicit mapping from banned class names → canonical cosmo-* equivalents.
// Where the suffix changes (e.g. add-button → add-btn), the mapping is explicit.
const CLASS_MAPPING = {
  // AxisRegistry → cosmo-*
  "axr-container": "cosmo-container",
  "axr-header": "cosmo-header",
  "axr-title": "cosmo-title",
  "axr-subtitle": "cosmo-subtitle",
  "axr-toolbar": "cosmo-toolbar",
  "axr-add-button": "cosmo-add-btn",
  "axr-count": "cosmo-count",
  "axr-actions": "cosmo-actions",
  "axr-edit-button": "cosmo-edit-btn",
  "axr-delete-button": "cosmo-delete-btn",
  "axr-empty-state": "cosmo-empty-state",
  "axr-modal": "cosmo-modal",
  "axr-modal-title": "cosmo-modal-title",
  "axr-modal-actions": "cosmo-modal-actions",
  "axr-form-group": "cosmo-form-group",
  "axr-label": "cosmo-label",
  "axr-input": "cosmo-input",
  "axr-hint": "cosmo-hint",
  "axr-cancel-button": "cosmo-cancel-btn",
  "axr-arrow": "cosmo-arrow",
  // RelationshipEditor → cosmo-*
  "re-container": "cosmo-container",
  "re-header": "cosmo-header",
  "re-title": "cosmo-title",
  "re-subtitle": "cosmo-subtitle",
  "re-toolbar": "cosmo-toolbar",
  "re-add-button": "cosmo-add-btn",
  "re-delete-button": "cosmo-delete-btn",
  "re-empty-state": "cosmo-empty-state",
  "re-modal": "cosmo-modal",
  "re-modal-title": "cosmo-modal-title",
  "re-modal-actions": "cosmo-modal-actions",
  "re-form-group": "cosmo-form-group",
  "re-label": "cosmo-label",
  "re-input": "cosmo-input",
  "re-select": "cosmo-select",
  "re-button": "cosmo-button",
  "re-hint": "cosmo-hint",
  "re-arrow": "cosmo-arrow",
};

// Build BANNED_PATTERNS from the mapping keys
const BANNED_PATTERNS = Object.keys(CLASS_MAPPING).map(
  (cls) => new RegExp(`\\b${cls.replace(/-/g, "\\-")}\\b`),
);

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Bans old per-component CSS classes in cosmographer editors. " +
        "Use the shared cosmo-* classes from cosmographer-editor.css instead.",
    },
    messages: {
      bannedClassName:
        "CSS class '{{className}}' is a deprecated per-component editor class. " +
        "Use '{{replacement}}' from cosmographer-editor.css instead. " +
        "See docs/adr/040-cosmographer-editor-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Only apply to cosmographer components
    if (!filename.includes("cosmographer")) return {};

    function checkAndFixString(node, value, valueNode) {
      for (let i = 0; i < BANNED_PATTERNS.length; i++) {
        const pattern = BANNED_PATTERNS[i];
        const match = value.match(pattern);
        if (match) {
          const oldClass = match[0];
          const replacement = CLASS_MAPPING[oldClass] || `cosmo-${oldClass.split("-").slice(1).join("-")}`;
          context.report({
            node,
            messageId: "bannedClassName",
            data: { className: oldClass, replacement },
            fix(fixer) {
              return replaceClassInNode(fixer, valueNode, oldClass, replacement);
            },
          });
          return; // one report per string is enough
        }
      }
    }

    return {
      // Check className="..." string literals
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        // className="literal string"
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          checkAndFixString(node, node.value.value, node.value);
        }

        // className={`template ${literal}`}
        if (node.value && node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkAndFixString(node, quasi.value.raw, quasi);
            }
          }
          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkAndFixString(node, expr.value, expr);
          }
        }
      },
    };
  },
};

/**
 * Replace oldClass with newClass in a Literal or TemplateElement node.
 */
function replaceClassInNode(fixer, valueNode, oldClass, newClass) {
  if (!valueNode) return null;

  // String literal: "foo-bar baz"
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    const newValue = valueNode.value.replace(oldClass, newClass);
    return fixer.replaceText(valueNode, `"${newValue}"`);
  }

  // Template element (quasi): part of `...`
  if (valueNode.type === "TemplateElement") {
    const idx = valueNode.value.raw.indexOf(oldClass);
    if (idx >= 0) {
      const start = valueNode.range[0] + 1 + idx; // +1 for backtick/brace
      const end = start + oldClass.length;
      return fixer.replaceTextRange([start, end], newClass);
    }
  }

  return null;
}
