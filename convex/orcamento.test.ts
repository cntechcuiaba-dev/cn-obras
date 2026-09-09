import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// [E2] Orçamento é compromisso embutido: vence sozinho e ninguém trabalha nele
// até a data chegar. [E1] o envio ao solicitante é manual, o lembrete não.

const modules = import.meta.glob("./**/*.ts");
const DIA = 86_400_000;
const LIDER = "clerk_lider";
const EXEC = "clerk_exec";

async function cenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: LIDER, nome: "Ana", email: "a@cn.com", papel: "lideranca", ativo: true,
    });
    const exec = await ctx.db.insert("usuarios", {
      clerkId: EXEC, nome: "Marcos", email: "m@cn.com", papel: "executor", ativo: true,
    });
    const categoria = await ctx.db.insert("categorias", { nome: "Elétrica", ativa: true });
    const local = await ctx.db.insert("locais", { nome: "Templo", ativo: true });
    await ctx.db.insert("modelosMensagem", {
      nome: "Em execução", tipo: "em_execucao",
      texto: 'Olá {{solicitante}}! "{{demanda}}" está em execução.',
    });
    await ctx.db.insert("modelosMensagem", {
      nome: "Concluída", tipo: "concluida",
      texto: 'Olá {{solicitante}}! "{{demanda}}" foi concluída.',
    });
    return { lider, exec, categoria, local };
  });
  return { t, ...ids };
}

async function demandaEmExecucao(c: Awaited<ReturnType<typeof cenario>>) {
  const r = await c.t.mutation(api.demandas.abrirDemanda, {
    titulo: "Trocar disjuntor",
    descricao: "queimou",
    solicitanteNome: "Solange",
    solicitanteWhatsapp: "62991234567",
    localTextoOriginal: "Templo",
  });
  const demandaId = r.demandaId as Id<"demandas">;
  await c.t.withIdentity({ subject: LIDER }).mutation(api.triagem.triar, {
    demandaId,
    categoriaId: c.categoria,
    localId: c.local,
    prioridade: "media",
    prazo: Date.now() + 5 * DIA,
    responsavelId: c.exec,
    resultadoEsperado: "Disjuntor novo instalado",
  });
  await c.t
    .withIdentity({ subject: EXEC })
    .mutation(api.demandas.mudarStatus, { demandaId, novoStatus: "em_execucao" });
  return demandaId;
}

describe("trava: os quatro campos do orçamento vêm juntos (E2)", () => {
  test("aguardar orçamento sem o bloco é recusado", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
        demandaId,
        novoStatus: "aguardando",
        motivoImpedimento: "aguardando_orcamento",
      }),
    ).rejects.toThrow(/fornecedor.*cobran|cobran.*fornecedor/is);
  });

  test("data de cobrança anterior à solicitação é recusada", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
        demandaId,
        novoStatus: "aguardando",
        motivoImpedimento: "aguardando_orcamento",
        orcamento: {
          fornecedor: "Elétrica Silva",
          solicitadoEm: Date.now(),
          cobrarEm: Date.now() - DIA,
          responsavelCobrancaId: c.exec,
        },
      }),
    ).rejects.toThrow(/anterior/i);
  });

  test("com os quatro, grava o compromisso com contador zerado", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "aguardando",
      motivoImpedimento: "aguardando_orcamento",
      orcamento: {
        fornecedor: "Elétrica Silva",
        solicitadoEm: Date.now(),
        cobrarEm: Date.now() + 3 * DIA,
        responsavelCobrancaId: c.exec,
      },
    });
    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d!.orcamento!.fornecedor).toBe("Elétrica Silva");
      expect(d!.orcamento!.cobrancasFeitas).toBe(0);
    });
  });
});

