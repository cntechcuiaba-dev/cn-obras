import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Equipamento com manutenção periódica (ar-condicionado, bebedouro...). Vincula
// tanto recorrências quanto demandas avulsas, para o aprendizado revelar padrão
// por equipamento específico, não só por local.

const modules = import.meta.glob("./**/*.ts");
const LIDER = "clerk_lider";
const EXEC = "clerk_exec";
const DIA = 86_400_000;

async function cenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
    });
    const exec = await ctx.db.insert("usuarios", {
      clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
    });
    const categoria = await ctx.db.insert("categorias", { nome: "Ar-condicionado", ativa: true });
    const local = await ctx.db.insert("locais", { nome: "Templo", ativo: true });
    return { lider, exec, categoria, local };
  });
  return { t, ...ids };
}

describe("cadastro de equipamentos", () => {
  test("liderança cadastra; nome e tipo são obrigatórios", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });

    await expect(
      comoLider.mutation(api.equipamentos.criar, {
        nome: "  ",
        tipo: "Ar-condicionado",
        localId: c.local,
      }),
    ).rejects.toThrow(/nome/i);

    const id = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado — Templo",
      tipo: "Ar-condicionado",
      localId: c.local,
      patrimonio: "PAT-01",
    });
    await c.t.run(async (ctx) => {
      const eq = await ctx.db.get(id);
      expect(eq?.nome).toBe("Ar-condicionado — Templo");
      expect(eq?.ativo).toBe(true);
      expect(eq?.patrimonio).toBe("PAT-01");
    });
  });

  test("executor não cadastra, mas lê", async () => {
    const c = await cenario();
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.equipamentos.criar, {
        nome: "Bebedouro",
        tipo: "Bebedouro",
        localId: c.local,
      }),
    ).rejects.toThrow(/permissão/i);

    await c.t.withIdentity({ subject: LIDER }).mutation(api.equipamentos.criar, {
      nome: "Bebedouro — Secretaria",
      tipo: "Bebedouro",
      localId: c.local,
    });
    const lista = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.equipamentos.listar, {});
    expect(lista).toHaveLength(1);
  });

  test("inativo some da listagem padrão mas aparece com incluirInativos", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });
    const id = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Portão eletrônico",
      tipo: "Portão",
      localId: c.local,
    });
    await comoLider.mutation(api.equipamentos.alternarAtivo, {
      equipamentoId: id,
      ativo: false,
    });

    const padrao = await comoLider.query(api.equipamentos.listar, {});
    expect(padrao).toHaveLength(0);

    const todos = await comoLider.query(api.equipamentos.listar, { incluirInativos: true });
    expect(todos).toHaveLength(1);
    expect(todos[0].localNome).toBe("Templo");
  });
});

describe("vínculo com demanda avulsa", () => {
  async function abrirETriarComEquip(
    c: Awaited<ReturnType<typeof cenario>>,
    equipamentoId?: Id<"equipamentos">,
  ) {
    const r = await c.t.mutation(api.demandas.abrirDemanda, {
      titulo: "Ar não gela",
      descricao: "x",
      solicitanteNome: "Fulano",
      solicitanteWhatsapp: "62999999999",
      localTextoOriginal: "Templo",
    });
    const demandaId = r.demandaId as Id<"demandas">;
    await c.t.withIdentity({ subject: LIDER }).mutation(api.triagem.triar, {
      demandaId,
      categoriaId: c.categoria,
      localId: c.local,
      equipamentoId,
      prioridade: "media",
      prazo: Date.now() + 2 * DIA,
      responsavelId: c.exec,
      resultadoEsperado: "ok",
    });
    return demandaId;
  }

  test("triagem grava o equipamento vinculado (opcional)", async () => {
    const c = await cenario();
    const eqId = await c.t.withIdentity({ subject: LIDER }).mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado — Templo",
      tipo: "Ar-condicionado",
      localId: c.local,
    });
    const demandaId = await abrirETriarComEquip(c, eqId);
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.equipamentoId).toBe(eqId);
    });
  });

  test("triagem sem equipamento não quebra (a maioria não tem um)", async () => {
    const c = await cenario();
    const demandaId = await abrirETriarComEquip(c, undefined);
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.equipamentoId).toBeUndefined();
    });
  });

  test("RF08: liderança troca e depois desvincula o equipamento (null limpa, omitido não mexe)", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });
    const eq1 = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado A", tipo: "Ar-condicionado", localId: c.local,
    });
    const eq2 = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado B", tipo: "Ar-condicionado", localId: c.local,
    });
    const demandaId = await abrirETriarComEquip(c, eq1);

    // omitido: não mexe
    await comoLider.mutation(api.triagem.atualizar, { demandaId, prioridade: "alta" });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.equipamentoId).toBe(eq1);
    });

    // troca para eq2
    await comoLider.mutation(api.triagem.atualizar, { demandaId, equipamentoId: eq2 });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.equipamentoId).toBe(eq2);
    });

    // null: desvincula de vez
    await comoLider.mutation(api.triagem.atualizar, { demandaId, equipamentoId: null });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.equipamentoId).toBeUndefined();
    });
  });
});

