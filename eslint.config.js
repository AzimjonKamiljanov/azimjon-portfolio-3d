import js from "@eslint/js";
import globals from "globals";

/**
 * Flat config, split by runtime so each file only sees the globals it can
 * actually use. `no-undef` then does real work instead of being satisfied by
 * a hand-maintained allowlist.
 */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      ".wrangler/**",
      "assets/**",
      "docs/**",
      "worker-configuration.d.ts",
    ],
  },

  js.configs.recommended,

  // Shared rules for every linted file.
  {
    rules: {
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-implicit-coercion": ["error", { boolean: false }],
      "no-throw-literal": "error",
      "no-return-await": "error",
      "no-else-return": ["error", { allowElseIf: true }],
      "no-lonely-if": "error",
      "object-shorthand": ["error", "properties"],
      "prefer-template": "error",
      "no-nested-ternary": "error",
      "no-param-reassign": ["error", { props: false }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "require-atomic-updates": "off",
    },
  },

  // Browser application code.
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly",
      },
    },
  },

  // Cloudflare Worker: service-worker-ish globals, no DOM.
  {
    files: ["worker.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.worker,
        ...globals.serviceworker,
        console: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
    rules: {
      // Worker logs are the only observability channel for the contact
      // endpoint; they are deliberate, not leftover debugging.
      "no-console": "off",
    },
  },

  // Vitest unit tests and Playwright specs.
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  // Offline build utilities: Node, CLI output expected.
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
  },

  // Tooling configs at the repo root.
  {
    files: ["*.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },

  // React snippet components are reference material, not part of the bundle.
  {
    files: ["components/**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },
];
