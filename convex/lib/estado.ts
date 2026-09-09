import { MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { registrarHistorico } from "./historico";

// ÚNICO lugar do projeto que escreve o campo `status`. Nenhuma outra function grava
// esse campo — se isso for violado, a máquina de estados deixa de existir sem
// ninguém perceber (Emenda 01, "Onde a trava mora").

export type Status = Doc<"demandas">["status"];

// Fora deste mapa, não existe transição.
const PERMITIDAS: Record<Status, Status[]> = {
  aberta: ["triada", "cancelada"],
  triada: ["em_execucao", "aguardando", "cancelada"],
  em_execucao: ["aguardando", "concluida", "cancelada"],
  aguardando: ["em_execucao", "concluida", "cancelada"],
  concluida: [], // estado final
  cancelada: [], // estado final
};

export interface Transicao {
  demandaId: Id<"demandas">;
  para: Status;
  descricao: string; // vai para o histórico (RF24)
  porClerkId?: string; // ausente = gerado pelo sistema (cron)
  // campos que acompanham a transição (prazo, motivo, custo, etc.)
  campos?: Partial<Doc<"demandas">>;
}

export async function transicionar(ctx: MutationCtx, t: Transicao): Promise<void> {
  const d = await ctx.db.get(t.demandaId);
  if (!d) throw new Error("Demanda não encontrada.");

  if (!PERMITIDAS[d.status].includes(t.para)) {
    throw new Error(
      `Transição inválida: "${d.status}" não pode ir para "${t.para}".`,
    );
  }

  await ctx.db.patch(t.demandaId, { ...(t.campos ?? {}), status: t.para });

  await registrarHistorico(ctx, {
    demandaId: t.demandaId,
    tipo: "status_alterado",
    descricao: t.descricao,
    criadoPorClerkId: t.porClerkId,
  });
}

// A criação também nasce aqui: o estado inicial tem o mesmo dono das transições.
export async function criarDemanda(
  ctx: MutationCtx,
  dados: Omit<Doc<"demandas">, "_id" | "_creationTime" | "status">,
  statusInicial: Extract<Status, "aberta" | "triada">,
  descricaoHistorico: string,
  porClerkId?: string,
): Promise<Id<"demandas">> {
  const demandaId = await ctx.db.insert("demandas", {
    ...dados,
    status: statusInicial,
  });

  await registrarHistorico(ctx, {
    demandaId,
    tipo: "criada",
    descricao: descricaoHistorico,
    criadoPorClerkId: porClerkId,
  });

  return demandaId;
}
