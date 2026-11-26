import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  optimizeDeps: {
    // typst.ts resolves its WASM through `?url`; pre-bundling would break the asset path.
    exclude: ["@myriaddreamin/typst.ts", "@myriaddreamin/typst-ts-web-compiler"],
  },
  server: { port: 5173, strictPort: true },
});
