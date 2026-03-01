import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactPerf from "eslint-plugin-react-perf";
import jsxA11y from "eslint-plugin-jsx-a11y";
import sonarjs from "eslint-plugin-sonarjs";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import maxJsxProps from "./eslint-rules/max-jsx-props.js";
import noInlineStyles from "./eslint-rules/no-inline-styles.js";
import noRawErrorDiv from "./eslint-rules/no-raw-error-div.js";
import noInlineIdGeneration from "./eslint-rules/no-inline-id-generation.js";
import noDuplicateComponentCss from "./eslint-rules/no-duplicate-component-css.js";
import noTabCompanionCss from "./eslint-rules/no-tab-companion-css.js";
import noCrossAppAlias from "./eslint-rules/no-cross-app-alias.js";
import noVizOverlayDrift from "./eslint-rules/no-viz-overlay-drift.js";
import noRemoteShellDrift from "./eslint-rules/no-remote-shell-drift.js";
import noBulkShellDrift from "./eslint-rules/no-bulk-shell-drift.js";
import noPanelCssDuplication from "./eslint-rules/no-panel-css-duplication.js";
import noViewerPatternDrift from "./eslint-rules/no-viewer-pattern-drift.js";
import noHintCssDuplication from "./eslint-rules/no-hint-css-duplication.js";
import noArchivistSectionDrift from "./eslint-rules/no-archivist-section-drift.js";
import noVersionToolbarDrift from "./eslint-rules/no-version-toolbar-drift.js";
import noDashboardSectionDrift from "./eslint-rules/no-dashboard-section-drift.js";
import noSchemaEditorCssDrift from "./eslint-rules/no-schema-editor-css-drift.js";
import noAppCssBaseDuplication from "./eslint-rules/no-app-css-base-duplication.js";
import noMatrixCssDuplication from "./eslint-rules/no-matrix-css-duplication.js";
import noToggleCssDrift from "./eslint-rules/no-toggle-css-drift.js";
import noVizUtilityDrift from "./eslint-rules/no-viz-utility-drift.js";
import noCosmoEditorDrift from "./eslint-rules/no-cosmo-editor-drift.js";
import noInlineKeyboardNav from "./eslint-rules/no-inline-keyboard-nav.js";
import noErrorBoundaryWithoutBase from "./eslint-rules/no-error-boundary-without-base.js";
import noNonVitestTesting from "./eslint-rules/no-non-vitest-testing.js";
import noJsFileExtension from "./eslint-rules/no-js-file-extension.js";
import noDirectFetch from "./eslint-rules/no-direct-fetch.js";
import noDirectStoreImport from "./eslint-rules/no-direct-store-import.js";
import noEscapeHatches from "./eslint-rules/no-escape-hatches.js";
import noManualAsyncState from "./eslint-rules/no-manual-async-state.js";
import noManualExpandState from "./eslint-rules/no-manual-expand-state.js";
import noManualViewHeader from "./eslint-rules/no-manual-view-header.js";

