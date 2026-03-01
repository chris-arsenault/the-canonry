// drift-generated
/**
 * ESLint rule: no-archivist-section-drift
 *
 * Detects archivist component TSX files that import a component CSS file
 * but do NOT import archivist-section.css. This prevents new archivist
 * content-section components from re-declaring structural properties
 * that should come from the shared base.
 *
 * Also warns if archivist section components don't use the shared class names.
 *
 * See docs/adr/032-archivist-section-css-consolidation.md
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Archivist content-section components must import archivist-section.css " +
        "and use shared structural classes instead of re-declaring header/icon/title/narrative styles.",
    },
    messages: {
      missingBaseImport:
        "This archivist component imports a component CSS file but not archivist-section.css. " +
        "Content-section components should import './archivist-section.css' and use shared " +
        "structural classes (.archivist-section, .archivist-section-hdr, .archivist-section-icon, " +
        ".archivist-section-title, .archivist-narrative). " +
        "See docs/patterns/archivist-section.md",
      missingSharedClass:
        "This archivist component uses a component-specific class '{{className}}' that duplicates " +
        "a shared structural class. Use '{{sharedClass}}' instead (alongside any component-specific class). " +
        "See docs/patterns/archivist-section.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only applies to archivist component files
    if (!filename.includes("archivist") || !filename.includes("/components/")) return {};
    // Skip the shared base file itself
    if (filename.endsWith("archivist-section.css") || filename.endsWith("archivist-section.tsx")) {
      return {};
    }
    // Only check TSX/JSX files
    if (!filename.endsWith(".tsx") && !filename.endsWith(".jsx")) return {};

    let componentCssImportNode = null;
    let hasBaseImport = false;

    // Only flag components whose CSS filename suggests a content section, story,
    // narrative, or modal — not generic panels, views, filters, etc.
    const sectionLikePattern = /\/(.*(?:Section|Story|Narrative|Lore|Modal).*\.css)$/i;

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source === "./archivist-section.css") {
          hasBaseImport = true;
        }
        if (source.startsWith("./") && sectionLikePattern.test(source) && source !== "./archivist-section.css") {
          componentCssImportNode = node;
        }
      },

      "Program:exit"() {
        // If the file imports a section-like CSS but not the shared base, warn
        if (componentCssImportNode && !hasBaseImport) {
          context.report({
            node: componentCssImportNode,
            messageId: "missingBaseImport",
          });
        }
      },
    };
  },
};
