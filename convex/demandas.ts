import { mutation, query, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireRole, getUsuarioAtual, podeAcessarDemanda } from "./lib/auth";
import { registrarHistorico } from "./lib/historico";
import { criarDemanda, transicionar } from "./lib/estado";
import { gerarAvisoSeInteressaAoSolicitante } from "./avisos";
import { nivelRisco, isAtiva, DIAS_VENCENDO, DIA_MS } from "./lib/risco";

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

    const demandaId = await criarDemanda(
      ctx,
      {
        titulo,
        descricao,
        solicitanteNome: nome,
        solicitanteWhatsapp: whatsappDigitos,
        localTextoOriginal: local,
        anexosAbertura: args.anexosAbertura,
      },
      "aberta",
      "Demanda aberta pelo formulário público",
    );

    // Identificador amigável exibido ao solicitante (RF04).
    return { demandaId, protocolo: `CN-${demandaId.slice(-6).toUpperCase()}` };
  },
});

// ---------- Enriquecimento ----------

async function comContexto(ctx: QueryCtx, d: Doc<"demandas">, agora: number) {
  const [categoria, local, executor, equipamento] = await Promise.all([
    d.categoriaId ? ctx.db.get(d.categoriaId) : Promise.resolve(null),
    d.localId ? ctx.db.get(d.localId) : Promise.resolve(null),
    d.responsavelId ? ctx.db.get(d.responsavelId) : Promise.resolve(null),
    d.equipamentoId ? ctx.db.get(d.equipamentoId) : Promise.resolve(null),
  ]);
  // [E4] nomes da equipe, para a tela mostrar quem executa junto
  const equipeNomes = (
    await Promise.all((d.equipeIds ?? []).map((id) => ctx.db.get(id)))
  )
    .map((u) => u?.nome)
    .filter((n): n is string => Boolean(n));

  return {
    ...d,
    categoriaNome: categoria?.nome ?? null,
    localNome: local?.nome ?? null,
    responsavelNome: executor?.nome ?? null,
    equipamentoNome: equipamento?.nome ?? null,
    equipeNomes,
    risco: nivelRisco(d.prazo, agora),
  };
}
export type DemandaComContexto = Awaited<ReturnType<typeof comContexto>>;

// ---------- Detalhe (RF25, liderança ou executor dono — RF13) ----------

