import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png"],
      workbox: {
        // Sem isso, o service worker intercepta QUALQUER navegação (inclusive o
        // callback do OAuth do Clerk em /__clerk/...) e devolve o index.html do
        // cache em vez de deixar a requisição seguir pra rede — o login com
        // Google nunca completava porque a troca de código nunca saía do navegador.
        navigateFallbackDenylist: [/^\/__clerk\//, /^\/api\//],
      },
      manifest: {
        name: "Central CN Obras",
        short_name: "CN Obras",
        description: "Gestão de demandas de manutenção predial",
        theme_color: "#3D7A8C",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
