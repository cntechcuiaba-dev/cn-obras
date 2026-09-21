import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import marca from "./marca.config.js";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // O título da aba e o theme-color vivem no HTML, fora do alcance do React —
    // sem isto a marca do cliente ficaria certa nas telas e errada na aba.
    {
      name: "marca-no-html",
      transformIndexHtml(html: string) {
        return html
          .replace(/%MARCA_NOME%/g, marca.nome)
          .replace(/%MARCA_ACCENT%/g, marca.accent.DEFAULT);
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png"],
      workbox: {
        // O service worker intercepta QUALQUER navegação e devolve o index.html
        // do cache; o que for função de servidor precisa seguir pra rede.
        // (O Clerk saiu daqui: com domínio próprio, o callback do OAuth vai
        // para clerk.<dominio>, outra origem, fora do alcance deste worker.)
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: marca.nome,
        short_name: marca.nomeCurto,
        description: "Gestão de demandas de manutenção predial",
        theme_color: marca.accent.DEFAULT,
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
