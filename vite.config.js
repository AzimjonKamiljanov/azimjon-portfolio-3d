import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// `__dirname` is not defined in an ES module. It happened to work before
// because Vite transpiles its own config, but that is an implementation
// detail, not a guarantee.
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 600,
    // "hidden" emits the maps but writes no sourceMappingURL comment, so the
    // browser never fetches them and the site does not hand every visitor a
    // 479 KB map plus the unminified source. They stay in dist/ for anyone
    // debugging a stack trace from errors.js locally.
    sourcemap: "hidden",
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
      },
      output: {
        manualChunks: {
          three: ["three"],
          gsap: ["gsap"],
          // The trilingual dictionary is 115 KB of string data that changes
          // far less often than the application code around it. As part of
          // the main chunk, every copy edit anywhere in src/ invalidated it
          // for returning visitors; as its own chunk it stays cached across
          // deploys and is parsed off the main bundle's critical path.
          i18n: ["./src/i18n/translations.js"],
        },
      },
    },
  },
  server: {
    port: 8080,
    host: "127.0.0.1",
  },
});
