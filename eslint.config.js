import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-web/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'cursor/**',
      // CJS consumer fixtures intentionally use require().
      'tests/fixtures/consumers/**/*.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Do not touch window at module top level; use runtime guards (step 04+).',
        },
        {
          name: 'document',
          message: 'Do not touch document at module top level; use runtime guards (step 04+).',
        },
        {
          name: 'navigator',
          message: 'Do not touch navigator at module top level; use runtime guards (step 04+).',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Playwright page.evaluate callbacks legitimately reference browser globals.
    files: ['tests/e2e/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    // Playground UI mounts after DOM ready; browser globals are intentional here.
    files: ['apps/playground/src/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  eslintConfigPrettier,
)
