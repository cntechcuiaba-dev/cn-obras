import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Escrita de histórico só passa por aqui — nunca é inserida direto pelo cliente
// (schema/autorização: historicoDemanda escrita só via mutation interna).
export async function registrarHistorico(
  ctx: MutationCtx,
  args: {
    demandaId: Id<"demandas">;
    tipo: string;
    descricao: string;
    criadoPorClerkId?: string; // ausente => gerado pelo sistema (cron)
    anexos?: Id<"_storage">[];
  },
) {
  await ctx.db.insert("historicoDemanda", {
    demandaId: args.demandaId,
    tipo: args.tipo,
    descricao: args.descricao,
    criadoPorClerkId: args.criadoPorClerkId,
    anexos: args.anexos,
  });
}
