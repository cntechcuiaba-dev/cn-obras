import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { prioridadeDemanda } from "./schema";
import { requireRole } from "./lib/auth";
import { registrarHistorico } from "./lib/historico";

// RF05: lista as demandas "aberta" aguardando triagem.
export const listarAbertas = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    const abertas = await ctx.db
      .query("demandas")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .collect();
    // mais antigas primeiro (esperando há mais tempo)
    return abertas.sort((a, b) => a._creationTime - b._creationTime);
  },
});

// RF06/RF07: triar exige categoria, local, prioridade, prazo, executor e resultado esperado.
// prazo e executorId são obrigatórios — o próprio tipo impede "triada" sem eles.
export const triar = mutation({
  args: {
    demandaId: v.id("demandas"),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    prioridade: prioridadeDemanda,
    prazo: v.number(),
    executorId: v.id("usuarios"),
    resultadoEsperado: v.string(),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (d.status !== "aberta") {
      throw new Error("Só é possível triar uma demanda com status 'aberta'.");
    }
    const resultado = args.resultadoEsperado.trim();
    if (!resultado) {
      throw new Error("Defina o resultado esperado (o que caracteriza a demanda como resolvida).");
    }

    const executor = await ctx.db.get(args.executorId);
    if (!executor) throw new Error("Executor não encontrado.");

    await ctx.db.patch(args.demandaId, {
      status: "triada",
      categoriaId: args.categoriaId,
      localId: args.localId,
      prioridade: args.prioridade,
      prazo: args.prazo,
      executorId: args.executorId,
      resultadoEsperado: resultado,
    });

    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "triada",
      descricao: `Triada · prioridade ${args.prioridade} · atribuída a ${executor.nome}`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// RF08: reatribuir executor, alterar prazo/prioridade a qualquer momento.
export const atualizar = mutation({
  args: {
    demandaId: v.id("demandas"),
    executorId: v.optional(v.id("usuarios")),
    prazo: v.optional(v.number()),
    prioridade: v.optional(prioridadeDemanda),
    resultadoEsperado: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");

    const patch: Record<string, unknown> = {};
    const mudancas: string[] = [];
    if (args.executorId && args.executorId !== d.executorId) {
      const ex = await ctx.db.get(args.executorId);
      patch.executorId = args.executorId;
      mudancas.push(`reatribuída a ${ex?.nome ?? "?"}`);
    }
    if (args.prazo !== undefined && args.prazo !== d.prazo) {
      patch.prazo = args.prazo;
      patch.riscoSinalizadoEm = undefined; // novo prazo: reavaliar risco do zero
      mudancas.push("prazo alterado");
    }
    if (args.prioridade && args.prioridade !== d.prioridade) {
      patch.prioridade = args.prioridade;
      mudancas.push(`prioridade ${args.prioridade}`);
    }
    if (args.resultadoEsperado !== undefined) {
      patch.resultadoEsperado = args.resultadoEsperado.trim();
      mudancas.push("resultado esperado atualizado");
    }
    if (mudancas.length === 0) return;

    await ctx.db.patch(args.demandaId, patch);
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "atualizada",
      descricao: mudancas.join(" · "),
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// RF08: cancelar demanda.
export const cancelar = mutation({
  args: { demandaId: v.id("demandas"), motivo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (d.status === "concluida") throw new Error("Demanda concluída não pode ser cancelada.");

    await ctx.db.patch(args.demandaId, {
      status: "cancelada",
      riscoSinalizadoEm: undefined,
    });
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "cancelada",
      descricao: args.motivo?.trim() ? `Cancelada — ${args.motivo.trim()}` : "Cancelada",
      criadoPorClerkId: usuario.clerkId,
    });
  },
});
