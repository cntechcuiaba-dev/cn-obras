import { internalMutation } from "./_generated/server";

// A janela de contagem (ver lib/limite.ts) é de minutos; sem limpeza a tabela
// só cresceria — 1 dia de folga sobra pra qualquer janela usada hoje.
export const limparEventosAntigos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const corte = Date.now() - 24 * 60 * 60 * 1000;
    const antigos = await ctx.db
      .query("limitePublico")
      .filter((q) => q.lt(q.field("_creationTime"), corte))
      .collect();
    for (const e of antigos) await ctx.db.delete(e._id);
    return { removidos: antigos.length };
  },
});
