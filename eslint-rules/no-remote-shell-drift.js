// drift-generated
/**
 * Bans per-app remote shell CSS class names that were unified into the shared
 * remote-shell.css pattern.
 *
 * The canonical approach uses `rs-*` classes (rs-container, rs-sidebar, rs-nav,
 * rs-nav-button, rs-main, rs-content, rs-placeholder, rs-no-data, etc.) from
 * packages/shared-components/src/styles/components/remote-shell.css.
 *
 * Per-app accent customisation is done via CSS custom properties
 * (--rs-active-from, --rs-active-to, --rs-hover-bg, --rs-hover-color) scoped
 * to an app-specific class on the root container.
 *
 * Old per-app prefixes (cer-container, cer-sidebar, cosmo-container,
 * cosmo-sidebar, etc.) are banned.
 */

// Banned class name patterns — old per-app remote shell layout classes.
const BANNED_PATTERNS = [
  // Old CoherenceEngineRemote shell classes (replaced by rs-*)
  /\bcer-container\b/,
  /\bcer-sidebar\b/,
  /\bcer-nav\b/,
  /\bcer-nav-button\b/,
  /\bcer-nav-button-active\b/,
  /\bcer-nav-button-inactive\b/,
  /\bcer-nav-button-content\b/,
  /\bcer-status-dot\b/,
  /\bcer-main\b/,
  /\bcer-content\b/,
  /\bcer-placeholder\b/,
  /\bcer-placeholder-icon\b/,
  /\bcer-placeholder-title\b/,
  /\bcer-placeholder-desc\b/,
  // Old CosmographerRemote shell classes (replaced by rs-*)
  /\bcosmo-container\b/,
  /\bcosmo-sidebar\b/,
  /\bcosmo-nav\b/,
  /\bcosmo-nav-button\b/,
  /\bcosmo-nav-button-active\b/,
  /\bcosmo-nav-button-inactive\b/,
  /\bcosmo-main\b/,
  /\bcosmo-content\b/,
  /\bcosmo-no-schema\b/,
  /\bcosmo-no-schema-title\b/,
];

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans old per-app remote shell CSS class names. " +
        "Use the shared rs-* classes from remote-shell.css instead.",
    },
    messages: {
      bannedClassName:
        "CSS class '{{className}}' is a deprecated per-app remote shell class. " +
        "Use the shared rs-* classes from remote-shell.css instead " +
        "(e.g., rs-container, rs-sidebar, rs-nav, rs-nav-button, rs-main, rs-content). " +
        "Per-app accent colors go in CSS custom properties (--rs-active-from, --rs-active-to). " +
        "See docs/adr/027-remote-shell-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Only apply to remote entry point components in app webui dirs
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
