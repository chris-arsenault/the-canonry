// drift-generated
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Bans per-component CSS imports from coherence-engine tab components. " +
        "Tab form styles (required-badge, checkbox-label, required-hint) belong in " +
        "styles/components/tab-form.css, not in per-component companion CSS files.",
    },
    messages: {
      noTabCss:
        "Tab component imports a local CSS file '{{source}}'. " +
        "Tab form styles should live in styles/components/tab-form.css (imported via styles/index.css). " +
        "See docs/adr/024-tab-form-css-consolidation.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only enforce in coherence-engine tab directories
    if (!/coherence-engine.*\/tabs\//.test(filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        // Flag local CSS imports (e.g., "./VariablesTab.css", "./ThresholdTriggerTab.css")
        if (source.startsWith(".") && source.endsWith(".css")) {
          context.report({
            node,
            messageId: "noTabCss",
            data: { source },
          });
        }
      },
    };
  },
};
