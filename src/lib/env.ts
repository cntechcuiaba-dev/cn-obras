// Modo demo: ligado automaticamente quando não há backend Convex configurado.
// Assim `npm run dev` mostra a UI com dados fake; ao definir VITE_CONVEX_URL
// (via `npx convex dev`), o mesmo front passa a usar o backend real.
export const DEMO = !import.meta.env.VITE_CONVEX_URL;
