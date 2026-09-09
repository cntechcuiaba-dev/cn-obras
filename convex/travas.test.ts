import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Testes das TRAVAS (Emenda 01, "Onde a trava mora"): o Convex não expressa
// "campo obrigatório apenas neste estado" — todas as travas vivem nas mutations.
// Trava sem teste é promessa sem cumprimento.

const modules = import.meta.glob("./**/*.ts");

const CLERK_LIDER = "clerk_lider";
const CLERK_EXEC = "clerk_exec";
const CLERK_EQUIPE = "clerk_equipe";
const CLERK_ESTRANHO = "clerk_estranho";

async function cenario() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: CLERK_LIDER,
      nome: "Ana",
      email: "ana@cn.com",
      papel: "lideranca",
      ativo: true,
    });
    const exec = await ctx.db.insert("usuarios", {
      clerkId: CLERK_EXEC,
      nome: "Marcos",
      email: "marcos@cn.com",
      papel: "executor",
      ativo: true,
    });
    const equipe = await ctx.db.insert("usuarios", {
      clerkId: CLERK_EQUIPE,
      nome: "João",
      email: "joao@cn.com",
      papel: "executor",
      ativo: true,
    });
    const estranho = await ctx.db.insert("usuarios", {
      clerkId: CLERK_ESTRANHO,
      nome: "Rafael",
      email: "rafael@cn.com",
      papel: "executor",
      ativo: true,
    });
    const categoria = await ctx.db.insert("categorias", {
      nome: "Elétrica",
      ativa: true,
    });
    const local = await ctx.db.insert("locais", { nome: "Templo", ativo: true });
    return { lider, exec, equipe, estranho, categoria, local };
  });

  return { t, ...ids };
}

async function abrirDemanda(t: ReturnType<typeof convexTest>) {
  const r = await t.mutation(api.demandas.abrirDemanda, {
    titulo: "Lâmpada queimada",
    descricao: "Corredor sem luz",
    solicitanteNome: "Solange",
    solicitanteWhatsapp: "62991234567",
    localTextoOriginal: "Corredor",
  });
  return r.demandaId as Id<"demandas">;
}

async function abrirETriar(
  c: Awaited<ReturnType<typeof cenario>>,
  equipeIds?: Id<"usuarios">[],
) {
  const demandaId = await abrirDemanda(c.t);
  await c.t.withIdentity({ subject: CLERK_LIDER }).mutation(api.triagem.triar, {
    demandaId,
    categoriaId: c.categoria,
    localId: c.local,
    prioridade: "media",
    prazo: Date.now() + 2 * 86_400_000,
    responsavelId: c.exec,
    equipeIds,
    resultadoEsperado: "Lâmpada substituída",
  });
  return demandaId;
}

describe("abertura pública", () => {
  test("recusa WhatsApp inválido no servidor, não só na tela", async () => {
    const { t } = await cenario();
    await expect(
      t.mutation(api.demandas.abrirDemanda, {
        titulo: "Teste",
        descricao: "Descrição",
        solicitanteNome: "Fulano",
        solicitanteWhatsapp: "123",
        localTextoOriginal: "Templo",
      }),
    ).rejects.toThrow(/WhatsApp/);
  });

  test("toda demanda nasce 'aberta' e com evento no histórico (RF03)", async () => {
    const { t } = await cenario();
    const demandaId = await abrirDemanda(t);
    await t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d?.status).toBe("aberta");
      const hist = await ctx.db
        .query("historicoDemanda")
        .withIndex("by_demanda", (q) => q.eq("demandaId", demandaId))
        .collect();
      expect(hist).toHaveLength(1);
      expect(hist[0].tipo).toBe("criada");
    });
  });
});

describe("trava: impedimento exige motivo durante a parada (P5/RF10)", () => {
  test("pausar sem motivo é recusado", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await expect(
      c.t
        .withIdentity({ subject: CLERK_EXEC })
        .mutation(api.demandas.mudarStatus, { demandaId, novoStatus: "aguardando" }),
    ).rejects.toThrow(/motivo do impedimento/i);
  });

  test("com motivo, grava motivo e impedimentoDesde", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await c.t
      .withIdentity({ subject: CLERK_EXEC })
      .mutation(api.demandas.mudarStatus, {
        demandaId,
        novoStatus: "aguardando",
        motivoImpedimento: "aguardando_material",
      });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d?.status).toBe("aguardando");
      expect(d?.motivoImpedimento).toBe("aguardando_material");
      expect(typeof d?.impedimentoDesde).toBe("number");
    });
  });
});

describe("trava: concluir exige confirmar o resultado (P10/RF12)", () => {
  test("concluir sem confirmação é recusado", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await c.t
      .withIdentity({ subject: CLERK_EXEC })
      .mutation(api.demandas.mudarStatus, { demandaId, novoStatus: "em_execucao" });

    await expect(
      c.t
        .withIdentity({ subject: CLERK_EXEC })
        .mutation(api.demandas.mudarStatus, { demandaId, novoStatus: "concluida" }),
    ).rejects.toThrow(/resultado esperado/i);
  });

  test("confirmando, conclui e grava concluidaEm", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    const comoExec = c.t.withIdentity({ subject: CLERK_EXEC });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "em_execucao",
    });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "concluida",
      resultadoConfirmado: true,
    });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d?.status).toBe("concluida");
      expect(d?.resultadoConfirmado).toBe(true);
      expect(typeof d?.concluidaEm).toBe("number");
    });
  });
});

