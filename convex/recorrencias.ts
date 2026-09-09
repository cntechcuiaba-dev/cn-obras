import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { periodicidade } from "./schema";
import { requireRole } from "./lib/auth";
import { registrarHistorico } from "./lib/historico";
import { DIA_MS } from "./lib/risco";

const INTERVALO_DIAS: Record<string, number> = {
  mensal: 30,
  bimestral: 60,
  trimestral: 90,
  semestral: 182,
  anual: 365,
};

// RF17: cadastrar manutenção recorrente.
export const criar = mutation({
  args: {
    titulo: v.string(),
    descricao: v.string(),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    executorPadraoId: v.id("usuarios"),
    periodicidade,
    prazoDias: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    if (!args.titulo.trim()) throw new Error("Título é obrigatório.");
    if (args.prazoDias <= 0) throw new Error("Prazo em dias deve ser positivo.");
    return await ctx.db.insert("manutencoesRecorrentes", {
      ...args,
      titulo: args.titulo.trim(),
      descricao: args.descricao.trim(),
      ativa: true,
    });
  },
});

// RF20: editar/desativar sem afetar demandas já geradas.
export const editar = mutation({
  args: {
    id: v.id("manutencoesRecorrentes"),
    titulo: v.optional(v.string()),
    descricao: v.optional(v.string()),
    categoriaId: v.optional(v.id("categorias")),
    localId: v.optional(v.id("locais")),
    executorPadraoId: v.optional(v.id("usuarios")),
    periodicidade: v.optional(periodicidade),
    prazoDias: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const { id, ...resto } = args;
    const patch = Object.fromEntries(
      Object.entries(resto).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, patch);
  },
});

export const alternarAtiva = mutation({
  args: { id: v.id("manutencoesRecorrentes"), ativa: v.boolean() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    await ctx.db.patch(args.id, { ativa: args.ativa });
  },
});

export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    const recs = await ctx.db.query("manutencoesRecorrentes").collect();
    return await Promise.all(
      recs.map(async (r) => {
        const [categoria, local, executor] = await Promise.all([
          ctx.db.get(r.categoriaId),
          ctx.db.get(r.localId),
          ctx.db.get(r.executorPadraoId),
        ]);
        const intervalo = INTERVALO_DIAS[r.periodicidade] * DIA_MS;
        const proximaGeracao = r.ultimaGeracaoEm
          ? r.ultimaGeracaoEm + intervalo
          : Date.now();
        return {
          ...r,
          categoriaNome: categoria?.nome ?? null,
          localNome: local?.nome ?? null,
          executorNome: executor?.nome ?? null,
          proximaGeracao: r.ativa ? proximaGeracao : null,
        };
      }),
    );
  },
});

// RF18/RF19: cron diário idempotente — gera uma demanda "triada" por recorrência ativa
// cujo intervalo tenha vencido. ultimaGeracaoEm impede gerar duas vezes no mesmo período.
export const gerarRecorrenciasDoDia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agora = Date.now();
    const ativas = await ctx.db
      .query("manutencoesRecorrentes")
      .withIndex("by_ativa", (q) => q.eq("ativa", true))
      .collect();

    let geradas = 0;
    for (const r of ativas) {
      const intervalo = INTERVALO_DIAS[r.periodicidade] * DIA_MS;
      const venceu =
        r.ultimaGeracaoEm === undefined || agora - r.ultimaGeracaoEm >= intervalo;
      if (!venceu) continue;

      const demandaId = await ctx.db.insert("demandas", {
        titulo: r.titulo,
        descricao: r.descricao,
        solicitanteNome: "Sistema (recorrência)",
        solicitanteWhatsapp: "",
        localTextoOriginal: "",
        status: "triada",
        categoriaId: r.categoriaId,
        localId: r.localId,
        prioridade: "media",
        prazo: agora + r.prazoDias * DIA_MS,
        executorId: r.executorPadraoId,
        resultadoEsperado: `Manutenção recorrente "${r.titulo}" realizada conforme rotina.`,
        origemRecorrenciaId: r._id,
      });

      await ctx.db.patch(r._id, { ultimaGeracaoEm: agora });

      // RF31: evento visível (não silencioso) para o executor responsável.
      await registrarHistorico(ctx, {
        demandaId,
        tipo: "criada",
        descricao: `Gerada automaticamente pela recorrência "${r.titulo}"`,
      });
      geradas++;
    }
    return { geradas };
  },
});
