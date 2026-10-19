import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The repo root doubles as the GitHub Pages site: CI copies dist/ over it, so the
// root index.html is a build artifact. The real source template is app.html; this
// plugin serves it at "/" in dev and emits it as dist/index.html.
const appEntry = {
  name: "app-html-entry",
  enforce: "post",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/" || req.url === "/index.html") req.url = "/app.html";
      next();
    });
  },
  generateBundle(_, bundle) {
    const html = bundle["app.html"];
    if (!html) return;
    delete bundle["app.html"];
    this.emitFile({ type: "asset", fileName: "index.html", source: html.source });
  },
};

// Dev/preview port is registered in ~/Projects/PORTS.md (elektrolang-vite). Don't use Vite's 5173 default.
export default defineConfig({
  server: { host: "127.0.0.1", port: 3944, strictPort: true },
  preview: { host: "127.0.0.1", port: 3944, strictPort: true },
  build: { rollupOptions: { input: "app.html" } },
  plugins: [
    react(),
    appEntry,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "EKG Reader",
        short_name: "EKG Reader",
        description:
          "A systematic, step-by-step 12-lead ECG interpretation trainer.",
        theme_color: "#060d14",
        background_color: "#060d14",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
});