const localPlugin = {
  rules: {
    "max-jsx-props": maxJsxProps,
    "no-inline-styles": noInlineStyles,
    "no-raw-error-div": noRawErrorDiv,
    "no-inline-id-generation": noInlineIdGeneration,
    "no-duplicate-component-css": noDuplicateComponentCss,
    "no-tab-companion-css": noTabCompanionCss,
    "no-cross-app-alias": noCrossAppAlias,
    "no-viz-overlay-drift": noVizOverlayDrift,
    "no-remote-shell-drift": noRemoteShellDrift,
    "no-bulk-shell-drift": noBulkShellDrift,
    "no-panel-css-duplication": noPanelCssDuplication,
    "no-viewer-pattern-drift": noViewerPatternDrift,
    "no-hint-css-duplication": noHintCssDuplication,
    "no-archivist-section-drift": noArchivistSectionDrift,
    "no-version-toolbar-drift": noVersionToolbarDrift,
    "no-dashboard-section-drift": noDashboardSectionDrift,
    "no-schema-editor-css-drift": noSchemaEditorCssDrift,
    "no-app-css-base-duplication": noAppCssBaseDuplication,
    "no-matrix-css-duplication": noMatrixCssDuplication,
    "no-toggle-css-drift": noToggleCssDrift,
    "no-viz-utility-drift": noVizUtilityDrift,
    "no-cosmo-editor-drift": noCosmoEditorDrift,
    "no-inline-keyboard-nav": noInlineKeyboardNav,
    "no-error-boundary-without-base": noErrorBoundaryWithoutBase,
    "no-non-vitest-testing": noNonVitestTesting,
    "no-js-file-extension": noJsFileExtension,
    "no-direct-fetch": noDirectFetch,
    "no-direct-store-import": noDirectStoreImport,
    "no-escape-hatches": noEscapeHatches,
    "no-manual-async-state": noManualAsyncState,
    "no-manual-expand-state": noManualExpandState,
    "no-manual-view-header": noManualViewHeader,
  },
};

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "**/.turbo/",
      "**/coverage/",
      "infrastructure/",
      "scripts/",
      "**/scripts/",
      "**/*.min.js",
      "**/.__mf__temp/",
      "**/vitest.config.ts",
      "tools/",
    ],
  },

  // Base JS rules + complexity limits (warnings so they show in editor but don't block CI yet)
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      complexity: ["warn", 10],
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 75, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
    },
  },

  // TypeScript: recommended type-checked rules
  ...tseslint.configs.recommendedTypeChecked,

  // TypeScript parser options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Disable type-checked rules for non-TS files (config files, scripts, etc.)
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Library code: Node.js globals
  {
    files: [
      "apps/lore-weave/lib/**/*.ts",
      "apps/name-forge/lib/**/*.ts",
      "apps/cosmographer/lib/**/*.ts",
      "packages/*/src/**/*.ts",
    ],
    plugins: {
      local: localPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2025,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      "no-console": "off",
      "local/no-inline-id-generation": "warn",
      "local/no-escape-hatches": "warn",
      "local/no-direct-fetch": "warn",
      "local/no-direct-store-import": "warn",
      "local/no-manual-async-state": "warn",
      "local/no-manual-expand-state": "warn",
      "local/no-manual-view-header": "warn",
      "local/no-inline-keyboard-nav": "warn",
      "local/no-non-vitest-testing": "warn",
      "local/no-js-file-extension": "warn",
    },
  },

  // Frontend: React + Browser + Accessibility
  {
    files: [
      "apps/**/webui/src/**/*.{js,jsx,ts,tsx}",
      "packages/shared-components/src/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-perf": reactPerf,
      "jsx-a11y": jsxA11y,
      local: localPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2025,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/label-has-associated-control": ["error", {
        controlComponents: ["NumberInput", "LocalTextArea", "TagSelector", "ReferenceDropdown", "ChipSelect", "LevelSelector", "MultiSelectPills", "EnableToggle"],
        depth: 3,
      }],
      "react/react-in-jsx-scope": "warn",
      "react/prop-types": "warn",
      "react/no-unescaped-entities": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      "react-perf/jsx-no-new-object-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-new-array-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-new-function-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-jsx-as-prop": ["warn", { nativeAllowList: "all" }],
      "react/jsx-no-constructed-context-values": "warn",
      "local/max-jsx-props": ["warn", { max: 12 }],
      "local/no-inline-styles": "warn",
      "local/no-raw-error-div": "warn",
      "local/no-inline-id-generation": "warn",
      "local/no-duplicate-component-css": "warn",
      "local/no-tab-companion-css": "warn",
      "local/no-viz-overlay-drift": "warn",
      "local/no-remote-shell-drift": "warn",
      "local/no-bulk-shell-drift": "warn",
      "local/no-panel-css-duplication": "warn",
      "local/no-viewer-pattern-drift": "warn",
      "local/no-hint-css-duplication": "warn",
      "local/no-archivist-section-drift": "warn",
      "local/no-version-toolbar-drift": "warn",
      "local/no-dashboard-section-drift": "warn",
      "local/no-schema-editor-css-drift": "warn",
      "local/no-app-css-base-duplication": "warn",
      "local/no-matrix-css-duplication": "warn",
      "local/no-toggle-css-drift": "warn",
      "local/no-viz-utility-drift": "warn",
      "local/no-cosmo-editor-drift": "warn",
      "local/no-inline-keyboard-nav": "warn",
      "local/no-error-boundary-without-base": "warn",
      "local/no-non-vitest-testing": "warn",
      "local/no-js-file-extension": "warn",
      "local/no-direct-fetch": "warn",
      "local/no-direct-store-import": "warn",
      "local/no-escape-hatches": "warn",
      "local/no-manual-async-state": "warn",
      "local/no-manual-expand-state": "warn",
      "local/no-manual-view-header": "warn",
      "no-restricted-imports": ["warn", {
        paths: [{
          name: "prop-types",
          message: "Use TypeScript interfaces instead of PropTypes. See docs/patterns/typescript-migration.md",
        }],
      }],
    },
  },

  // Vite config files: guard against non-standard alias patterns
  {
    files: ["apps/**/webui/vite.config.{js,ts}"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/no-cross-app-alias": "warn",
    },
  },

  // Test files: exempt from complexity/size limits
  {
    files: ["**/*.test.{ts,tsx,js,jsx}"],
    rules: {
      "max-lines-per-function": "off",
      "max-lines": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },

  // SonarJS: full recommended config
  sonarjs.configs.recommended,

  // TypeScript-specific rule overrides
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "sonarjs/deprecation": "warn",
      "sonarjs/prefer-regexp-exec": "off",
    },
  },

  // Prettier: must be last
  prettier
);