export const detalheDemanda = query({
  args: { demandaId: v.id("demandas") },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    // [E4 / RF13] responsável OU integrante da equipe
    if (!podeAcessarDemanda(d, usuario)) {
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
      podeExecutar: podeAcessarDemanda(d, usuario),
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
    // [E2] os quatro campos do orçamento vêm JUNTOS ou não vêm — compromisso sem
    // data e sem dono é o que produz demanda parada dez dias que ninguém explica.
    orcamento: v.optional(
      v.object({
        fornecedor: v.string(),
        solicitadoEm: v.number(),
        cobrarEm: v.number(),
        responsavelCobrancaId: v.id("usuarios"),
      }),
    ),
    resultadoConfirmado: v.optional(v.boolean()),
    // [E2] custo realizado — zero é resposta válida, vazio não é
    custo: v.optional(
      v.object({
        valor: v.number(),
        origem: v.union(
          v.literal("estoque"),
          v.literal("compra_direta"),
          v.literal("orcamento"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["executor", "lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    // [E4] responsável ou equipe podem atualizar status; a equipe executa junto.
    if (!podeAcessarDemanda(d, usuario)) {
      throw new Error("Você só pode atualizar demandas atribuídas a você.");
    }

    const agora = Date.now();
    // Progresso limpa a sinalização de risco (RF30 poderá re-sinalizar se travar de novo).
    const campos: Partial<Doc<"demandas">> = { riscoSinalizadoEm: undefined };
    let desc = "";

    if (args.novoStatus === "aguardando") {
      // P5: motivo estruturado exigido DURANTE a parada.
      if (!args.motivoImpedimento) {
        throw new Error("Informe o motivo do impedimento ao pausar a demanda.");
      }
      campos.motivoImpedimento = args.motivoImpedimento;
      campos.impedimentoDesde = agora;
      desc = `Status: Aguardando — ${DESC_MOTIVO[args.motivoImpedimento]}`;

      // [E2] orçamento é compromisso embutido: sem os quatro campos, não entra.
      if (args.motivoImpedimento === "aguardando_orcamento") {
        if (!args.orcamento) {
          throw new Error(
            "Para aguardar orçamento, informe fornecedor, data de solicitação, " +
              "data de cobrança e responsável pela cobrança.",
          );
        }
        if (!args.orcamento.fornecedor.trim()) {
          throw new Error("Informe o fornecedor do orçamento.");
        }
        if (args.orcamento.cobrarEm < args.orcamento.solicitadoEm) {
          throw new Error("A data de cobrança não pode ser anterior à solicitação.");
        }
        const cobrador = await ctx.db.get(args.orcamento.responsavelCobrancaId);
        if (!cobrador) throw new Error("Responsável pela cobrança não encontrado.");

        campos.orcamento = {
          fornecedor: args.orcamento.fornecedor.trim(),
          solicitadoEm: args.orcamento.solicitadoEm,
          cobrarEm: args.orcamento.cobrarEm,
          responsavelCobrancaId: args.orcamento.responsavelCobrancaId,
          cobrancasFeitas: 0,
        };
        desc += ` · ${campos.orcamento.fornecedor}, cobrar em ${formatarDataBR(args.orcamento.cobrarEm)}`;
      }
    } else if (args.novoStatus === "em_execucao") {
      campos.motivoImpedimento = undefined; // retomou: some o impedimento
      campos.impedimentoDesde = undefined;
      desc = "Status: Em execução";
    } else {
      // concluida — P10: exige confirmar que o resultado esperado foi atingido.
      if (args.resultadoConfirmado !== true) {
        throw new Error(
          "Para concluir, confirme que o resultado esperado foi atingido. " +
            "Se não foi, mantenha em execução ou registre um impedimento.",
        );
      }
      // [E2] passou por material ou orçamento => não conclui sem valor lançado.
      // Zero é resposta válida; vazio não é.
      const gastou = await passouPorGasto(ctx, args.demandaId);
      if (gastou && d.custo === undefined && args.custo === undefined) {
        throw new Error(
          "Esta demanda passou por material ou orçamento. Lance o valor gasto " +
            "antes de concluir — zero é resposta válida, vazio não é.",
        );
      }
      if (args.custo) {
        if (args.custo.valor < 0) throw new Error("O valor não pode ser negativo.");
        campos.custo = { ...args.custo, lancadoEm: agora };
      }

      campos.concluidaEm = agora;
      campos.resultadoConfirmado = true;
      campos.motivoImpedimento = undefined;
      campos.impedimentoDesde = undefined;
      desc = "Status: Concluída — resultado confirmado";
    }

    // O status é escrito só aqui dentro de estado.ts — dono único da máquina.
    await transicionar(ctx, {
      demandaId: args.demandaId,
      para: args.novoStatus,
      descricao: desc,
      porClerkId: usuario.clerkId,
      campos,
      // marca a parada de forma consultável (ver passouPorGasto)
      tipo:
        args.novoStatus === "aguardando" && args.motivoImpedimento
          ? TIPO_IMPEDIMENTO(args.motivoImpedimento)
          : undefined,
    });

    // [E1] o envio ao solicitante é manual, o lembrete não: toda mudança que
    // interessa a ele vira aviso pendente no painel de quem é responsável.
    await gerarAvisoSeInteressaAoSolicitante(ctx, args.demandaId, args.novoStatus);
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
    // [E4] a equipe executa junto: pode anexar foto
    if (!podeAcessarDemanda(d, usuario)) {
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

// Momento da última mudança de status da demanda, lido do histórico. Sinalizar
// risco não conta como progresso — senão o próprio aviso silenciaria o próximo.
// Foto e aviso também não são mudança de status.
const TIPOS_SEM_PROGRESSO = ["risco_sinalizado", "foto", "cobranca_devida"];

async function ultimaMudancaDeStatus(
  ctx: MutationCtx,
  demandaId: Id<"demandas">,
): Promise<number | null> {
  const eventos = await ctx.db
    .query("historicoDemanda")
    .withIndex("by_demanda", (q) => q.eq("demandaId", demandaId))
    .collect();

  const progressos = eventos
    .filter((e) => !TIPOS_SEM_PROGRESSO.includes(e.tipo))
    .map((e) => e._creationTime);

  return progressos.length ? Math.max(...progressos) : null;
}

// [E2] A demanda passou por material ou orçamento em algum momento? A parada é
// marcada no histórico com tipo legível por máquina, então isto é consulta —
// não busca por texto, que quebraria ao mudar uma palavra da descrição.
export const TIPO_IMPEDIMENTO = (motivo: string) => `impedimento_${motivo}`;
const TIPOS_DE_GASTO = [
  TIPO_IMPEDIMENTO("aguardando_material"),
  TIPO_IMPEDIMENTO("aguardando_orcamento"),
];

async function passouPorGasto(
  ctx: MutationCtx,
  demandaId: Id<"demandas">,
): Promise<boolean> {
  const eventos = await ctx.db
    .query("historicoDemanda")
    .withIndex("by_demanda", (q) => q.eq("demandaId", demandaId))
    .collect();
  return eventos.some((e) => TIPOS_DE_GASTO.includes(e.tipo));
}

const formatarDataBR = (ts: number) =>
  new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export const avaliarRiscosDoDia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agora = Date.now();
    const todas = await ctx.db.query("demandas").collect();
    let sinalizadas = 0;

    for (const d of todas) {
      if (!isAtiva(d.status)) continue;
      if (d.riscoSinalizadoEm !== undefined) continue; // idempotente (RF30)

      const nivel = nivelRisco(d.prazo, agora);
      if (nivel !== "vencida" && nivel !== "vencendo") continue;

      // [RF30] "vencidas, OU a vencer em N dias SEM PROGRESSO desde a última
      // mudança de status". Vencida é risco sempre; a vencer só é risco se
      // ninguém mexeu — senão o sistema grita para quem já está trabalhando.
      let motivo: string;
      if (nivel === "vencida") {
        motivo = "Risco sinalizado: demanda vencida sem conclusão";
      } else {
        const ultimoProgresso = await ultimaMudancaDeStatus(ctx, d._id);
        const houveProgressoRecente =
          ultimoProgresso !== null &&
          agora - ultimoProgresso < DIAS_VENCENDO * DIA_MS;
        if (houveProgressoRecente) continue;
        motivo =
          "Risco sinalizado: vence em breve e não houve movimento desde a " +
          "última mudança de status";
      }

      await ctx.db.patch(d._id, { riscoSinalizadoEm: agora });
      await registrarHistorico(ctx, {
        demandaId: d._id,
        tipo: "risco_sinalizado",
        descricao: motivo,
      });
      sinalizadas++;
    }
    return { sinalizadas };
  },
});
