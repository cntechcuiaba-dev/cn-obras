import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

// Equipamento que pode ter manutenção periódica (ar-condicionado, bebedouro,
// portão eletrônico...). Leitura por liderança e executor; escrita só liderança
// — mesmo padrão de categorias/locais/modelos.

export const listar = query({
  args: { incluirInativos: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca", "executor"]);
    const todos = await ctx.db.query("equipamentos").collect();
    const filtrados = args.incluirInativos ? todos : todos.filter((e) => e.ativo);

    return await Promise.all(
      filtrados.map(async (e) => {
        const local = await ctx.db.get(e.localId);
        return { ...e, localNome: local?.nome ?? null };
      }),
    );
  },
});

export const criar = mutation({
  args: {
    nome: v.string(),
    tipo: v.string(),
    localId: v.id("locais"),
    patrimonio: v.optional(v.string()),
    instaladoEm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const nome = args.nome.trim();
    const tipo = args.tipo.trim();
    if (!nome) throw new Error("Nome do equipamento é obrigatório.");
    if (!tipo) throw new Error("Tipo do equipamento é obrigatório.");

    return await ctx.db.insert("equipamentos", {
      nome,
      tipo,
      localId: args.localId,
      patrimonio: args.patrimonio?.trim() || undefined,
      instaladoEm: args.instaladoEm,
      ativo: true,
    });
  },
});

export const atualizar = mutation({
  args: {
    equipamentoId: v.id("equipamentos"),
    nome: v.optional(v.string()),
    tipo: v.optional(v.string()),
    localId: v.optional(v.id("locais")),
    patrimonio: v.optional(v.string()),
    instaladoEm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const { equipamentoId, ...resto } = args;
    const patch: Record<string, unknown> = {};

    if (resto.nome !== undefined) {
      const nome = resto.nome.trim();
      if (!nome) throw new Error("Nome do equipamento é obrigatório.");
      patch.nome = nome;
    }
    if (resto.tipo !== undefined) {
      const tipo = resto.tipo.trim();
      if (!tipo) throw new Error("Tipo do equipamento é obrigatório.");
      patch.tipo = tipo;
    }
    if (resto.localId !== undefined) patch.localId = resto.localId;
    if (resto.patrimonio !== undefined) patch.patrimonio = resto.patrimonio.trim() || undefined;
    if (resto.instaladoEm !== undefined) patch.instaladoEm = resto.instaladoEm;

    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(equipamentoId, patch);
  },
});

export const alternarAtivo = mutation({
  args: { equipamentoId: v.id("equipamentos"), ativo: v.boolean() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    await ctx.db.patch(args.equipamentoId, { ativo: args.ativo });
  },
});
