// drift-generated
/**
 * Bans old per-modal shell CSS class names from BulkEraNarrativeModal that were
 * unified into the shared BulkOperationShell pattern.
 *
 * The canonical approach for bulk operation modals is to use BulkOperationShell
 * (BulkOperationShell.jsx + BulkOperationShell.css) which provides:
 * - bulk-overlay, bulk-dialog (overlay + dialog container)
 * - bulk-header, bulk-header-row, bulk-title, bulk-header-actions (header)
 * - bulk-body, bulk-body-confirming (body)
 * - bulk-footer, bulk-footer-btn (footer)
 * - bulk-terminal-msg-* (terminal messages)
 * - bulk-progress-* (progress bar)
 * - bulk-cost (cost display)
 *
 * Each bulk modal should import BulkOperationShell and provide only
 * content-specific body markup. Old benm-* shell class names are banned.
 *
 * See docs/adr/028-bulk-modal-shell-consolidation.md
 */

// Banned class name patterns — old BulkEraNarrativeModal shell classes
// that duplicated BulkOperationShell.css. Content-specific benm-* classes
// (era lists, tone selectors, step progress) are still valid.
const BANNED_PATTERNS = [
  // Shell: overlay + dialog container
  /\bbenm-overlay\b/,
  /\bbenm-modal\b/,
  // Shell: header
  /\bbenm-header\b/,
  /\bbenm-header-row\b/,
  /\bbenm-title\b/,
  /\bbenm-header-actions\b/,
  /\bbenm-minimize-btn\b/,
  /\bbenm-status-label\b/,
  // Shell: body wrapper
  /\bbenm-body\b/,
  /\bbenm-body-confirming\b/,
  /\bbenm-body-processing\b/,
  // Shell: section label (use bulk-section-label instead)
  /\bbenm-section-label\b/,
  // Shell: terminal messages (use BulkTerminalMessage component)
  /\bbenm-terminal-msg\b/,
  /\bbenm-terminal-msg-complete\b/,
  /\bbenm-terminal-msg-cancelled\b/,
  /\bbenm-terminal-msg-failed\b/,
  // Shell: footer
  /\bbenm-footer\b/,
  /\bbenm-footer-btn\b/,
];

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans old BulkEraNarrativeModal shell CSS class names. " +
        "Use BulkOperationShell wrapper component and bulk-* classes instead.",
    },
    messages: {
      bannedClassName:
        "CSS class '{{className}}' is a deprecated bulk modal shell class. " +
        "Use BulkOperationShell component instead of rendering the shell inline. " +
        "Shell structure (overlay, header, footer, terminal messages) comes from " +
        "BulkOperationShell.jsx + BulkOperationShell.css (bulk-* classes). " +
        "See docs/adr/028-bulk-modal-shell-consolidation.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename.includes("webui/src")) return {};

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
