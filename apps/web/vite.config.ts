import type { ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Engine bundles (`*.data.gz`) are gzip files that the engine decompresses itself. Static servers
 * often label `.gz` with `Content-Encoding: gzip`, which makes the browser decompress them first
 * and corrupts the data. Production hosts need the same rule (see docs/architecture/client-side-architecture.md).
 */
function rawEngineAssets(): Plugin {
  let prefix = "/engines/";
  const strip = (url: string | undefined, res: ServerResponse) => {
    if (url === undefined || !url.startsWith(prefix) || !url.split("?")[0]?.endsWith(".gz")) {
      return;
    }
    const setHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) =>
      name.toLowerCase() === "content-encoding" ? res : setHeader(name, value);
    setHeader("Content-Type", "application/octet-stream");
  };
  return {
    name: "quartz-raw-engine-assets",
    configResolved(config) {
      prefix = `${config.base}engines/`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        strip(req.url, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        strip(req.url, res);
        next();
      });
    },
  };
}

/** Public base path, e.g. "/quartz/" for a GitHub Pages project site. Defaults to the domain root. */
const rawBase = process.env.QUARTZ_BASE ?? "/";
const base = `/${rawBase.replace(/^\/+|\/+$/g, "")}/`.replace(/\/+/g, "/");

export default defineConfig({
  base,
  plugins: [rawEngineAssets(), react(), tailwindcss()],
  resolve: {
    alias: {
      "blake3-wasm/browser.js": fileURLToPath(
        new URL("./src/vendor/blake3-unavailable.ts", import.meta.url),
      ),
    },
  },
  worker: { format: "es" },
  optimizeDeps: {
    // Engines resolve WASM and worker files by URL; pre-bundling would break those paths.
    exclude: ["@myriaddreamin/typst.ts", "@myriaddreamin/typst-ts-web-compiler", "@siglum/engine"],
  },
  server: { port: 5173, strictPort: true },
});
