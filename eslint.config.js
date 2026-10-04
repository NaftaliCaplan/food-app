// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // server/ is a separate Cloudflare Worker deployable (Worker globals,
    // not React Native) with its own lint/type setup — see server/README.md.
    ignores: ["dist/*", "server/**"],
  },
  {
    // Tests across this repo deliberately `jest.mock(...)` a module then
    // `require(...)` it to grab the mock — the established convention here
    // (see memory/ADR notes), not an oversight to flag.
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
