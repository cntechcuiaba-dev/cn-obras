import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// [RF30] O risco tem que existir mesmo que ninguém abra o painel — é o princípio
// "trabalhar sem ninguém olhando". E [RF29] o histórico tem que virar aprendizado.

const modules = import.meta.glob("./**/*.ts");
const DIA = 86_400_000;
const CLERK_LIDER = "clerk_lider";

async function base() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const lider = await ctx.db.insert("usuarios", {
      clerkId: CLERK_LIDER,
      nome: "Ana",
      email: "ana@cn.com",
      papel: "lideranca",
      ativo: true,
    });
    const categoria = await ctx.db.insert("categorias", { nome: "Elétrica", ativa: true });
    const local = await ctx.db.insert("locais", { nome: "Templo", ativo: true });
    return { lider, categoria, local };
  });
  return { t, ...ids };
}

// Cria demanda direto no banco para controlar prazo e histórico.
async function demandaCom(
  c: Awaited<ReturnType<typeof base>>,
  opts: {
    prazoEmDias: number;
    status?: "triada" | "em_execucao" | "aguardando" | "concluida";
    ultimoProgressoDiasAtras?: number;
    origemRecorrencia?: boolean;
    titulo?: string;
  },
) {
  return await c.t.run(async (ctx) => {
    let origemRecorrenciaId: Id<"manutencoesRecorrentes"> | undefined;
    if (opts.origemRecorrencia) {
      origemRecorrenciaId = await ctx.db.insert("manutencoesRecorrentes", {
        titulo: "Rotina",
        descricao: "",
        categoriaId: c.categoria,
        localId: c.local,
        executorPadraoId: c.lider,
        periodicidade: "mensal",
        antecedenciaDias: 7,
        ativa: true,
      });
    }

    const id = await ctx.db.insert("demandas", {
      titulo: opts.titulo ?? "Demanda",
      descricao: "x",
      solicitanteNome: "Fulano",
      solicitanteWhatsapp: "62999999999",
      localTextoOriginal: "Templo",
      status: opts.status ?? "triada",
      categoriaId: c.categoria,
      localId: c.local,
      prioridade: "media",
      prazo: Date.now() + opts.prazoEmDias * DIA,
      responsavelId: c.lider,
      resultadoEsperado: "ok",
      origemRecorrenciaId,
      concluidaEm: opts.status === "concluida" ? Date.now() : undefined,
    });

    if (opts.ultimoProgressoDiasAtras !== undefined) {
      // convex-test não deixa forjar _creationTime; usamos um evento antigo
      // apenas quando queremos "sem progresso" — aqui inserimos um evento
      // recente para simular progresso.
      if (opts.ultimoProgressoDiasAtras === 0) {
        await ctx.db.insert("historicoDemanda", {
          demandaId: id,
          tipo: "status_alterado",
          descricao: "Status: Em execução",
        });
      }
    }
    return id;
  });
}

