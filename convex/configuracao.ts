import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";

// Identidade visual do cliente (white-label). A logo é lida pelo login e pelo
// formulário público, que são telas SEM autenticação — por isso `obter` é
// pública. Escrita continua restrita à liderança.

const TAMANHO_MAX = 2 * 1024 * 1024; // 2 MB
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function linhaConfig(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("configuracao").first();
}

export const obter = query({
  args: {},
  handler: async (ctx) => {
    const config = await linhaConfig(ctx);
    if (!config?.logoStorageId) return { logoUrl: null };
    return { logoUrl: await ctx.storage.getUrl(config.logoStorageId) };
  },
});

export const gerarUrlUploadLogo = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const definirLogo = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; erro: string }> => {
    await requireRole(ctx, ["lideranca"]);

    // Validação onde o dado grava: o upload vai direto pro storage, então o
    // arquivo só é conferido de verdade aqui.
    //
    // Recusa devolve resultado em vez de lançar: mutation que lança faz
    // rollback da transação inteira — o storage.delete junto —, e o arquivo
    // recusado ficaria órfão. Retornando, a limpeza persiste.
    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) return { ok: false, erro: "Arquivo não encontrado." };
    if (meta.size > TAMANHO_MAX) {
      await ctx.storage.delete(args.storageId);
      return { ok: false, erro: "A imagem passa de 2 MB." };
    }
    if (meta.contentType && !TIPOS_ACEITOS.includes(meta.contentType)) {
      await ctx.storage.delete(args.storageId);
      return { ok: false, erro: "Formato não aceito. Use PNG, JPG, WEBP ou SVG." };
    }

    const config = await linhaConfig(ctx);
    const anterior = config?.logoStorageId;

    if (config) {
      await ctx.db.patch(config._id, {
        logoStorageId: args.storageId,
        atualizadoEm: Date.now(),
      });
    } else {
      await ctx.db.insert("configuracao", {
        logoStorageId: args.storageId,
        atualizadoEm: Date.now(),
      });
    }

    // Troca de logo não deixa o arquivo antigo ocupando storage.
    if (anterior) await ctx.storage.delete(anterior);
    return { ok: true };
  },
});

export const removerLogo = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    const config = await linhaConfig(ctx);
    if (!config?.logoStorageId) return;
    await ctx.storage.delete(config.logoStorageId);
    await ctx.db.patch(config._id, {
      logoStorageId: undefined,
      atualizadoEm: Date.now(),
    });
  },
});
