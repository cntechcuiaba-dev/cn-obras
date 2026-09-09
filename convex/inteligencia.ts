import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireRole } from "./lib/auth";
import { DIA_MS } from "./lib/risco";

// RF29 / princípio 9: histórico vira aprendizado. Agrupa por categoria e por local ao
// longo do tempo — recorrência (mesmo grupo repetindo) e tempo médio até concluir —
// em vez de só listar cronologicamente.
export const aprendizado = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["lideranca"]);

    const [demandas, categorias, locais] = await Promise.all([
      ctx.db.query("demandas").collect(),
      ctx.db.query("categorias").collect(),
      ctx.db.query("locais").collect(),
    ]);
    const nomeCategoria = new Map(categorias.map((c) => [c._id, c.nome]));
    const nomeLocal = new Map(locais.map((l) => [l._id, l.nome]));

    type Acc = {
      total: number;
      espontaneas: number;
      recorrentes: number;
      concluidas: number;
      somaDias: number;
    };
    const porCategoria = new Map<string, Acc>();
    const porLocal = new Map<string, Acc>();

    const acumular = (
      mapa: Map<string, Acc>,
      chave: string,
      d: Doc<"demandas">,
    ) => {
      const a =
        mapa.get(chave) ??
        { total: 0, espontaneas: 0, recorrentes: 0, concluidas: 0, somaDias: 0 };
      a.total += 1;
      // [RF29] manutenção programada não é "problema que se repete" — se entrar
      // na mesma conta, uma recorrência mensal inflaria o local e esconderia
      // exatamente o padrão que esta tela existe para revelar.
      if (d.origemRecorrenciaId) a.recorrentes += 1;
      else a.espontaneas += 1;
      if (d.status === "concluida" && d.concluidaEm) {
        a.concluidas += 1;
        a.somaDias += (d.concluidaEm - d._creationTime) / DIA_MS;
      }
      mapa.set(chave, a);
    };

    for (const d of demandas) {
      if (d.status === "cancelada") continue;
      acumular(porCategoria, nomeCategoria.get(d.categoriaId!) ?? "Sem categoria", d);
      acumular(porLocal, nomeLocal.get(d.localId!) ?? "Sem local", d);
    }

    const materializar = (mapa: Map<string, Acc>) =>
      [...mapa.entries()]
        .map(([nome, a]) => ({
          nome,
          total: a.total,
          espontaneas: a.espontaneas,
          recorrentes: a.recorrentes,
          concluidas: a.concluidas,
          tempoMedioDias: a.concluidas > 0
            ? Math.round((a.somaDias / a.concluidas) * 10) / 10
            : null,
        }))
        // ordena por problema que se repete, não por volume total
        .sort((x, y) => y.espontaneas - x.espontaneas || y.total - x.total);

    return {
      porCategoria: materializar(porCategoria),
      porLocal: materializar(porLocal),
      totalConsiderado: demandas.filter((d) => d.status !== "cancelada").length,
    };
  },
});
