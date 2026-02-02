module.exports = {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/dist/**',
    '**/build/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/node_modules/**',
  ],
  overrides: [
    {
      files: ['apps/name-forge/webui/src/App.css'],
      rules: {
        'no-descending-specificity': null,
        'no-duplicate-selectors': null,
      },
    },
  ],
};