describe("trava: máquina de estados (estado.ts é o dono)", () => {
  test("concluída é estado final — não volta para execução", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    const comoExec = c.t.withIdentity({ subject: CLERK_EXEC });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "em_execucao",
    });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "concluida",
      resultadoConfirmado: true,
    });

    await expect(
      comoExec.mutation(api.demandas.mudarStatus, {
        demandaId,
        novoStatus: "em_execucao",
      }),
    ).rejects.toThrow(/Transição inválida/i);
  });

  test("não dá para triar duas vezes a mesma demanda", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await expect(
      c.t.withIdentity({ subject: CLERK_LIDER }).mutation(api.triagem.triar, {
        demandaId,
        categoriaId: c.categoria,
        localId: c.local,
        prioridade: "alta",
        prazo: Date.now(),
        responsavelId: c.exec,
        resultadoEsperado: "outro",
      }),
    ).rejects.toThrow(/'aberta'/);
  });
});

describe("trava: quem lê e quem escreve (E4 / RF13)", () => {
  test("executor sem vínculo não lê a demanda", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await expect(
      c.t
        .withIdentity({ subject: CLERK_ESTRANHO })
        .query(api.demandas.detalheDemanda, { demandaId }),
    ).rejects.toThrow(/Sem permissão/i);
  });

  test("integrante da equipe lê e pode atualizar status", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c, [c.equipe]);
    const comoEquipe = c.t.withIdentity({ subject: CLERK_EQUIPE });

    const detalhe = await comoEquipe.query(api.demandas.detalheDemanda, { demandaId });
    expect(detalhe.demanda.titulo).toBe("Lâmpada queimada");

    await comoEquipe.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "em_execucao",
    });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))?.status).toBe("em_execucao");
    });
  });

  test("triagem é só da liderança", async () => {
    const c = await cenario();
    const demandaId = await abrirDemanda(c.t);
    await expect(
      c.t.withIdentity({ subject: CLERK_EXEC }).mutation(api.triagem.triar, {
        demandaId,
        categoriaId: c.categoria,
        localId: c.local,
        prioridade: "media",
        prazo: Date.now(),
        responsavelId: c.exec,
        resultadoEsperado: "x",
      }),
    ).rejects.toThrow(/permissão/i);
  });

  test("sem identidade, nada é lido (RNF04)", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    await expect(
      c.t.query(api.demandas.detalheDemanda, { demandaId }),
    ).rejects.toThrow(/Não autenticado/i);
  });
});

describe("painel de um movimento (E3)", () => {
  test("demanda impedida sai do painel e vai para bloqueados (RF14b)", async () => {
    const c = await cenario();
    const demandaId = await abrirETriar(c);
    const comoExec = c.t.withIdentity({ subject: CLERK_EXEC });

    const antes = await comoExec.query(api.painel.proximoMovimento, {});
    expect(antes.item?._id).toBe(demandaId);
    expect(antes.bloqueados).toHaveLength(0);

    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "aguardando",
      motivoImpedimento: "aguardando_material",
    });

    const depois = await comoExec.query(api.painel.proximoMovimento, {});
    expect(depois.item).toBeNull();
    expect(depois.bloqueados).toHaveLength(1);
    expect(depois.bloqueados[0].quemDestrava).toBe("Compra de material");
  });

  test("a frase do RF14d é gerada e muda com o estado", async () => {
    const c = await cenario();
    const demandaId = await abrirDemanda(c.t);
    const comoLider = c.t.withIdentity({ subject: CLERK_LIDER });

    // aberta: a razão é a falta de triagem
    const semTriagem = await comoLider.query(api.painel.proximoMovimento, {});
    expect(semTriagem.item?.porque).toMatch(/triagem|aberta hoje/i);
    expect(semTriagem.item?.acao.rotulo).toBe("Triar agora");

    await comoLider.mutation(api.triagem.triar, {
      demandaId,
      categoriaId: c.categoria,
      localId: c.local,
      prioridade: "alta",
      prazo: Date.now() + 2 * 86_400_000,
      responsavelId: c.lider,
      resultadoEsperado: "ok",
    });

    // triada: a razão passa a ser prazo + prioridade
    const triada = await comoLider.query(api.painel.proximoMovimento, {});
    expect(triada.item?.porque).toMatch(/vence/i);
    expect(triada.item?.porque).toMatch(/prioridade alta/i);
  });

  test("liderança e executor veem UM item, não uma lista (RF14a/RF14e)", async () => {
    const c = await cenario();
    for (let i = 0; i < 5; i++) await abrirETriar(c);
    const painel = await c.t
      .withIdentity({ subject: CLERK_EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(painel.item).not.toBeNull();
    expect(painel.proximos.length).toBeLessThanOrEqual(3);
  });
});
