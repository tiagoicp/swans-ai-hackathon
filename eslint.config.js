import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Generated / build artifacts — never lint these.
    ignores: ["dist/", "node_modules/", ".wrangler/", "env.d.ts"]
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    // React-specific passes for the client-side app.
    extends: [
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.recommended
    ],
    files: ["src/**/*.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    // Type-aware pass — enables @deprecated detection without switching the
    // whole config to recommendedTypeChecked and its stricter rule set.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error"
    }
  }
);
