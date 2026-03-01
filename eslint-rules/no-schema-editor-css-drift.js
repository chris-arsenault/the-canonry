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
const SHARED_CHECKBOX_PATTERN = /\b[a-z]+-checkbox\b/;

function isSchemaEditorFile(filename) {
  return /SchemaEditor[/\\]/.test(filename);
}

function checkClassString(value, node, context) {
  if (typeof value !== "string") return;
  const classes = value.split(/\s+/);
  for (const cls of classes) {
    for (const suffix of SHARED_SUFFIXES) {
      if (cls.endsWith(suffix) && !cls.startsWith("se-")) {
        context.report({
          node,
          messageId: "sharedSuffix",
          data: { className: cls, sharedClass: `se${suffix}` },
        });
      }
    }
    if (SHARED_CHECKBOX_PATTERN.test(cls) && !cls.startsWith("se-")) {
      context.report({
        node,
        messageId: "sharedCheckbox",
        data: { className: cls, sharedClass: "se-checkbox-sm" },
      });
    }
  }
}

export default {
  meta: {
    type: "suggestion",
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
          checkClassString(val.value, node, context);
        }

        // className={`template ${expr}`}
        if (val.type === "JSXExpressionContainer") {
          const expr = val.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkClassString(quasi.value.raw, node, context);
            }
          }
          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkClassString(expr.value, node, context);
          }
        }
      },
    };
  },
};
