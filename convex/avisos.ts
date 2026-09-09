import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUsuarioAtual } from "./lib/auth";

// [E1] O solicitante não tem conta e é avisado por WhatsApp manual (RF21-23).
// O que muda com a emenda: o ENVIO é manual, o LEMBRETE não. Toda mudança de
// status que interessa a ele vira um aviso pendente, que aparece como movimento
// no painel do responsável — com a mensagem pronta — e só some quando enviado.

const STATUS_QUE_INTERESSAM = ["em_execucao", "aguardando", "concluida"];

function preencher(texto: string, dados: Record<string, string>): string {
  return texto.replace(/{{(\w+)}}/g, (_, chave) => dados[chave] ?? "");
}

export async function gerarAvisoSeInteressaAoSolicitante(
  ctx: MutationCtx,
  demandaId: Id<"demandas">,
  novoStatus: string,
): Promise<void> {
  if (!STATUS_QUE_INTERESSAM.includes(novoStatus)) return;

  const d = await ctx.db.get(demandaId);
  if (!d || !d.responsavelId) return;
  // demanda gerada por recorrência não tem solicitante de fora para avisar
  if (!d.solicitanteWhatsapp) return;

  const modelos = await ctx.db.query("modelosMensagem").collect();
  const modelo = modelos.find((m) => m.tipo === novoStatus);
  if (!modelo) return;

  const local = d.localId ? await ctx.db.get(d.localId) : null;

  const mensagem = preencher(modelo.texto, {
    demanda: d.titulo,
    solicitante: d.solicitanteNome,
    local: local?.nome ?? d.localTextoOriginal,
    prazo: d.prazo
      ? new Date(d.prazo).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })
      : "a definir",
  });

  await ctx.db.insert("avisos", {
    demandaId,
    responsavelId: d.responsavelId,
    gatilho: novoStatus,
    mensagem,
  });
}

// Avisos ainda não enviados de quem está logado — viram movimento no painel.
export const pendentes = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await getUsuarioAtual(ctx);

    const meus = await ctx.db
      .query("avisos")
      .withIndex("by_responsavel_pendente", (q) =>
        q.eq("responsavelId", usuario._id).eq("enviadoEm", undefined),
      )
      .collect();

    return await Promise.all(
      meus.map(async (a) => {
        const d = await ctx.db.get(a.demandaId);
        return {
          _id: a._id,
          demandaId: a.demandaId,
          gatilho: a.gatilho,
          mensagem: a.mensagem,
          criadoEm: a._creationTime,
          demandaTitulo: d?.titulo ?? "(demanda removida)",
          whatsapp: d?.solicitanteWhatsapp ?? "",
          solicitante: d?.solicitanteNome ?? "",
        };
      }),
    );
  },
});

// [E1] só sai do painel quando alguém confirma que enviou.
export const marcarEnviado = mutation({
  args: { avisoId: v.id("avisos") },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const aviso = await ctx.db.get(args.avisoId);
    if (!aviso) throw new Error("Aviso não encontrado.");
    if (aviso.responsavelId !== usuario._id && usuario.papel !== "lideranca") {
      throw new Error("Só o responsável marca o aviso como enviado.");
    }
    if (aviso.enviadoEm !== undefined) return;

    await ctx.db.patch(args.avisoId, { enviadoEm: Date.now() });
    await ctx.db.insert("historicoDemanda", {
      demandaId: aviso.demandaId,
      tipo: "aviso_enviado",
      descricao: `Solicitante avisado por WhatsApp (${aviso.gatilho})`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});
