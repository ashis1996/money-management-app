/**
 * Repository-wide ESLint baseline.
 *
 * Scope:
 *   - Backend (NestJS): typescript-eslint recommended + prettier.
 *   - Shared: same as backend.
 *   - Mobile (React Native / Expo): same baseline + react/react-native plugins
 *     (declared in mobile/.eslintrc if/when they're added — for now this
 *     baseline is enough to catch obvious issues without flagging every
 *     RN-specific construct).
 *
 * Why this is intentionally lightweight:
 *   The codebase has accumulated stylistic drift and an aggressive
 *   "max-warnings=0" baseline would block CI on hundreds of pre-existing
 *   lint hits unrelated to any current change. The CI workflow tolerates
 *   warnings (`|| true`) until the existing files are cleaned up; once
 *   that's done, drop the tolerance and promote lint to required.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    // Warnings, not errors — see comment above on the cleanup posture.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-empty-function': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // Allow the hand-rolled Logger's console.log calls until it's
    // replaced with pino in PR B (per the roadmap).
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    'coverage-e2e/',
    '*.config.js',
    '*.config.ts',
    'mobile/.expo/',
    'mobile/android/',
    'mobile/ios/',
    'shared/dist/',
    'backend/dist/',
    // Generated Prisma client.
    'backend/node_modules/.prisma/',
  ],
  overrides: [
    {
      // E2E and unit specs assert against shapes that often need `any`
      // for partial mocks; relax there.
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'backend/test/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
};