describe("vínculo com recorrência", () => {
  test("demanda gerada carrega o equipamento da recorrência", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });
    const eqId = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado — Templo", tipo: "Ar-condicionado", localId: c.local,
    });
    const recId = await comoLider.mutation(api.recorrencias.criar, {
      titulo: "Limpeza do ar",
      descricao: "Limpeza trimestral",
      categoriaId: c.categoria,
      localId: c.local,
      equipamentoId: eqId,
      executorPadraoId: c.exec,
      periodicidade: "mensal",
      antecedenciaDias: 40, // maior que o intervalo: já nasce na primeira rodada
    });

    await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});

    await c.t.run(async (ctx) => {
      const demandas = await ctx.db.query("demandas").collect();
      expect(demandas).toHaveLength(1);
      expect(demandas[0].equipamentoId).toBe(eqId);
      expect(demandas[0].origemRecorrenciaId).toBe(recId);
    });
  });
});

describe("aprendizado por equipamento (RF29)", () => {
  test("agrupa só quem tem equipamento — sem bucket 'sem equipamento'", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });
    const eqId = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado — Templo", tipo: "Ar-condicionado", localId: c.local,
    });

    // duas demandas espontâneas no mesmo equipamento + uma sem equipamento nenhum
    for (let i = 0; i < 2; i++) {
      const r = await c.t.mutation(api.demandas.abrirDemanda, {
        titulo: `Problema ${i}`, descricao: "x",
        solicitanteNome: "Fulano", solicitanteWhatsapp: "62999999999",
        localTextoOriginal: "Templo",
      });
      await comoLider.mutation(api.triagem.triar, {
        demandaId: r.demandaId as Id<"demandas">,
        categoriaId: c.categoria, localId: c.local, equipamentoId: eqId,
        prioridade: "media", prazo: Date.now() + DIA,
        responsavelId: c.exec, resultadoEsperado: "ok",
      });
    }
    const semEquip = await c.t.mutation(api.demandas.abrirDemanda, {
      titulo: "Sem equipamento", descricao: "x",
      solicitanteNome: "Fulano", solicitanteWhatsapp: "62999999999",
      localTextoOriginal: "Templo",
    });
    await comoLider.mutation(api.triagem.triar, {
      demandaId: semEquip.demandaId as Id<"demandas">,
      categoriaId: c.categoria, localId: c.local,
      prioridade: "media", prazo: Date.now() + DIA,
      responsavelId: c.exec, resultadoEsperado: "ok",
    });

    const r = await comoLider.query(api.inteligencia.aprendizado, {});
    expect(r.porEquipamento).toHaveLength(1);
    expect(r.porEquipamento[0].nome).toBe("Ar-condicionado — Templo");
    expect(r.porEquipamento[0].espontaneas).toBe(2);
    // a demanda sem equipamento não gera um bucket "sem equipamento"
    expect(r.porEquipamento.find((x) => x.nome.toLowerCase().includes("sem"))).toBeUndefined();
  });

  test("recorrência gerada conta como recorrente, não espontânea, no equipamento", async () => {
    const c = await cenario();
    const comoLider = c.t.withIdentity({ subject: LIDER });
    const eqId = await comoLider.mutation(api.equipamentos.criar, {
      nome: "Ar-condicionado — Templo", tipo: "Ar-condicionado", localId: c.local,
    });
    await comoLider.mutation(api.recorrencias.criar, {
      titulo: "Limpeza", descricao: "x",
      categoriaId: c.categoria, localId: c.local, equipamentoId: eqId,
      executorPadraoId: c.exec, periodicidade: "mensal", antecedenciaDias: 40,
    });
    await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});

    const r = await comoLider.query(api.inteligencia.aprendizado, {});
    const linha = r.porEquipamento.find((x) => x.nome === "Ar-condicionado — Templo")!;
    expect(linha.recorrentes).toBe(1);
    expect(linha.espontaneas).toBe(0);
  });
});
