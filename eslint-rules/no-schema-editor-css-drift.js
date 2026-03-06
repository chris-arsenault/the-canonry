// drift-generated
/**
 * Prevents SchemaEditor sub-components from re-declaring CSS utility classes
 * that belong in schema-editor-shared.css.
 *
 * Detects className strings containing known shared-utility suffixes
 * (e.g. "-select-compact", "-chip-framework", "-checkbox") with a component
 * prefix other than the shared "se-" prefix.
 */

const SHARED_SUFFIXES = ["-select-compact", "-chip-framework"];
const SHARED_CHECKBOX_PATTERN = /\b([a-z]+-checkbox)\b/;

function isSchemaEditorFile(filename) {
  return /SchemaEditor[/\\]/.test(filename);
}

function checkClassString(value, node, context, valueNode) {
  if (typeof value !== "string") return;
  const classes = value.split(/\s+/);
  for (const cls of classes) {
    for (const suffix of SHARED_SUFFIXES) {
      if (cls.endsWith(suffix) && !cls.startsWith("se-")) {
        const sharedClass = `se${suffix}`;
        context.report({
          node,
          messageId: "sharedSuffix",
          data: { className: cls, sharedClass },
          fix(fixer) {
            return replaceClassInSource(fixer, valueNode, cls, sharedClass);
          },
        });
      }
    }
    const checkboxMatch = SHARED_CHECKBOX_PATTERN.exec(cls);
    if (checkboxMatch && !cls.startsWith("se-")) {
      const sharedClass = "se-checkbox-sm";
      context.report({
        node,
        messageId: "sharedCheckbox",
        data: { className: cls, sharedClass },
        fix(fixer) {
          return replaceClassInSource(fixer, valueNode, cls, sharedClass);
        },
      });
    }
  }
}

/**
 * Replace a class name within a TemplateLiteral node's quasis.
 */
function replaceClassInTemplateLiteral(fixer, expr, oldClass, newClass) {
  for (const quasi of expr.quasis) {
    const idx = quasi.value.raw.indexOf(oldClass);
    if (idx >= 0) {
      const start = quasi.range[0] + 1 + idx; // +1 for backtick/brace
      const end = start + oldClass.length;
      return fixer.replaceTextRange([start, end], newClass);
    }
  }
  return null;
}

/**
 * Replace a class name within a Literal or TemplateLiteral value node's source text.
 */
function replaceClassInSource(fixer, valueNode, oldClass, newClass) {
  if (!valueNode) return null;

  // className="..."
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") {
    const newValue = valueNode.value.replace(oldClass, newClass);
    return fixer.replaceText(valueNode, `"${newValue}"`);
  }

  // className={"..."} or className={`...`}
  if (valueNode.type === "JSXExpressionContainer") {
    const expr = valueNode.expression;
    if (expr.type === "Literal" && typeof expr.value === "string") {
      const newValue = expr.value.replace(oldClass, newClass);
      return fixer.replaceText(expr, `"${newValue}"`);
    }
    if (expr.type === "TemplateLiteral") {
      return replaceClassInTemplateLiteral(fixer, expr, oldClass, newClass);
    }
  }
  return null;
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Prevents SchemaEditor sub-components from duplicating CSS utility classes " +
        "that should come from schema-editor-shared.css.",
    },
    messages: {
      sharedSuffix:
        "Class '{{className}}' duplicates a shared SchemaEditor utility. " +
        "Use '{{sharedClass}}' from schema-editor-shared.css instead. " +
        "See docs/adr/035-schema-editor-shared-css.md",
      sharedCheckbox:
        "Class '{{className}}' duplicates a shared SchemaEditor utility. " +
        "Use '{{sharedClass}}' from schema-editor-shared.css instead. " +
        "See docs/adr/035-schema-editor-shared-css.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    if (!isSchemaEditorFile(filename)) return {};

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;

        const val = node.value;
        if (!val) return;

        // className="literal-string"
        if (val.type === "Literal" && typeof val.value === "string") {
          checkClassString(val.value, node, context, val);
        }

        // className={`template ${expr}`}
        if (val.type === "JSXExpressionContainer") {
          const expr = val.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkClassString(quasi.value.raw, node, context, val);
            }
          }
          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkClassString(expr.value, node, context, val);
          }
        }
      },
    };
  },
};