describe("o sistema cobra, não avisa (E2)", () => {
  async function comOrcamento(cobrarEmDias: number) {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "aguardando",
      motivoImpedimento: "aguardando_orcamento",
      orcamento: {
        fornecedor: "Elétrica Silva",
        solicitadoEm: Date.now() - DIA,
        cobrarEm: Date.now() + cobrarEmDias * DIA,
        responsavelCobrancaId: c.exec,
      },
    });
    return { c, demandaId };
  }

  test("antes da data de cobrança, fica fora do painel (travada)", async () => {
    const { c, demandaId } = await comOrcamento(3);
    const p = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(p.item).toBeNull();
    expect(p.bloqueados.map((b) => b._id)).toContain(demandaId);
    expect(p.bloqueados[0].quemDestrava).toBe("Elétrica Silva");
  });

  test("chegada a data, volta como movimento de COBRAR", async () => {
    const { c, demandaId } = await comOrcamento(-1); // cobrança venceu ontem
    const p = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(p.bloqueados).toHaveLength(0);
    expect(p.item!._id).toBe(demandaId);
    expect(p.item!.acao.rotulo).toMatch(/Cobrar o orçamento de Elétrica Silva/);
  });

  test("registrar cobrança incrementa o contador e reagenda", async () => {
    const { c, demandaId } = await comOrcamento(-1);
    const proxima = Date.now() + 3 * DIA;
    await c.t
      .withIdentity({ subject: EXEC })
      .mutation(api.orcamento.registrarCobranca, { demandaId, proximaCobrancaEm: proxima });

    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d!.orcamento!.cobrancasFeitas).toBe(1);
      expect(d!.orcamento!.cobrarEm).toBe(proxima);
    });

    // reagendada => volta a ficar fora do painel
    const p = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(p.bloqueados).toHaveLength(1);
  });
});

describe("aprovação sem alçada por valor (E2)", () => {
  test("orçamento recebido vira movimento de aprovação da liderança", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "aguardando",
      motivoImpedimento: "aguardando_orcamento",
      orcamento: {
        fornecedor: "Elétrica Silva",
        solicitadoEm: Date.now(),
        cobrarEm: Date.now() + 3 * DIA,
        responsavelCobrancaId: c.exec,
      },
    });
    await c.t
      .withIdentity({ subject: EXEC })
      .mutation(api.orcamento.registrarValorRecebido, { demandaId, valor: 450 });

    const painelLider = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.painel.proximoMovimento, {});
    expect(painelLider.aprovacoes).toHaveLength(1);
    expect(painelLider.aprovacoes[0].valorRecebido).toBe(450);

    // executor não aprova
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.orcamento.aprovar, { demandaId }),
    ).rejects.toThrow(/permissão/i);

    await c.t.withIdentity({ subject: LIDER }).mutation(api.orcamento.aprovar, { demandaId });
    const depois = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.painel.proximoMovimento, {});
    expect(depois.aprovacoes).toHaveLength(0);
  });
});

describe("trava: custo obrigatório quando houve gasto (E2)", () => {
  test("não conclui demanda que passou por material sem lançar valor", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    const comoExec = c.t.withIdentity({ subject: EXEC });

    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "aguardando",
      motivoImpedimento: "aguardando_material",
    });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "em_execucao",
    });

    await expect(
      comoExec.mutation(api.demandas.mudarStatus, {
        demandaId,
        novoStatus: "concluida",
        resultadoConfirmado: true,
      }),
    ).rejects.toThrow(/valor gasto|zero é resposta válida/i);
  });

  test("zero é resposta válida", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    const comoExec = c.t.withIdentity({ subject: EXEC });

    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId, novoStatus: "aguardando", motivoImpedimento: "aguardando_material",
    });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId, novoStatus: "em_execucao",
    });
    await comoExec.mutation(api.demandas.mudarStatus, {
      demandaId,
      novoStatus: "concluida",
      resultadoConfirmado: true,
      custo: { valor: 0, origem: "estoque" },
    });

    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(demandaId);
      expect(d!.status).toBe("concluida");
      expect(d!.custo!.valor).toBe(0);
    });
  });

  test("demanda que não passou por gasto conclui sem custo", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await c.t.withIdentity({ subject: EXEC }).mutation(api.demandas.mudarStatus, {
      demandaId, novoStatus: "concluida", resultadoConfirmado: true,
    });
    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(demandaId))!.status).toBe("concluida");
    });
  });
});

