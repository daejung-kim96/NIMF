import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([ 'dist' ]),
  {
    files: [ '**/*.{js,jsx}' ],
    extends: [
      js.configs.recommended,
      reactHooks.configs[ 'recommended-latest' ],
      reactRefresh.configs.vite,
    ],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [ 'warn', { varsIgnorePattern: '^[A-Z_]' } ],
      'import/no-unresolved': [
        'error', 
        {
          ignore: ['\\.svg\\?react$'], // ✅ svg?react 무시
        }
      ],
      "react-refresh/only-export-components": "off",
      "react-hooks/exhaustive-deps": "off"
    },
    settings: {
      'import/resolver': {
        alias: {
          map: [
            [ '@', './src' ],
          ],
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.svg'],
        },
      },
    },
  },
  {
    files: [ 'tailwind.config.js', 'postcss.config.js', 'vite.config.js' ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node, // Node 환경 전역변수 인식
      parserOptions: {
        sourceType: 'module',
      },
    },
  },
])