// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "android/*", "ios/*"],
  },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-router",
              importNames: ["router"],
              message:
                "Use useRouter(). The global router stops working after Android recreates the activity (a font size change): the old tree's unmount resets it after the new tree has bound it.",
            },
          ],
        },
      ],
    },
  },
]);
