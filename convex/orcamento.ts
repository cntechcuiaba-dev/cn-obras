import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { origemConsumo } from "./schema";
import { getUsuarioAtual, requireRole, podeAcessarDemanda } from "./lib/auth";
import { registrarHistorico } from "./lib/historico";

// [E2] Orçamento é compromisso embutido na demanda — não entidade separada.
// A entrada dele (os quatro campos juntos) vive em demandas.mudarStatus; aqui
// ficam os passos seguintes: valor recebido, aprovação, custo e consumo.

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Registrar o valor que o fornecedor devolveu.
export const registrarValorRecebido = mutation({
  args: { demandaId: v.id("demandas"), valor: v.number() },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new ConvexError("Demanda não encontrada.");
    if (!d.orcamento) throw new ConvexError("Esta demanda não tem orçamento solicitado.");
    // escrita do bloco orcamento: liderança ou responsável (E2)
    if (usuario.papel !== "lideranca" && d.responsavelId !== usuario._id) {
      throw new ConvexError("Sem permissão para registrar o orçamento.");
    }
    if (args.valor < 0) throw new ConvexError("O valor não pode ser negativo.");

    await ctx.db.patch(args.demandaId, {
      orcamento: { ...d.orcamento, valorRecebido: args.valor, recebidoEm: Date.now() },
    });
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "orcamento_recebido",
      descricao: `Orçamento de ${d.orcamento.fornecedor}: ${brl(args.valor)}`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// [E2] Sem alçada por valor: todo orçamento recebido passa pela liderança.
export const aprovar = mutation({
  args: { demandaId: v.id("demandas") },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new ConvexError("Demanda não encontrada.");
    if (!d.orcamento?.valorRecebido && d.orcamento?.valorRecebido !== 0) {
      throw new ConvexError("Registre o valor recebido antes de aprovar.");
    }
    if (d.orcamento.aprovadoEm) return;

    await ctx.db.patch(args.demandaId, {
      orcamento: { ...d.orcamento, aprovadoEm: Date.now(), aprovadoPorId: usuario._id },
    });
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "orcamento_aprovado",
      descricao: `Orçamento aprovado: ${brl(d.orcamento.valorRecebido!)}`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// Registra que a cobrança foi feita e reagenda a próxima.
export const registrarCobranca = mutation({
  args: { demandaId: v.id("demandas"), proximaCobrancaEm: v.number() },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new ConvexError("Demanda não encontrada.");
    if (!d.orcamento) throw new ConvexError("Esta demanda não tem orçamento solicitado.");
    if (!podeAcessarDemanda(d, usuario)) {
      throw new ConvexError("Sem permissão para cobrar este orçamento.");
    }

    const feitas = d.orcamento.cobrancasFeitas + 1;
    await ctx.db.patch(args.demandaId, {
      orcamento: {
        ...d.orcamento,
        cobrancasFeitas: feitas,
        cobrarEm: args.proximaCobrancaEm,
      },
    });
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "orcamento_cobrado",
      descricao: `Cobrança ${feitas} a ${d.orcamento.fornecedor}`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// [E2] Consumo de material. SEM saldo, SEM inventário — decisão explícita:
// saldo exige que todo mundo alimente o sistema, e saldo errado é pior que
// saldo nenhum. Registra-se só o que foi consumido, em qual demanda.
export const registrarConsumo = mutation({
  args: {
    demandaId: v.id("demandas"),
    item: v.string(),
    quantidade: v.number(),
    valorUnitario: v.optional(v.number()),
    origem: origemConsumo,
  },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new ConvexError("Demanda não encontrada.");
    if (!podeAcessarDemanda(d, usuario)) {
      throw new ConvexError("Sem permissão para registrar consumo nesta demanda.");
    }
    const item = args.item.trim();
    if (!item) throw new ConvexError("Informe o item consumido.");
    if (args.quantidade <= 0) throw new ConvexError("A quantidade deve ser positiva.");

    await ctx.db.insert("consumos", {
      demandaId: args.demandaId,
      item,
      quantidade: args.quantidade,
      valorUnitario: args.valorUnitario,
      origem: args.origem,
    });
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "consumo",
      descricao:
        `Consumo: ${args.quantidade}× ${item}` +
        (args.valorUnitario !== undefined ? ` a ${brl(args.valorUnitario)}` : "") +
        ` (${args.origem === "estoque" ? "estoque" : "compra"})`,
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

export const consumosDaDemanda = query({
  args: { demandaId: v.id("demandas") },
  handler: async (ctx, args) => {
    const usuario = await getUsuarioAtual(ctx);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new ConvexError("Demanda não encontrada.");
    if (!podeAcessarDemanda(d, usuario)) throw new ConvexError("Sem permissão.");

    return await ctx.db
      .query("consumos")
      .withIndex("by_demanda", (q) => q.eq("demandaId", args.demandaId))
      .collect();
  },
});

// [E2] "com o valor pago anteriormente pelo mesmo item exibido ao lado" —
// é para isso que o consumo é registrado, mesmo sem saldo.
export const historicoDePreco = query({
  args: { item: v.string() },
  handler: async (ctx, args) => {
    await getUsuarioAtual(ctx);
    const item = args.item.trim();
    if (!item) return [];

    const anteriores = await ctx.db
      .query("consumos")
      .withIndex("by_item", (q) => q.eq("item", item))
      .collect();

    return anteriores
      .filter((c) => c.valorUnitario !== undefined)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5)
      .map((c) => ({
        valorUnitario: c.valorUnitario!,
        quantidade: c.quantidade,
        quando: c._creationTime,
        origem: c.origem,
      }));
  },
});
