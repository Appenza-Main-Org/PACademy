'use strict';

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.json', './tsconfig.node.json'],
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'boundaries',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
    'boundaries/elements': [
      { type: 'shared', pattern: 'src/shared/*' },
      { type: 'features', pattern: 'src/features/*' },
      { type: 'app', pattern: 'src/app/*' },
    ],
  },
  rules: {
    // Constitution §I — no default exports.
    'import/no-default-export': 'error',

    // Constitution §I — no useEffect for data fetching.
    'no-restricted-syntax': [
      'error',
      {
        // Catches `useEffect(() => { someService... }` patterns.
        selector:
          "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression > BlockStatement > ExpressionStatement > AwaitExpression",
        message:
          'useEffect must not be used for data fetching. Use TanStack Query instead.',
      },
    ],

    // Constitution §I — no any / @ts-ignore.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // Constitution §I — clean code.
    'no-console': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],

    // Allow Promise-returning JSX event handlers (onClick={() => mut.mutate()},
    // onSubmit={handleSubmit(fn)}, etc.) — TanStack Query and react-hook-form
    // both legitimately return promises here. Non-attribute void misuse stays an error.
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],

    // React 17+ JSX transform — no need to import React.
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',

    // Constitution §III architecture — shared cannot import from features.
    'boundaries/no-unknown': 'error',
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['shared', 'features'] },
          { from: 'features', allow: ['shared'] },
          { from: 'shared', allow: [] },
        ],
      },
    ],
  },
  overrides: [
    {
      // Route / config files typically need a default export.
      files: [
        'vite.config.ts',
        'vitest.config.ts',
        'tailwind.config.ts',
        'postcss.config.js',
        '.eslintrc.cjs',
        'src/routes.tsx',
      ],
      rules: { 'import/no-default-export': 'off' },
    },
  ],
};
