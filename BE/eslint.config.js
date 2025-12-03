import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import globals from 'globals'

export default [
  {
    ignores: [ 'node_modules/**', 'dist/**' ]
  },
  {
    files: [ '**/*.js' ],
    ...js.configs.recommended,
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'commonjs',
      },
    },
    rules: {
      'no-unused-vars': [ 'warn', { varsIgnorePattern: '^[A-Z_]' } ],
      'import/no-unresolved': [ 'error', { commonjs: true, caseSensitive: true } ],
      // 'prefer-const': 'warn',
      'no-var': 'warn',
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: [ '.js', '.json' ],
          moduleDirectory: [ 'node_modules', '.' ],
        },
      },
    },
  },
];
