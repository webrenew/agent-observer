import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const tsFiles = ["src/**/*.{ts,tsx}"];
const rendererFiles = ["src/renderer/**/*.{ts,tsx}"];
const nodeFiles = [
  "src/main/**/*.{ts,tsx}",
  "src/preload/**/*.{ts,tsx}",
  "src/shared/**/*.{ts,tsx}",
  "electron.vite.config.ts",
];

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    ignores: [
      "out/**",
      "release/**",
      "node_modules/**",
      "web/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  js.configs.recommended,
  {
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "off",
      "no-inner-declarations": "off",
      "no-constant-condition": "off",
      "no-useless-escape": "off",
      "no-unsafe-finally": "off",
      "no-control-regex": "off",
    },
  },
  {
    files: rendererFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
];
