import { mutation, query, internalMutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireRole, getUsuarioAtual } from "./lib/auth";
import { registrarHistorico } from "./lib/historico";
import {
  nivelRisco,
  compararPorRiscoEPrioridade,
  isAtiva,
} from "./lib/risco";

// ---------- Upload de fotos ----------

// Abertura pública pode anexar foto (RF02) — logo o upload URL é público.
// Risco conhecido: qualquer um gera URL de upload. Aceitável no MVP; endurecer depois
// (rate-limit / captcha) se virar porta de lixo (blueprint, riscos).
export const gerarUrlUploadPublico = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const gerarUrlUpload = mutation({
  args: {},
  handler: async (ctx) => {
    await getUsuarioAtual(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------- Abertura pública (RF01–RF04) ----------

export const abrirDemanda = mutation({
  args: {
    titulo: v.string(),
    descricao: v.string(),
    solicitanteNome: v.string(),
    solicitanteWhatsapp: v.string(),
    localTextoOriginal: v.string(),
    anexosAbertura: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    // Prevenção no servidor (princípio 2 / blueprint "porta de lixo"): valida onde grava.
    const titulo = args.titulo.trim();
    const descricao = args.descricao.trim();
    const nome = args.solicitanteNome.trim();
    const local = args.localTextoOriginal.trim();
    const whatsappDigitos = args.solicitanteWhatsapp.replace(/\D/g, "");

    if (titulo.length < 3) throw new Error("Descreva o problema em pelo menos 3 caracteres.");
    if (!descricao) throw new Error("A descrição é obrigatória.");
    if (!nome) throw new Error("Informe seu nome.");
    if (!local) throw new Error("Informe o local.");
    if (whatsappDigitos.length < 10 || whatsappDigitos.length > 13) {
      throw new Error("Informe um WhatsApp válido com DDD.");
    }

    const demandaId = await ctx.db.insert("demandas", {
      titulo,
      descricao,
      solicitanteNome: nome,
      solicitanteWhatsapp: whatsappDigitos,
      localTextoOriginal: local,
      anexosAbertura: args.anexosAbertura,
      status: "aberta",
    });

    await registrarHistorico(ctx, {
      demandaId,
      tipo: "criada",
      descricao: "Demanda aberta pelo formulário público",
    });

    // Identificador amigável exibido ao solicitante (RF04).
    return { demandaId, protocolo: `CN-${demandaId.slice(-6).toUpperCase()}` };
  },
});

// ---------- Enriquecimento ----------

async function comContexto(ctx: QueryCtx, d: Doc<"demandas">, agora: number) {
  const [categoria, local, executor] = await Promise.all([
    d.categoriaId ? ctx.db.get(d.categoriaId) : Promise.resolve(null),
    d.localId ? ctx.db.get(d.localId) : Promise.resolve(null),
    d.executorId ? ctx.db.get(d.executorId) : Promise.resolve(null),
  ]);
  return {
    ...d,
    categoriaNome: categoria?.nome ?? null,
    localNome: local?.nome ?? null,
    executorNome: executor?.nome ?? null,
    risco: nivelRisco(d.prazo, agora),
  };
}
export type DemandaComContexto = Awaited<ReturnType<typeof comContexto>>;

// ---------- Painel de Prazos (RF14–RF16, liderança) ----------

export const painelPrazos = query({
  args: {
    categoriaId: v.optional(v.id("categorias")),
    executorId: v.optional(v.id("usuarios")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const agora = Date.now();

    let ativos = (await ctx.db.query("demandas").collect()).filter((d) =>
      isAtiva(d.status),
    );
    if (args.categoriaId) ativos = ativos.filter((d) => d.categoriaId === args.categoriaId);
    if (args.executorId) ativos = ativos.filter((d) => d.executorId === args.executorId);

    ativos.sort((a, b) => compararPorRiscoEPrioridade(a, b, agora));
    const enriquecidos = await Promise.all(ativos.map((d) => comContexto(ctx, d, agora)));

    const vencidas = enriquecidos.filter((d) => d.risco === "vencida");
    const vencendo = enriquecidos.filter((d) => d.risco === "vencendo");
    const emExecucao = enriquecidos.filter(
      (d) => d.status === "em_execucao" && d.risco === "em_dia",
    );

    return {
      vencidas,
      vencendo,
      emExecucao,
      contadores: {
        vencidas: vencidas.length,
        vencendo: vencendo.length,
        emExecucao: emExecucao.length,
      },
    };
  },
});

// ---------- Minhas Demandas (RF09, executor) ----------

export const minhasDemandas = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await requireRole(ctx, ["executor", "lideranca"]);
    const agora = Date.now();

    const minhas = await ctx.db
      .query("demandas")
      .withIndex("by_executor", (q) => q.eq("executorId", usuario._id))
      .collect();

    minhas.sort((a, b) => compararPorRiscoEPrioridade(a, b, agora));
    const enriquecidos = await Promise.all(minhas.map((d) => comContexto(ctx, d, agora)));

    const porStatus = (s: Doc<"demandas">["status"]) =>
      enriquecidos.filter((d) => d.status === s);

    return {
      em_execucao: porStatus("em_execucao"),
      aguardando: porStatus("aguardando"),
      triada: porStatus("triada"),
      concluida: porStatus("concluida"),
    };
  },
});

// ---------- Detalhe (RF25, liderança ou executor dono — RF13) ----------

export const detalheDemanda = query({
  args: { demandaId: v.id("demandas") },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (usuario.papel !== "lideranca" && d.executorId !== usuario._id) {
      throw new Error("Sem permissão para ver esta demanda.");
    }

    const agora = Date.now();
    const ctxDemanda = await comContexto(ctx, d, agora);

    const historico = await ctx.db
      .query("historicoDemanda")
      .withIndex("by_demanda", (q) => q.eq("demandaId", d._id))
      .collect();

    // Resolve URLs de todas as fotos (abertura + anexadas no histórico).
    const idsFotos = [
      ...(d.anexosAbertura ?? []),
      ...historico.flatMap((h) => h.anexos ?? []),
    ];
    const fotos = await Promise.all(
      idsFotos.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })),
    );

    return {
      demanda: ctxDemanda,
      historico: historico
        .slice()
        .sort((a, b) => a._creationTime - b._creationTime),
      fotos: fotos.filter((f) => f.url),
      podeExecutar: d.executorId === usuario._id,
      papel: usuario.papel,
    };
  },
});

