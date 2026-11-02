
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  manifest: {
    name: "Lexicon",
    description: "Your personal AI vocabulary library",

    permissions: [
      "storage",
      "contextMenus"
    ],

    host_permissions: [
      "http://127.0.0.1:8787/*"
    ]
  }
});
