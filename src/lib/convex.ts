import { ConvexReactClient } from "convex/react";

// No modo demo (sem VITE_CONVEX_URL) o cliente fica nulo e não é montado — o app
// roda com dados fake. Em produção a URL vem do `npx convex dev`.
const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const convex = url ? new ConvexReactClient(url) : null;
