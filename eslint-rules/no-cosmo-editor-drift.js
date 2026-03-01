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

// Banned class name patterns — old per-component classes for shared concerns.
// Component-specific classes (axr-axis-card, re-table, etc.) are NOT banned.
const BANNED_PATTERNS = [
  // Old AxisRegistry shared-concern classes (replaced by cosmo-*)
  /\baxr-container\b/,
  /\baxr-header\b/,
  /\baxr-title\b/,
  /\baxr-subtitle\b/,
  /\baxr-toolbar\b/,
  /\baxr-add-button\b/,
  /\baxr-count\b/,
  /\baxr-actions\b/,
  /\baxr-edit-button\b/,
  /\baxr-delete-button\b/,
  /\baxr-empty-state\b/,
  /\baxr-modal\b/,
  /\baxr-modal-title\b/,
  /\baxr-modal-actions\b/,
  /\baxr-form-group\b/,
  /\baxr-label\b/,
  /\baxr-input\b/,
  /\baxr-hint\b/,
  /\baxr-cancel-button\b/,
  /\baxr-arrow\b/,

  // Old RelationshipEditor shared-concern classes (replaced by cosmo-*)
  /\bre-container\b/,
  /\bre-header\b/,
  /\bre-title\b/,
  /\bre-subtitle\b/,
  /\bre-toolbar\b/,
  /\bre-add-button\b/,
  /\bre-delete-button\b/,
  /\bre-empty-state\b/,
  /\bre-modal\b/,
  /\bre-modal-title\b/,
  /\bre-modal-actions\b/,
  /\bre-form-group\b/,
  /\bre-label\b/,
  /\bre-input\b/,
  /\bre-select\b/,
  /\bre-button\b/,
  /\bre-hint\b/,
  /\bre-arrow\b/,
];

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans old per-component CSS classes in cosmographer editors. " +
        "Use the shared cosmo-* classes from cosmographer-editor.css instead.",
    },
    messages: {
      bannedClassName:
        "CSS class '{{className}}' is a deprecated per-component editor class. " +
        "Use the shared cosmo-* classes from cosmographer-editor.css instead " +
        "(e.g., cosmo-modal, cosmo-form-group, cosmo-input, cosmo-add-btn). " +
        "See docs/adr/040-cosmographer-editor-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Only apply to cosmographer components
    if (!filename.includes("cosmographer")) return {};

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
    };
  },
};
