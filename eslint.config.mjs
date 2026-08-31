import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**"] },
  js.configs.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  ...tseslint.configs.recommended
);
