import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getUsuarioAtual } from "./lib/auth";
import { pontuar, frase, bloqueio, acaoDe } from "./lib/movimento";

// [E3] Painel de UM movimento. Substitui o RF14 original (grupos + contadores),
// revogado pela Emenda 01.

export const proximoMovimento = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await getUsuarioAtual(ctx);
    const agora = Date.now();

    const todas = await ctx.db.query("demandas").collect();

    // [RF14i] Acesso muda por papel — o painel continua sendo um item só.
    // Liderança age na triagem (só ela destrava demanda "aberta") e no que é dela.
    const minhas = todas.filter((d) => {
      if (d.status === "concluida" || d.status === "cancelada") return false;
      const souResponsavel = d.responsavelId === usuario._id;
      const souEquipe = (d.equipeIds ?? []).includes(usuario._id);
      if (usuario.papel === "lideranca") {
        return d.status === "aberta" || souResponsavel || souEquipe;
      }
      // [E4] equipe tem acesso, mas o movimento é do responsável
      return souResponsavel;
    });

    // [RF14b] Bloqueado por terceiro sai do painel.
    const acionaveis: Doc<"demandas">[] = [];
    const bloqueados: { d: Doc<"demandas">; b: ReturnType<typeof bloqueio> }[] = [];
    for (const d of minhas) {
      const b = bloqueio(d);
      if (b) bloqueados.push({ d, b });
      else if (acaoDe(d)) acionaveis.push(d); // [RF14f] sem ação executável não entra
    }

    // [RF14c] Ordem de uma fórmula única, calculada aqui na leitura.
    const ordenadas = acionaveis
      .map((d) => ({ d, ...pontuar(d, agora) }))
      .sort((a, b) => b.pontos - a.pontos);

    const enriquecer = async (d: Doc<"demandas">) => {
      const [categoria, local, responsavel] = await Promise.all([
        d.categoriaId ? ctx.db.get(d.categoriaId) : Promise.resolve(null),
        d.localId ? ctx.db.get(d.localId) : Promise.resolve(null),
        d.responsavelId ? ctx.db.get(d.responsavelId) : Promise.resolve(null),
      ]);
      return {
        categoriaNome: categoria?.nome ?? null,
        localNome: local?.nome ?? null,
        responsavelNome: responsavel?.nome ?? null,
      };
    };

    const primeiro = ordenadas[0];
    const item = primeiro
      ? {
          _id: primeiro.d._id,
          titulo: primeiro.d.titulo,
          descricao: primeiro.d.descricao,
          status: primeiro.d.status,
          prazo: primeiro.d.prazo,
          localTextoOriginal: primeiro.d.localTextoOriginal,
          solicitanteNome: primeiro.d.solicitanteNome,
          // [RF14d] frase gerada da fórmula, não escrita à mão
          porque: frase(primeiro.fatores),
          acao: acaoDe(primeiro.d)!,
          ...(await enriquecer(primeiro.d)),
        }
      : null;

    // [RF14e] No máximo três próximos, linha simples: título e data. Nada além disso.
    const proximos = ordenadas.slice(1, 4).map((x) => ({
      _id: x.d._id,
      titulo: x.d.titulo,
      prazo: x.d.prazo,
    }));

    const bloqueadosSaida = await Promise.all(
      bloqueados.map(async ({ d, b }) => ({
        _id: d._id,
        titulo: d.titulo,
        prazo: d.prazo,
        motivo: d.motivoImpedimento,
        impedimentoDesde: d.impedimentoDesde,
        quemDestrava: b!.quemDestrava,
        condicaoRetorno: b!.condicaoRetorno,
        ...(await enriquecer(d)),
      })),
    );

    return { item, proximos, bloqueados: bloqueadosSaida, papel: usuario.papel };
  },
});

// [RF14i] "Todas as demandas" é tela de consulta separada — nunca a tela inicial.
export const todasDemandas = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await getUsuarioAtual(ctx);
    const agora = Date.now();
    const todas = await ctx.db.query("demandas").collect();

    const visiveis = todas.filter((d) => {
      if (usuario.papel === "lideranca") return true;
      return (
        d.responsavelId === usuario._id ||
        (d.equipeIds ?? []).includes(usuario._id)
      );
    });

    const enriquecidas = await Promise.all(
      visiveis.map(async (d) => {
        const [categoria, local, responsavel] = await Promise.all([
          d.categoriaId ? ctx.db.get(d.categoriaId) : Promise.resolve(null),
          d.localId ? ctx.db.get(d.localId) : Promise.resolve(null),
          d.responsavelId ? ctx.db.get(d.responsavelId) : Promise.resolve(null),
        ]);
        return {
          ...d,
          categoriaNome: categoria?.nome ?? null,
          localNome: local?.nome ?? null,
          responsavelNome: responsavel?.nome ?? null,
          pontos: pontuar(d, agora).pontos,
        };
      }),
    );

    return enriquecidas.sort((a, b) => b.pontos - a.pontos);
  },
});
