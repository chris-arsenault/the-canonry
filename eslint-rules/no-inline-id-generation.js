// drift-generated
/**
 * Bans inline prefixed ID generation (Date.now() + crypto.randomUUID() in template literals).
 *
 * The canonical pattern is to use generatePrefixedId(prefix, sliceLength?) from
 * apps/illuminator/webui/src/lib/db/generatePrefixedId.ts (or a local copy for
 * packages outside illuminator). Hand-rolling the template is the drift pattern
 * this rule prevents.
 *
 * @see docs/adr/022-prefixed-id-generation.md
 * @see docs/patterns/prefixed-id-generation.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow inline Date.now() + crypto.randomUUID() ID generation in template literals",
    },
    messages: {
      noInlineIdGeneration:
        "Do not hand-roll prefixed IDs with Date.now() + crypto.randomUUID(). " +
        "Use generatePrefixedId(prefix, sliceLength?) instead. " +
        "See docs/patterns/prefixed-id-generation.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // The canonical implementation file is exempt
    if (/generatePrefixedId\.[tj]s$/.test(filename)) return {};

    /**
     * Return true if `node` is inside a function named `generatePrefixedId`.
     * This exempts any local copy of the canonical utility (e.g. in lore-weave).
     */
    function insideCanonicalImpl(node) {
      let cursor = node.parent;
      while (cursor) {
        if (
          (cursor.type === "FunctionDeclaration" ||
            cursor.type === "FunctionExpression" ||
            cursor.type === "ArrowFunctionExpression") &&
          cursor.id &&
          cursor.id.name === "generatePrefixedId"
        ) {
          return true;
        }
        cursor = cursor.parent;
      }
      return false;
    }

    /**
     * Walk an expression tree and return true if it contains a call to
     * `Date.now()` or `crypto.randomUUID()`.
     */
    function containsCall(node, objName, propName) {
      if (!node) return false;
      if (
        node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" &&
        node.callee.object.name === objName &&
        node.callee.property.name === propName
      ) {
        return true;
      }
      // Walk into chained calls like crypto.randomUUID().slice(0, 8)
      if (node.type === "CallExpression") {
        if (containsCall(node.callee, objName, propName)) return true;
        if (
          node.callee.type === "MemberExpression" &&
          containsCall(node.callee.object, objName, propName)
        ) {
          return true;
        }
      }
      return false;
    }

    return {
      TemplateLiteral(node) {
        const exprs = node.expressions;
        if (exprs.length < 2) return;

        let hasDateNow = false;
        let hasCryptoUUID = false;

        for (const expr of exprs) {
          if (containsCall(expr, "Date", "now")) hasDateNow = true;
          if (containsCall(expr, "crypto", "randomUUID")) hasCryptoUUID = true;
        }

        if (hasDateNow && hasCryptoUUID && !insideCanonicalImpl(node)) {
          context.report({ node, messageId: "noInlineIdGeneration" });
        }
      },
    };
  },
};
