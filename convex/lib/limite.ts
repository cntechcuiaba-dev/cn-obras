import { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

// Rate-limit simples para endpoints públicos (sem sessão — não há usuário nem
// IP disponível dentro de uma mutation do Convex para limitar por chamador).
// Janela fixa contada globalmente por tipo de evento: era a lacuna real do
// formulário público e do upload público, que não tinham nenhum limite.
export async function aplicarLimite(
  ctx: MutationCtx,
  tipo: string,
  limite: number,
  janelaMs: number,
): Promise<void> {
  const corte = Date.now() - janelaMs;
  const recentes = await ctx.db
    .query("limitePublico")
    .withIndex("by_tipo", (q) => q.eq("tipo", tipo).gt("_creationTime", corte))
    .collect();
  if (recentes.length >= limite) {
    throw new ConvexError(
      "Muitas solicitações em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
  }
  await ctx.db.insert("limitePublico", { tipo });
}
