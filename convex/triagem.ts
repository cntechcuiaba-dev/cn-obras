import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { prioridadeDemanda } from "./schema";
import { requireRole } from "./lib/auth";
import { transicionar } from "./lib/estado";
import { registrarHistorico } from "./lib/historico";

// RF05: lista as demandas "aberta" aguardando triagem.
export const listarAbertas = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);
    const abertas = await ctx.db
      .query("demandas")
      .withIndex("by_status", (q) => q.eq("status", "aberta"))
      .collect();
    // mais antigas primeiro (esperando há mais tempo)
    return abertas.sort((a, b) => a._creationTime - b._creationTime);
  },
});

// RF06/RF07: triar exige categoria, local, prioridade, prazo, executor e resultado esperado.
// prazo e responsavelId são obrigatórios — o próprio tipo impede "triada" sem eles.
export const triar = mutation({
  args: {
    demandaId: v.id("demandas"),
    categoriaId: v.id("categorias"),
    localId: v.id("locais"),
    // Equipamento ao qual a demanda se refere, quando aplicável (opcional —
    // nem toda demanda é sobre um equipamento cadastrado).
    equipamentoId: v.optional(v.id("equipamentos")),
    prioridade: prioridadeDemanda,
    prazo: v.number(),
    // [E4] dono único do próximo movimento
    responsavelId: v.id("usuarios"),
    // [E4] quem executa junto — tem acesso, não recebe o movimento
    equipeIds: v.optional(v.array(v.id("usuarios"))),
    resultadoEsperado: v.string(),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");
    if (d.status !== "aberta") {
      throw new Error("Só é possível triar uma demanda com status 'aberta'.");
    }
    const resultado = args.resultadoEsperado.trim();
    if (!resultado) {
      throw new Error("Defina o resultado esperado (o que caracteriza a demanda como resolvida).");
    }

    const responsavel = await ctx.db.get(args.responsavelId);
    if (!responsavel) throw new Error("Responsável não encontrado.");

    // [E4] o responsável não se repete na equipe — o movimento tem dono único.
    const equipe = (args.equipeIds ?? []).filter((id) => id !== args.responsavelId);

    const nomesEquipe = (
      await Promise.all(equipe.map((id) => ctx.db.get(id)))
    )
      .map((u) => u?.nome)
      .filter(Boolean);

    await transicionar(ctx, {
      demandaId: args.demandaId,
      para: "triada",
      descricao:
        `Triada · prioridade ${args.prioridade} · atribuída a ${responsavel.nome}` +
        (nomesEquipe.length ? ` · equipe: ${nomesEquipe.join(", ")}` : ""),
      porClerkId: usuario.clerkId,
      campos: {
        categoriaId: args.categoriaId,
        localId: args.localId,
        equipamentoId: args.equipamentoId,
        prioridade: args.prioridade,
        prazo: args.prazo,
        responsavelId: args.responsavelId,
        equipeIds: equipe.length ? equipe : undefined,
        resultadoEsperado: resultado,
      },
    });
  },
});

// RF08: reatribuir executor, alterar prazo/prioridade a qualquer momento.
export const atualizar = mutation({
  args: {
    demandaId: v.id("demandas"),
    responsavelId: v.optional(v.id("usuarios")),
    equipeIds: v.optional(v.array(v.id("usuarios"))),
    // omitido = não mexe; null = limpa o vínculo; id = troca. Sem essa distinção,
    // uma demanda vinculada por engano nunca poderia ser desvinculada.
    equipamentoId: v.optional(v.union(v.id("equipamentos"), v.null())),
    prazo: v.optional(v.number()),
    prioridade: v.optional(prioridadeDemanda),
    resultadoEsperado: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");

    const patch: Record<string, unknown> = {};
    const mudancas: string[] = [];
    if (args.equipamentoId !== undefined && args.equipamentoId !== d.equipamentoId) {
      if (args.equipamentoId === null) {
        patch.equipamentoId = undefined;
        mudancas.push("desvinculada do equipamento");
      } else {
        const eq = await ctx.db.get(args.equipamentoId);
        patch.equipamentoId = args.equipamentoId;
        mudancas.push(`vinculada ao equipamento ${eq?.nome ?? "?"}`);
      }
    }
    if (args.responsavelId && args.responsavelId !== d.responsavelId) {
      const ex = await ctx.db.get(args.responsavelId);
      patch.responsavelId = args.responsavelId;
      mudancas.push(`reatribuída a ${ex?.nome ?? "?"}`);
    }
    if (args.equipeIds) {
      // [E4] responsável nunca duplica na equipe
      const alvo = args.responsavelId ?? d.responsavelId;
      const equipe = args.equipeIds.filter((id) => id !== alvo);
      patch.equipeIds = equipe.length ? equipe : undefined;
      mudancas.push("equipe atualizada");
    }
    if (args.prazo !== undefined && args.prazo !== d.prazo) {
      patch.prazo = args.prazo;
      patch.riscoSinalizadoEm = undefined; // novo prazo: reavaliar risco do zero
      mudancas.push("prazo alterado");
    }
    if (args.prioridade && args.prioridade !== d.prioridade) {
      patch.prioridade = args.prioridade;
      mudancas.push(`prioridade ${args.prioridade}`);
    }
    if (args.resultadoEsperado !== undefined) {
      patch.resultadoEsperado = args.resultadoEsperado.trim();
      mudancas.push("resultado esperado atualizado");
    }
    if (mudancas.length === 0) return;

    await ctx.db.patch(args.demandaId, patch);
    await registrarHistorico(ctx, {
      demandaId: args.demandaId,
      tipo: "atualizada",
      descricao: mudancas.join(" · "),
      criadoPorClerkId: usuario.clerkId,
    });
  },
});

// RF08: cancelar demanda.
export const cancelar = mutation({
  args: { demandaId: v.id("demandas"), motivo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const usuario = await requireRole(ctx, ["lideranca"]);
    const d = await ctx.db.get(args.demandaId);
    if (!d) throw new Error("Demanda não encontrada.");

    await transicionar(ctx, {
      demandaId: args.demandaId,
      para: "cancelada",
      descricao: args.motivo?.trim() ? `Cancelada — ${args.motivo.trim()}` : "Cancelada",
      porClerkId: usuario.clerkId,
      campos: { riscoSinalizadoEm: undefined },
    });
  },
});
