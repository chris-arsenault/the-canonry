// drift-generated
import { readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects app-local CSS component files that duplicate shared-components CSS files. " +
        "Apps should use the shared-components version and add overrides to compact-overrides.css.",
    },
    messages: {
      duplicateCss:
        "App has CSS file '{{file}}' in styles/components/ that duplicates a shared-components file. " +
        "Remove it and use compact-overrides.css for app-specific spacing differences. " +
        "See docs/adr/023-css-component-deduplication.md",
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Only check relative imports of the app's CSS index entry point
        if (!source.startsWith(".") || !source.includes("styles/index")) return;

        const filename = context.filename || context.getFilename();
        const fileDir = dirname(filename);

        // Resolve the styles/components/ dir relative to the imported CSS index
        const stylesComponentsDir = resolve(fileDir, source, "..", "components");

        // Find project root from the file path
        const projectRootMatch = filename.match(/^(.+?)\/apps\//);
        if (!projectRootMatch) return;
        const projectRoot = projectRootMatch[1];

        const sharedDir = resolve(
          projectRoot,
          "packages/shared-components/src/styles/components",
        );

        if (!existsSync(sharedDir) || !existsSync(stylesComponentsDir)) return;

        const sharedFiles = new Set(
          readdirSync(sharedDir).filter((f) => f.endsWith(".css")),
        );
        const appFiles = readdirSync(stylesComponentsDir).filter((f) =>
          f.endsWith(".css"),
        );

        for (const file of appFiles) {
          // compact-overrides.css is the correct override mechanism
          if (file === "compact-overrides.css") continue;
          if (sharedFiles.has(file)) {
            context.report({
              node,
              messageId: "duplicateCss",
              data: { file },
            });
          }
        }
      },
    };
  },
};
