// drift-generated
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow inline keyboard navigation switch blocks that duplicate useKeyboardNavigation",
    },
    messages: {
      inlineKeyboardNav:
        "Inline keyboard navigation switch block detected (handles ArrowDown/ArrowUp/Enter/Escape). " +
        "Use the shared useKeyboardNavigation hook from @the-canonry/shared-components instead. " +
        "See docs/patterns/keyboard-navigation.md",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    // Allow the hook implementation itself
    if (/shared-components/.test(filename)) return {};

    const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"]);
    const THRESHOLD = 3; // at least 3 of the 4 keys → almost certainly navigation

    return {
      SwitchStatement(node) {
        const caseKeys = new Set();
        for (const c of node.cases) {
          if (
            c.test &&
            c.test.type === "Literal" &&
            typeof c.test.value === "string" &&
            NAV_KEYS.has(c.test.value)
          ) {
            caseKeys.add(c.test.value);
          }
        }
        if (caseKeys.size >= THRESHOLD) {
          context.report({ node, messageId: "inlineKeyboardNav" });
        }
      },
    };
  },
};
