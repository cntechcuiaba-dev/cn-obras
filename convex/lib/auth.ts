import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;
export type Papel = "lideranca" | "executor";

// RNF02/RNF04: toda função protegida começa exigindo identidade.
export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Não autenticado.");
  return identity;
}

// RNF03: o papel é SEMPRE lido da tabela usuarios, nunca de claim do token.
export async function getUsuarioAtual(ctx: Ctx): Promise<Doc<"usuarios">> {
  const identity = await requireIdentity(ctx);
  const usuario = await ctx.db
    .query("usuarios")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!usuario) {
    throw new Error("Usuário não provisionado. Faça login novamente.");
  }
  return usuario;
}

export async function requireRole(
  ctx: Ctx,
  papeis: Papel[],
): Promise<Doc<"usuarios">> {
  const usuario = await getUsuarioAtual(ctx);
  if (!usuario.ativo) throw new Error("Usuário inativo.");
  if (!papeis.includes(usuario.papel)) {
    throw new Error("Sem permissão para esta ação.");
  }
  return usuario;
}
