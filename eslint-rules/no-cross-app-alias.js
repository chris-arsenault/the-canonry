// drift-generated
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow non-standard Vite resolve.alias entries in vite.config files",
    },
    messages: {
      bannedAlias:
        '{{reason}} Only "@lib" \u2192 "../lib" is permitted for apps with a sibling lib directory. See docs/patterns/vite-alias-configuration.md',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    if (!/(^|[/\\])vite\.config\.[jt]s$/.test(filename)) return {};

    function isInsideResolveAlias(node) {
      const aliasObj = node.parent;
      if (aliasObj?.type !== "ObjectExpression") return false;

      const aliasProp = aliasObj.parent;
      if (aliasProp?.type !== "Property") return false;
      if ((aliasProp.key?.name || aliasProp.key?.value) !== "alias")
        return false;

      const resolveObj = aliasProp.parent;
      if (resolveObj?.type !== "ObjectExpression") return false;

      const resolveProp = resolveObj.parent;
      if (resolveProp?.type !== "Property") return false;
      if ((resolveProp.key?.name || resolveProp.key?.value) !== "resolve")
        return false;

      return true;
    }

    function getPathArgument(callExpr) {
      if (callExpr?.type !== "CallExpression") return null;
      const args = callExpr.arguments;
      if (!args?.length) return null;
      const lastArg = args[args.length - 1];
      if (lastArg?.type === "Literal" && typeof lastArg.value === "string") {
        return lastArg.value;
      }
      return null;
    }

    return {
      Property(node) {
        if (!isInsideResolveAlias(node)) return;

        const aliasName = node.key?.value || node.key?.name;
        if (!aliasName) return;

        // Allow: '@lib' -> '../lib'
        if (aliasName === "@lib") {
          const pathArg = getPathArgument(node.value);
          if (pathArg === "../lib") return;
        }

        const pathArg = getPathArgument(node.value);
        let reason;
        if (pathArg && /packages\/.*\/src\//.test(pathArg)) {
          reason = `Package source alias "${aliasName}" is redundant \u2014 workspace resolution already reaches the source.`;
        } else if (pathArg && /\.\.\/\.\.\//.test(pathArg)) {
          reason = `Cross-app alias "${aliasName}" creates hidden coupling between MFEs.`;
        } else {
          reason = `Non-standard alias "${aliasName}" is not in the permitted set.`;
        }

        context.report({
          node,
          messageId: "bannedAlias",
          data: { reason },
        });
      },
    };
  },
};