describe("rotina diária de risco (RF30)", () => {
  test("sinaliza demanda vencida", async () => {
    const c = await base();
    const id = await demandaCom(c, { prazoEmDias: -2 });

    const r = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    expect(r.sinalizadas).toBe(1);

    await c.t.run(async (ctx) => {
      const d = await ctx.db.get(id);
      expect(typeof d!.riscoSinalizadoEm).toBe("number");
      const h = await ctx.db
        .query("historicoDemanda")
        .withIndex("by_demanda", (q) => q.eq("demandaId", id))
        .collect();
      expect(h.some((e) => e.tipo === "risco_sinalizado")).toBe(true);
      expect(h.find((e) => e.tipo === "risco_sinalizado")!.criadoPorClerkId).toBeUndefined();
    });
  });

  test("sinaliza a vencer SEM progresso", async () => {
    const c = await base();
    await demandaCom(c, { prazoEmDias: 1 }); // sem nenhum evento de progresso
    const r = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    expect(r.sinalizadas).toBe(1);
  });

  test("NÃO sinaliza a vencer COM progresso recente", async () => {
    const c = await base();
    await demandaCom(c, { prazoEmDias: 1, ultimoProgressoDiasAtras: 0 });
    const r = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    // quem já está trabalhando não deve ser cobrado (RF30: "sem progresso")
    expect(r.sinalizadas).toBe(0);
  });

  test("não sinaliza demanda em dia nem concluída", async () => {
    const c = await base();
    await demandaCom(c, { prazoEmDias: 30 });
    await demandaCom(c, { prazoEmDias: -5, status: "concluida" });
    const r = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    expect(r.sinalizadas).toBe(0);
  });

  test("é idempotente: rodar duas vezes não duplica o aviso", async () => {
    const c = await base();
    const id = await demandaCom(c, { prazoEmDias: -2 });
    await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    const segunda = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    expect(segunda.sinalizadas).toBe(0);

    await c.t.run(async (ctx) => {
      const h = await ctx.db
        .query("historicoDemanda")
        .withIndex("by_demanda", (q) => q.eq("demandaId", id))
        .collect();
      expect(h.filter((e) => e.tipo === "risco_sinalizado")).toHaveLength(1);
    });
  });

  test("progresso do executor limpa o sinal, permitindo re-sinalizar se travar de novo", async () => {
    const c = await base();
    const id = await demandaCom(c, { prazoEmDias: -2 });
    await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});

    await c.t
      .withIdentity({ subject: CLERK_LIDER })
      .mutation(api.demandas.mudarStatus, { demandaId: id, novoStatus: "em_execucao" });

    await c.t.run(async (ctx) => {
      expect((await ctx.db.get(id))!.riscoSinalizadoEm).toBeUndefined();
    });

    // segue vencida: volta a ser sinalizada
    const r = await c.t.mutation(internal.demandas.avaliarRiscosDoDia, {});
    expect(r.sinalizadas).toBe(1);
  });
});

describe("aprendizado (RF29)", () => {
  test("separa problema que se repete de manutenção programada", async () => {
    const c = await base();
    // dois problemas espontâneos + três manutenções programadas no mesmo local
    await demandaCom(c, { prazoEmDias: 5, titulo: "Tomada queimada" });
    await demandaCom(c, { prazoEmDias: 5, titulo: "Curto no quadro" });
    for (let i = 0; i < 3; i++) {
      await demandaCom(c, { prazoEmDias: 5, origemRecorrencia: true, titulo: "Rotina" });
    }

    const r = await c.t
      .withIdentity({ subject: CLERK_LIDER })
      .query(api.inteligencia.aprendizado, {});

    const templo = r.porLocal.find((l) => l.nome === "Templo")!;
    expect(templo.total).toBe(5);
    expect(templo.espontaneas).toBe(2); // o que realmente se repete
    expect(templo.recorrentes).toBe(3); // programado, não é sintoma
  });

  test("tempo médio conta só o que foi concluído", async () => {
    const c = await base();
    await demandaCom(c, { prazoEmDias: 5 }); // aberta, não entra na média
    await demandaCom(c, { prazoEmDias: -1, status: "concluida" });

    const r = await c.t
      .withIdentity({ subject: CLERK_LIDER })
      .query(api.inteligencia.aprendizado, {});

    const templo = r.porLocal.find((l) => l.nome === "Templo")!;
    expect(templo.concluidas).toBe(1);
    expect(templo.tempoMedioDias).not.toBeNull();
    expect(templo.tempoMedioDias).toBeGreaterThanOrEqual(0);
  });

  test("aprendizado é só para a liderança", async () => {
    const c = await base();
    const exec = await c.t.run(async (ctx) =>
      ctx.db.insert("usuarios", {
        clerkId: "clerk_exec",
        nome: "Marcos",
        email: "m@cn.com",
        papel: "executor",
        ativo: true,
      }),
    );
    expect(exec).toBeDefined();
    await expect(
      c.t.withIdentity({ subject: "clerk_exec" }).query(api.inteligencia.aprendizado, {}),
    ).rejects.toThrow(/permissão/i);
  });
});
