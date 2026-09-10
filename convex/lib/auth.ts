import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

type Ctx = QueryCtx | MutationCtx;
export type Papel = "lideranca" | "executor";

// RNF02/RNF04: toda função protegida começa exigindo identidade.
export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Não autenticado.");
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
    throw new ConvexError("Usuário não provisionado. Faça login novamente.");
  }
  return usuario;
}

// [E4 / RF09, RF13] Acesso à demanda: liderança vê tudo; executor vê onde é
// responsável OU integra a equipe. A equipe executa junto, mas não recebe o movimento.
export function podeAcessarDemanda(
  d: Doc<"demandas">,
  usuario: Doc<"usuarios">,
): boolean {
  if (usuario.papel === "lideranca") return true;
  if (d.responsavelId === usuario._id) return true;
  return (d.equipeIds ?? []).includes(usuario._id);
}

export async function requireRole(
  ctx: Ctx,
  papeis: Papel[],
): Promise<Doc<"usuarios">> {
  const usuario = await getUsuarioAtual(ctx);
  if (!usuario.ativo) throw new ConvexError("Usuário inativo.");
  if (!papeis.includes(usuario.papel)) {
    throw new ConvexError("Sem permissão para esta ação.");
  }
  return usuario;
}
