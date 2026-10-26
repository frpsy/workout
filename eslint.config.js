import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '_site/', 'node_modules/'] },
  js.configs.recommended,
  { files: ['js/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'], languageOptions: { globals: globals.node } },
  { files: ['tests/ui.test.mjs'], languageOptions: { globals: globals.browser } },
];
