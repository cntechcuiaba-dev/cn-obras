import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireIdentity, requireRole, getUsuarioAtual } from "./lib/auth";

// Chamada no primeiro login. SEMPRE cria como "executor"; promoção é manual (RF28).
export const garantirUsuario = mutation({
  args: { nome: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existente) return existente._id;

    return await ctx.db.insert("usuarios", {
      clerkId: identity.subject,
      nome: args.nome || identity.name || "Sem nome",
      email: args.email || identity.email || "",
      papel: "executor",
      ativo: true,
    });
  },
});

// Usado pelo app para saber quem é / rotear por papel.
export const eu = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!usuario) return null;
    return {
      _id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
    };
  },
});

export const listarExecutores = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    const todos = await ctx.db.query("usuarios").collect();
    return todos
      .filter((u) => u.ativo)
      .map((u) => ({ _id: u._id, nome: u.nome, papel: u.papel }));
  },
});

// RF27: liderança promove um executor para liderança.
export const promover = mutation({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const alvo = await ctx.db.get(args.usuarioId);
    if (!alvo) throw new ConvexError("Usuário não encontrado.");
    await ctx.db.patch(args.usuarioId, { papel: "lideranca" });
  },
});

// O campo `ativo` existia no schema desde o início, mas nada o escrevia — usuário
// que sai do ministério não tinha como ser desligado do sistema.
export const alternarAtivo = mutation({
  args: { usuarioId: v.id("usuarios"), ativo: v.boolean() },
  handler: async (ctx, args) => {
    const eu = await requireRole(ctx, ["lideranca"]);
    if (args.usuarioId === eu._id && !args.ativo) {
      throw new ConvexError("Você não pode desativar a própria conta.");
    }
    const alvo = await ctx.db.get(args.usuarioId);
    if (!alvo) throw new ConvexError("Usuário não encontrado.");
    await ctx.db.patch(args.usuarioId, { ativo: args.ativo });
  },
});

export const listarUsuarios = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    return await ctx.db.query("usuarios").collect();
  },
});

async function jaHaLideranca(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const todos = await ctx.db.query("usuarios").collect();
  return todos.some((u) => u.papel === "lideranca");
}

// A tela do painel só oferece "assumir liderança" (bootstrap) quando isso é
// genuinamente o primeiro acesso do sistema. Sem essa checagem, o botão
// aparecia pra qualquer executor com o painel vazio — clicar não fazia nada
// (a mutation já recusa se já existe liderança), mas oferecer a opção pra
// quem foi convidado como executor é confuso: só o admin promove alguém,
// via Administração > Usuários.
export const existeLideranca = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await jaHaLideranca(ctx);
  },
});

// Atalho de bootstrap: o primeiro usuário do sistema vira liderança automaticamente,
// senão ninguém consegue promover ninguém. Idempotente.
export const promoverPrimeiroComoLideranca = mutation({
  args: {},
  handler: async (ctx) => {
    const usuario = await getUsuarioAtual(ctx);
    if (!(await jaHaLideranca(ctx))) {
      await ctx.db.patch(usuario._id, { papel: "lideranca" });
      return "promovido";
    }
    return "ja_existe_lideranca";
  },
});
