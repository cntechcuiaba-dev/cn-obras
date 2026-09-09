import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

// categorias / locais / modelosMensagem: leitura por liderança e executor; escrita só liderança.

export const listarCategorias = query({
  args: { incluirInativas: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca", "executor"]);
    const todas = await ctx.db.query("categorias").collect();
    return args.incluirInativas ? todas : todas.filter((c) => c.ativa);
  },
});

export const listarLocais = query({
  args: { incluirInativos: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca", "executor"]);
    const todos = await ctx.db.query("locais").collect();
    return args.incluirInativos ? todos : todos.filter((l) => l.ativo);
  },
});

export const listarModelos = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca", "executor"]);
    return await ctx.db.query("modelosMensagem").collect();
  },
});

export const criarCategoria = mutation({
  args: { nome: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const nome = args.nome.trim();
    if (!nome) throw new Error("Nome da categoria é obrigatório.");
    return await ctx.db.insert("categorias", { nome, ativa: true });
  },
});

export const alternarCategoria = mutation({
  args: { categoriaId: v.id("categorias"), ativa: v.boolean() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    await ctx.db.patch(args.categoriaId, { ativa: args.ativa });
  },
});

export const criarLocal = mutation({
  args: { nome: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const nome = args.nome.trim();
    if (!nome) throw new Error("Nome do local é obrigatório.");
    return await ctx.db.insert("locais", { nome, ativo: true });
  },
});

export const alternarLocal = mutation({
  args: { localId: v.id("locais"), ativo: v.boolean() },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    await ctx.db.patch(args.localId, { ativo: args.ativo });
  },
});

// Seed inicial (kickoff passo 3): categorias, locais e um modelo por tipo. Idempotente.
// Bootstrap: se o banco já tem dados, exige liderança; se está vazio (primeira carga via
// `npx convex run cadastros:seed`), permite sem login.
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const bancoVazio = (await ctx.db.query("categorias").take(1)).length === 0;
    if (!bancoVazio) await requireRole(ctx, ["lideranca"]);

    const jaTemCategorias = (await ctx.db.query("categorias").take(1)).length > 0;
    if (!jaTemCategorias) {
      for (const nome of ["Elétrica", "Hidráulica", "Estrutura"]) {
        await ctx.db.insert("categorias", { nome, ativa: true });
      }
    }

    const jaTemLocais = (await ctx.db.query("locais").take(1)).length > 0;
    if (!jaTemLocais) {
      for (const nome of ["Templo", "Salas de aula", "Estacionamento"]) {
        await ctx.db.insert("locais", { nome, ativo: true });
      }
    }

    const jaTemModelos = (await ctx.db.query("modelosMensagem").take(1)).length > 0;
    if (!jaTemModelos) {
      await ctx.db.insert("modelosMensagem", {
        nome: "Em execução",
        tipo: "em_execucao",
        texto:
          "Olá {{solicitante}}! Sua solicitação \"{{demanda}}\" ({{local}}) já está em execução. Prazo: {{prazo}}.",
      });
      await ctx.db.insert("modelosMensagem", {
        nome: "Aguardando",
        tipo: "aguardando",
        texto:
          "Olá {{solicitante}}! Sua solicitação \"{{demanda}}\" está aguardando para prosseguir. Assim que possível retomamos.",
      });
      await ctx.db.insert("modelosMensagem", {
        nome: "Concluída",
        tipo: "concluida",
        texto:
          "Olá {{solicitante}}! Sua solicitação \"{{demanda}}\" ({{local}}) foi concluída. Obrigado!",
      });
    }

    return "ok";
  },
});
