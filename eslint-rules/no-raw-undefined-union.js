/**
 * ESLint rule: no-raw-undefined-union
 *
 * In interface and type alias property signatures, raw `| undefined` must be
 * replaced with Optional<T>, Legacy<T>, or another named alias from
 * packages/shared-components/src/types/optionality.ts.
 *
 * Rationale: forces explicit declaration of WHY a property can be undefined,
 * making LLM-added defensive optionality visible and reviewable.
 *
 * Exempt: return types, function parameters, variable declarations, type casts.
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require named optionality aliases (Optional<T>, Legacy<T>) instead of raw | undefined in property signatures',
      url: 'docs/patterns/optionality-aliases.md',
    },
    messages: {
      noRawUndefined:
        "Raw '| undefined' in property signature. Use Optional<T>, Legacy<T>, or another named alias. See docs/patterns/optionality-aliases.md",
    },
    schema: [],
  },

  create(context) {
    function isInsidePropertySignature(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'TSPropertySignature' ||
          current.type === 'TSIndexSignature'
        ) {
          return true;
        }
        // Stop climbing at function, generic, or type boundaries that aren't property sigs
        if (
          current.type === 'TSFunctionType' ||
          current.type === 'TSMethodSignature' ||
          current.type === 'FunctionDeclaration' ||
          current.type === 'ArrowFunctionExpression' ||
          current.type === 'TSTypeParameterInstantiation' ||
          current.type === 'TSTypeAliasDeclaration'
        ) {
          return false;
        }
        current = current.parent;
      }
      return false;
    }

    return {
      TSUnionType(node) {
        const hasUndefined = node.types.some(
          (t) => t.type === 'TSUndefinedKeyword'
        );
        if (!hasUndefined) return;
        if (!isInsidePropertySignature(node)) return;

        context.report({ node, messageId: 'noRawUndefined' });
      },
    };
  },
};
