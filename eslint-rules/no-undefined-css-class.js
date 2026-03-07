// drift-generated
/**
 * ESLint rule: no-undefined-css-class
 *
 * Reports className string literals that reference CSS classes not defined
 * in any imported stylesheet or global stylesheet directory.
 *
 * Catches bugs like using className="my-fancy-class" when no CSS file
 * defines .my-fancy-class — invisible to TypeScript, only fails at runtime.
 *
 * Skips:
 * - CSS module references (styles.foo) — already type-checked
 * - Fully dynamic classNames (variables, function calls)
 * - Template literal dynamic segments
 */
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, dirname, join } from "path";

/** Cache parsed CSS class sets by absolute path to avoid re-reading files. */
const cssClassCache = new Map();

/** Cache scanned directory class sets by directory path. */
const dirClassCache = new Map();

/**
 * Extract all CSS class names from a CSS file's content.
 * Matches .class-name patterns in selectors.
 */
function extractCssClasses(cssContent) {
  const classes = new Set();
  // Match .class-name in selectors (not inside property values)
  // Handles: .foo, .foo-bar, .foo_bar, .foo123
  const regex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = regex.exec(cssContent)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

/**
 * Parse a CSS file and return its class names (cached).
 */
function getClassesFromFile(absolutePath) {
  if (cssClassCache.has(absolutePath)) return cssClassCache.get(absolutePath);
  try {
    const content = readFileSync(absolutePath, "utf-8");
    const classes = extractCssClasses(content);
    cssClassCache.set(absolutePath, classes);
    return classes;
  } catch {
    const empty = new Set();
    cssClassCache.set(absolutePath, empty);
    return empty;
  }
}

/**
 * Recursively scan a directory for .css files and collect all class names (cached).
 */
function getClassesFromDir(dirPath) {
  if (dirClassCache.has(dirPath)) return dirClassCache.get(dirPath);
  const classes = new Set();
  try {
    if (!existsSync(dirPath)) {
      dirClassCache.set(dirPath, classes);
      return classes;
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        for (const cls of getClassesFromDir(fullPath)) classes.add(cls);
      } else if (entry.name.endsWith(".css") && !entry.name.endsWith(".module.css")) {
        for (const cls of getClassesFromFile(fullPath)) classes.add(cls);
      }
    }
  } catch {
    // Directory not readable — skip
  }
  dirClassCache.set(dirPath, classes);
  return classes;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow className string literals that reference CSS classes not defined in any imported or global stylesheet.",
    },
    messages: {
      undefinedClass:
        'CSS class "{{className}}" is not defined in any imported or global stylesheet.',
    },
    schema: [
      {
        type: "object",
        properties: {
          globalStyleDirs: {
            type: "array",
            items: { type: "string" },
            description:
              "Directories (relative to project root) to scan for global CSS class definitions.",
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const globalStyleDirs = options.globalStyleDirs || [];
    const filename = context.filename || context.getFilename();
    const fileDir = dirname(filename);

    // Find project root (walk up to find package.json or .git)
    let projectRoot = fileDir;
    const rootMatch = filename.match(/^(.+?)\/apps\//);
    if (rootMatch) {
      projectRoot = rootMatch[1];
    }

    // Collect all available CSS classes
    const availableClasses = new Set();

    // Track CSS imports as we encounter them
    const pendingCssImports = [];

    // Pre-scan global style directories
    for (const dir of globalStyleDirs) {
      const absDir = resolve(projectRoot, dir);
      for (const cls of getClassesFromDir(absDir)) {
        availableClasses.add(cls);
      }
    }

    /**
     * Check a single class name token against available classes.
     */
    function checkClass(className, node) {
      if (!className || className.length === 0) return;
      // Skip classes that look dynamic (contain template expressions etc)
      if (className.includes("$") || className.includes("{")) return;
      if (!availableClasses.has(className)) {
        context.report({
          node,
          messageId: "undefinedClass",
          data: { className },
        });
      }
    }

    /**
     * Check all space-separated class names in a string.
     */
    function checkClassString(value, node) {
      const classes = value.split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        checkClass(cls, node);
      }
    }

    return {
      // Collect CSS imports
      ImportDeclaration(node) {
        const source = node.source.value;
        // Side-effect CSS import: import "./Foo.css" (no specifiers)
        if (
          source.endsWith(".css") &&
          !source.endsWith(".module.css") &&
          node.specifiers.length === 0
        ) {
          const absPath = resolve(fileDir, source);
          for (const cls of getClassesFromFile(absPath)) {
            availableClasses.add(cls);
          }
        }
      },

      // Also scan the app's own styles directory (co-located CSS files)
      "Program:exit"() {
        // Scan for co-located CSS: if current file is Foo.tsx, check for Foo.css
        const baseName = filename.replace(/\.(tsx?|jsx?)$/, "");
        const colocatedCss = baseName + ".css";
        if (existsSync(colocatedCss)) {
          for (const cls of getClassesFromFile(colocatedCss)) {
            availableClasses.add(cls);
          }
        }

        // Scan the current directory for any .css files (common pattern)
        try {
          const dirEntries = readdirSync(fileDir);
          for (const entry of dirEntries) {
            if (entry.endsWith(".css") && !entry.endsWith(".module.css")) {
              for (const cls of getClassesFromFile(join(fileDir, entry))) {
                availableClasses.add(cls);
              }
            }
          }
        } catch {
          // Skip if directory not readable
        }
      },

      // Check className attributes
      JSXAttribute(node) {
        if (
          !node.name ||
          node.name.type !== "JSXIdentifier" ||
          node.name.name !== "className"
        ) {
          return;
        }

        const value = node.value;
        if (!value) return;

        // className="literal-string"
        if (value.type === "Literal" && typeof value.value === "string") {
          checkClassString(value.value, node);
          return;
        }

        // className={"literal-string"} or className={`template`}
        if (value.type === "JSXExpressionContainer") {
          const expr = value.expression;

          // className={"literal"}
          if (expr.type === "Literal" && typeof expr.value === "string") {
            checkClassString(expr.value, node);
            return;
          }

          // className={`static-part ${dynamic}`}
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              if (quasi.value.cooked) {
                // Skip partial class fragments from template interpolation
                // e.g. `archivist-${variant}-state` produces quasis ["archivist-", "-state"]
                const segment = quasi.value.cooked;
                const classes = segment.split(/\s+/).filter(Boolean);
                for (const cls of classes) {
                  // Partial fragment: starts/ends with hyphen, or is adjacent to an expression
                  if (cls.startsWith("-") || cls.endsWith("-")) continue;
                  checkClass(cls, node);
                }
              }
            }
            return;
          }

          // className={condition ? "a" : "b"} — check both string branches
          if (expr.type === "ConditionalExpression") {
            if (expr.consequent.type === "Literal" && typeof expr.consequent.value === "string") {
              checkClassString(expr.consequent.value, node);
            }
            if (expr.alternate.type === "Literal" && typeof expr.alternate.value === "string") {
              checkClassString(expr.alternate.value, node);
            }
            return;
          }
        }
      },
    };
  },
};