// ---------- Execução: mudança de status (RF10, RF12, RF13) ----------

const DESC_MOTIVO: Record<string, string> = {
  aguardando_aprovacao: "aguardando aprovação",
  aguardando_material: "aguardando material",
  aguardando_terceiro: "aguardando terceiro",
  aguardando_orcamento: "aguardando orçamento",
  aguardando_decisao: "aguardando decisão",
};

export const mudarStatus = mutation({
  args: {
    demandaId: v.id("demandas"),
    novoStatus: v.union(
      v.literal("em_execucao"),
      v.literal("aguardando"),
      v.literal("concluida"),
    ),
    motivoImpedimento: v.optional(
      v.union(
        v.literal("aguardando_aprovacao"),
        v.literal("aguardando_material"),
        v.literal("aguardando_terceiro"),
        v.literal("aguardando_orcamento"),
        v.literal("aguardando_decisao"),
      ),
    ),
    resultadoConfirmado: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["executor", "lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (usuario.papel !== "lideranca" && d.executorId !== usuario._id) {
      throw new Error("Você só pode atualizar demandas atribuídas a você.");
    }

    const agora = Date.now();
    // Progresso limpa a sinalização de risco (RF30 poderá re-sinalizar se travar de novo).
    const patch: Partial<Doc<"demandas">> = {
      status: args.novoStatus,
      riscoSinalizadoEm: undefined,
    };
    let desc = "";

    if (args.novoStatus === "aguardando") {
      // P5: motivo estruturado exigido DURANTE a parada.
      if (!args.motivoImpedimento) {
        throw new Error("Informe o motivo do impedimento ao pausar a demanda.");
      }
      patch.motivoImpedimento = args.motivoImpedimento;
      patch.impedimentoDesde = agora;
      desc = `Status: Aguardando — ${DESC_MOTIVO[args.motivoImpedimento]}`;
    } else if (args.novoStatus === "em_execucao") {
      patch.motivoImpedimento = undefined; // retomou: some o impedimento
      patch.impedimentoDesde = undefined;
      desc = "Status: Em execução";
    } else {
      // concluida — P10: exige confirmar que o resultado esperado foi atingido.
      if (args.resultadoConfirmado !== true) {
        throw new Error(
          "Para concluir, confirme que o resultado esperado foi atingido. " +
            "Se não foi, mantenha em execução ou registre um impedimento.",
        );
      }
      patch.concluidaEm = agora;
      patch.resultadoConfirmado = true;
      patch.motivoImpedimento = undefined;
      patch.impedimentoDesde = undefined;
      desc = "Status: Concluída — resultado confirmado";
    }

    await ctx.db.patch(args.demandaId, patch);
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "status_alterado",
      descricao: desc,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// ---------- Fotos antes/depois (RF11) ----------

export const anexarFoto = mutation({
  args: {
    demandaId: v.id("demandas"),
    storageId: v.id("_storage"),
    etiqueta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (usuario.papel !== "lideranca" && d.executorId !== usuario._id) {
      throw new Error("Sem permissão para anexar fotos nesta demanda.");
    }
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "foto",
      descricao: args.etiqueta ? `Foto anexada (${args.etiqueta})` : "Foto anexada",
      criadoPorClerkId: usuario.clerkId,
      anexos: [args.storageId],
    });
  },
});

// ---------- Cron: avaliação diária de risco (RF30, princípio 11) ----------

export const avaliarRiscosDoDia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agora = Date.now();
    const todas = await ctx.db.query("demandas").collect();
    let sinalizadas = 0;

    for (const d of todas) {
      if (!isAtiva(d.status)) continue;
      const nivel = nivelRisco(d.prazo, agora);
      const emRisco = nivel === "vencida" || nivel === "vencendo";
      if (emRisco && d.riscoSinalizadoEm === undefined) {
        await ctx.db.patch(d._id, { riscoSinalizadoEm: agora });
        await registrarHistorico(ctx, {
          demandaId: d._id,
          tipo: "risco_sinalizado",
          descricao:
            nivel === "vencida"
              ? "Risco sinalizado: demanda vencida sem conclusão"
              : "Risco sinalizado: demanda próxima do vencimento",
        });
        sinalizadas++;
      }
    }
    return { sinalizadas };
  },
});
