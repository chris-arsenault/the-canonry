import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPerf from 'eslint-plugin-react-perf';
import tseslint from 'typescript-eslint';

export default [
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    ignores: ['**/dist/**', '**/build/**', '**/.turbo/**', '**/coverage/**'],
  },
  {
    files: [
      'apps/**/webui/src/**/*.{js,jsx,ts,tsx}',
      'packages/shared-components/src/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-perf': reactPerf },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-perf/jsx-no-new-object-as-prop': ['warn', { nativeAllowList: 'all' }],
      'react-perf/jsx-no-new-array-as-prop': 'off',
      'react-perf/jsx-no-new-function-as-prop': 'off',
      'react-perf/jsx-no-jsx-as-prop': ['warn', { nativeAllowList: 'all' }],
      'react/jsx-no-constructed-context-values': 'warn',
    },
  },
];
