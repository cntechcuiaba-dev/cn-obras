import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { periodicidade } from "./schema";
import { requireRole } from "./lib/auth";
import { criarDemanda } from "./lib/estado";
import { DIA_MS } from "./lib/risco";

const INTERVALO_DIAS: Record<string, number> = {
  mensal: 30,
  bimestral: 60,
  trimestral: 90,
  semestral: 182,
  anual: 365,
};

// [E5] A recorrência não serve para criar a demanda no dia — serve para a liderança
// se programar antes. Estas duas datas são o coração disso, e são usadas tanto pelo
// cron quanto pela tela, para não divergirem.
export function datasDaRecorrencia(r: {
  periodicidade: string;
  antecedenciaDias: number;
  ultimaGeracaoEm?: number;
  _creationTime: number;
}) {
  const intervalo = INTERVALO_DIAS[r.periodicidade] * DIA_MS;
  const antecedencia = r.antecedenciaDias * DIA_MS;

  // Data prevista da próxima manutenção. Quando já houve geração, a manutenção
  // anterior estava prevista para (geração + antecedência).
  const proximaManutencao =
    r.ultimaGeracaoEm !== undefined
      ? r.ultimaGeracaoEm + antecedencia + intervalo
      : r._creationTime + intervalo;

  // Quando a demanda deve nascer: com a antecedência combinada.
  const proximaGeracao = proximaManutencao - antecedencia;

  return { proximaManutencao, proximaGeracao };
}

// RF17: cadastrar manutenção recorrente.
export const criar = mutation({
  args: {
    titulo: v.string(),
    descricao: v.string(),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    // A maioria das recorrências é sobre um equipamento; opcional porque nem
    // toda (ex.: "revisão elétrica geral do templo") é sobre "um" equipamento.
    equipamentoId: v.optional(v.id("equipamentos")),
    executorPadraoId: v.id("usuarios"),
    periodicidade,
    // [E5] gerar antes do vencimento, para dar tempo de programação
    antecedenciaDias: v.number(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    if (!args.titulo.trim()) throw new Error("Título é obrigatório.");
    if (args.antecedenciaDias < 0) {
      throw new Error("Antecedência em dias não pode ser negativa.");
    }
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
    // omitido = não mexe; null = desvincula; id = troca (mesmo padrão de
    // triagem.atualizar — sem essa distinção nunca daria pra desvincular).
    equipamentoId: v.optional(v.union(v.id("equipamentos"), v.null())),
    executorPadraoId: v.optional(v.id("usuarios")),
    periodicidade: v.optional(periodicidade),
    antecedenciaDias: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["lideranca"]);
    const { id, ...resto } = args;

    if (resto.titulo !== undefined && !resto.titulo.trim()) {
      throw new Error("Título é obrigatório.");
    }
    if (resto.antecedenciaDias !== undefined && resto.antecedenciaDias < 0) {
      throw new Error("Antecedência em dias não pode ser negativa.");
    }

    const patch = Object.fromEntries(
      Object.entries(resto)
        .filter(([, val]) => val !== undefined)
        .map(([k, val]) => [k, val === null ? undefined : val]),
    );
    if (Object.keys(patch).length === 0) return;
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
        const [categoria, local, executor, equipamento] = await Promise.all([
          ctx.db.get(r.categoriaId),
          ctx.db.get(r.localId),
          ctx.db.get(r.executorPadraoId),
          r.equipamentoId ? ctx.db.get(r.equipamentoId) : Promise.resolve(null),
        ]);
        const { proximaManutencao, proximaGeracao } = datasDaRecorrencia(r);
        return {
          ...r,
          categoriaNome: categoria?.nome ?? null,
          localNome: local?.nome ?? null,
          responsavelNome: executor?.nome ?? null,
          equipamentoNome: equipamento?.nome ?? null,
          proximaGeracao: r.ativa ? proximaGeracao : null,
          proximaManutencao: r.ativa ? proximaManutencao : null,
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
      const { proximaManutencao, proximaGeracao } = datasDaRecorrencia(r);

      // [RF18a] gera COM antecedência — demanda que nasce no dia do vencimento
      // não deu tempo de nada. [RF19] idempotente: ultimaGeracaoEm empurra a
      // próxima geração um intervalo inteiro para frente.
      if (agora < proximaGeracao) continue;

      // O Convex roda em UTC e o app é lido no Brasil: sem fixar o fuso, o mesmo
      // instante vira um dia no histórico e outro no cabeçalho da tela.
      const previstaEm = new Date(proximaManutencao).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      });

      // RF31: nasce pelo dono único do estado, com evento visível (não silencioso).
      await criarDemanda(
        ctx,
        {
          titulo: r.titulo,
          descricao: r.descricao,
          solicitanteNome: "Sistema (recorrência)",
          solicitanteWhatsapp: "",
          localTextoOriginal: "",
          categoriaId: r.categoriaId,
          localId: r.localId,
          equipamentoId: r.equipamentoId,
          prioridade: "media",
          // [RF18a] o prazo é a data prevista da manutenção
          prazo: proximaManutencao,
          responsavelId: r.executorPadraoId,
          resultadoEsperado: `Manutenção recorrente "${r.titulo}" realizada conforme rotina.`,
          origemRecorrenciaId: r._id,
        },
        "triada",
        `Gerada com ${r.antecedenciaDias} dia(s) de antecedência pela recorrência ` +
          `"${r.titulo}" — manutenção prevista para ${previstaEm}`,
      );

      await ctx.db.patch(r._id, { ultimaGeracaoEm: agora });
      geradas++;
    }
    return { geradas };
  },
});