describe("consumo sem saldo (E2)", () => {
  test("registra o consumo e alimenta o histórico de preço", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await c.t.withIdentity({ subject: EXEC }).mutation(api.orcamento.registrarConsumo, {
      demandaId, item: "Disjuntor 20A", quantidade: 2, valorUnitario: 18.5, origem: "compra",
    });

    const precos = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.orcamento.historicoDePreco, { item: "Disjuntor 20A" });
    expect(precos).toHaveLength(1);
    expect(precos[0].valorUnitario).toBe(18.5);
  });

  test("quantidade não positiva é recusada", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    await expect(
      c.t.withIdentity({ subject: EXEC }).mutation(api.orcamento.registrarConsumo, {
        demandaId, item: "Fita", quantidade: 0, origem: "estoque",
      }),
    ).rejects.toThrow(/quantidade/i);
  });

  test("consumosDaDemanda lista só os desta demanda, e quem não tem acesso não lê", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c);
    const outraId = await demandaEmExecucao(c);
    const comoExec = c.t.withIdentity({ subject: EXEC });

    await comoExec.mutation(api.orcamento.registrarConsumo, {
      demandaId, item: "Disjuntor 20A", quantidade: 2, valorUnitario: 18.5, origem: "compra",
    });
    await comoExec.mutation(api.orcamento.registrarConsumo, {
      demandaId, item: "Fita isolante", quantidade: 1, origem: "estoque",
    });
    await comoExec.mutation(api.orcamento.registrarConsumo, {
      demandaId: outraId, item: "Disjuntor 20A", quantidade: 1, valorUnitario: 20, origem: "compra",
    });

    const lista = await comoExec.query(api.orcamento.consumosDaDemanda, { demandaId });
    expect(lista).toHaveLength(2);
    expect(lista.map((x) => x.item).sort()).toEqual(["Disjuntor 20A", "Fita isolante"]);

    // estranho sem responsabilidade nem equipe na demanda não lê
    const estranho = await c.t.run((ctx) =>
      ctx.db.insert("usuarios", {
        clerkId: "clerk_estranho", nome: "Rafael", email: "r@cn.com", papel: "executor", ativo: true,
      }),
    );
    expect(estranho).toBeDefined();
    await expect(
      c.t.withIdentity({ subject: "clerk_estranho" }).query(api.orcamento.consumosDaDemanda, {
        demandaId,
      }),
    ).rejects.toThrow(/permissão/i);
  });

  test("historicoDePreco traz o mais recente primeiro, no máximo 5", async () => {
    const c = await cenario();
    const comoExec = c.t.withIdentity({ subject: EXEC });

    for (let i = 0; i < 7; i++) {
      const demandaId = await demandaEmExecucao(c);
      await comoExec.mutation(api.orcamento.registrarConsumo, {
        demandaId, item: "Lâmpada LED", quantidade: 1, valorUnitario: 10 + i, origem: "compra",
      });
    }

    const precos = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.orcamento.historicoDePreco, { item: "Lâmpada LED" });
    expect(precos).toHaveLength(5);
    // o mais recente (i=6, valor 16) vem primeiro
    expect(precos[0].valorUnitario).toBe(16);
  });

  test("item vazio ou sem histórico retorna lista vazia", async () => {
    const c = await cenario();
    const vazio = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.orcamento.historicoDePreco, { item: "  " });
    expect(vazio).toEqual([]);

    const semHistorico = await c.t
      .withIdentity({ subject: LIDER })
      .query(api.orcamento.historicoDePreco, { item: "Item nunca comprado" });
    expect(semHistorico).toEqual([]);
  });
});

describe("avisos ao solicitante (E1)", () => {
  test("mudança de status gera aviso pendente com a mensagem pronta", async () => {
    const c = await cenario();
    const demandaId = await demandaEmExecucao(c); // já passou para em_execucao

    const p = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(p.avisos).toHaveLength(1);
    expect(p.avisos[0].mensagem).toContain("Solange");
    expect(p.avisos[0].mensagem).toContain("Trocar disjuntor");
    expect(p.avisos[0].whatsapp).toBe("62991234567");
    expect(p.avisos[0].demandaId).toBe(demandaId);
  });

  test("só some quando marcado como enviado", async () => {
    const c = await cenario();
    await demandaEmExecucao(c);
    const comoExec = c.t.withIdentity({ subject: EXEC });

    const antes = await comoExec.query(api.painel.proximoMovimento, {});
    await comoExec.mutation(api.avisos.marcarEnviado, { avisoId: antes.avisos[0]._id });

    const depois = await comoExec.query(api.painel.proximoMovimento, {});
    expect(depois.avisos).toHaveLength(0);
  });

  test("demanda de recorrência não gera aviso (não há solicitante de fora)", async () => {
    const c = await cenario();
    const demandaId = await c.t.run(async (ctx) =>
      ctx.db.insert("demandas", {
        titulo: "Rotina", descricao: "x",
        solicitanteNome: "Sistema (recorrência)",
        solicitanteWhatsapp: "", // sem WhatsApp
        localTextoOriginal: "",
        status: "triada",
        prazo: Date.now() + DIA,
        responsavelId: c.exec,
        resultadoEsperado: "ok",
      }),
    );
    await c.t
      .withIdentity({ subject: EXEC })
      .mutation(api.demandas.mudarStatus, { demandaId, novoStatus: "em_execucao" });

    const p = await c.t
      .withIdentity({ subject: EXEC })
      .query(api.painel.proximoMovimento, {});
    expect(p.avisos).toHaveLength(0);
  });
});
