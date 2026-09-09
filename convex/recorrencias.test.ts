import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// [E5] A recorrência serve para a liderança se programar ANTES. Demanda que nasce
// no dia do vencimento não deu tempo de nada — é isso que estes testes protegem.

const modules = import.meta.glob("./**/*.ts");
const DIA = 86_400_000;
const CLERK_LIDER = "clerk_lider";

async function cenario(antecedenciaDias: number, diasAtras: number) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: CLERK_LIDER,
      nome: "Ana",
      email: "ana@cn.com",
      papel: "lideranca",
      ativo: true,
    });
    const categoria = await ctx.db.insert("categorias", {
      nome: "Hidráulica",
      ativa: true,
    });
    const local = await ctx.db.insert("locais", { nome: "Templo", ativo: true });
    const rec = await ctx.db.insert("manutencoesRecorrentes", {
      titulo: "Limpeza da caixa d'água",
      descricao: "Higienização semestral",
      categoriaId: categoria,
      localId: local,
      executorPadraoId: lider,
      periodicidade: "mensal", // 30 dias
      antecedenciaDias,
      ativa: true,
      // última geração há N dias
      ultimaGeracaoEm: Date.now() - diasAtras * DIA,
    });
    return { lider, categoria, local, rec };
  });
  return { t, ...ids };
}

describe("geração com antecedência (RF18a)", () => {
  test("não gera antes da janela de antecedência", async () => {
    // mensal(30) + antecedência 7 => gera 30 dias após a última geração.
    // Passaram só 10 dias: nada deve nascer.
    const c = await cenario(7, 10);
    const r = await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    expect(r.geradas).toBe(0);
  });

  test("gera quando entra na janela, com prazo na data da manutenção", async () => {
    // última geração há 31 dias: a manutenção prevista era em (geração + 7),
    // a próxima é 30 dias depois => já dentro da janela.
    const c = await cenario(7, 31);
    const r = await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    expect(r.geradas).toBe(1);

    await c.t.run(async (ctx) => {
      const d = (await ctx.db.query("demandas").collect())[0];
      expect(d.status).toBe("triada");
      expect(d.origemRecorrenciaId).toBe(c.rec);
      expect(d.responsavelId).toBe(c.lider);

      // o prazo é a data prevista da manutenção — no futuro, não hoje
      expect(d.prazo).toBeGreaterThan(Date.now());

      // e está a ~antecedência de distância (nasceu antes, não no dia)
      const diasAteOPrazo = Math.round((d.prazo! - Date.now()) / DIA);
      expect(diasAteOPrazo).toBeGreaterThan(0);
      expect(diasAteOPrazo).toBeLessThanOrEqual(7);
    });
  });

  test("a demanda nasce com evento visível, não silenciosa (RF31)", async () => {
    const c = await cenario(7, 31);
    await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    await c.t.run(async (ctx) => {
      const d = (await ctx.db.query("demandas").collect())[0];
      const hist = await ctx.db
        .query("historicoDemanda")
        .withIndex("by_demanda", (q) => q.eq("demandaId", d._id))
        .collect();
      expect(hist).toHaveLength(1);
      expect(hist[0].descricao).toMatch(/antecedência/i);
      expect(hist[0].descricao).toMatch(/prevista para/i);
    });
  });
});

describe("idempotência (RF19)", () => {
  test("rodar o cron duas vezes no mesmo dia não duplica", async () => {
    const c = await cenario(7, 31);
    const a = await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    const b = await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    expect(a.geradas).toBe(1);
    expect(b.geradas).toBe(0);

    await c.t.run(async (ctx) => {
      expect(await ctx.db.query("demandas").collect()).toHaveLength(1);
    });
  });

  test("recorrência inativa não gera", async () => {
    const c = await cenario(7, 31);
    await c.t.run(async (ctx) => {
      await ctx.db.patch(c.rec, { ativa: false });
    });
    const r = await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});
    expect(r.geradas).toBe(0);
  });
});

describe("movimento de programar (RF18b)", () => {
  test("manutenção gerada entra no painel da liderança como 'Programar'", async () => {
    const c = await cenario(7, 31);
    await c.t.mutation(internal.recorrencias.gerarRecorrenciasDoDia, {});

    const painel = await c.t
      .withIdentity({ subject: CLERK_LIDER })
      .query(api.painel.proximoMovimento, {});

    expect(painel.item).not.toBeNull();
    expect(painel.item!.acao.rotulo).toBe("Programar manutenção");
    expect(painel.item!.titulo).toBe("Limpeza da caixa d'água");
  });
});
