import { convexTest } from "convex-test";
import { expect, test, describe, vi, afterEach } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// Auditoria de segurança: formulário público e upload público não tinham
// nenhum limite (nem tamanho de arquivo, nem volume de chamadas) — porta de
// lixo real pra storage e pra fila de triagem. Estes testes cobrem o remendo:
// rate-limit por janela e validação do anexo no momento em que ele passa a
// ser referenciado de fato (abrirDemanda).

const modules = import.meta.glob("./**/*.ts");

const BASE = {
  titulo: "Vazamento no forro",
  descricao: "Pingando quando chove",
  solicitanteNome: "Fulano",
  solicitanteWhatsapp: "62999999999",
  localTextoOriginal: "Salão social",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("rate-limit dos endpoints públicos", () => {
  test("abrirDemanda aceita até o limite e recusa a próxima na mesma janela", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.demandas.abrirDemanda, BASE);
    }
    await expect(t.mutation(api.demandas.abrirDemanda, BASE)).rejects.toThrow(
      /muitas solicitações/i,
    );
  });

  test("passada a janela, volta a aceitar", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.demandas.abrirDemanda, BASE);
    }
    await expect(t.mutation(api.demandas.abrirDemanda, BASE)).rejects.toThrow(
      /muitas solicitações/i,
    );
    vi.advanceTimersByTime(11 * 60 * 1000);
    await expect(
      t.mutation(api.demandas.abrirDemanda, BASE),
    ).resolves.toMatchObject({ protocolo: expect.any(String) });
  });

  test("gerarUrlUploadPublico também tem limite próprio, mais apertado", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.demandas.gerarUrlUploadPublico, {});
    }
    await expect(
      t.mutation(api.demandas.gerarUrlUploadPublico, {}),
    ).rejects.toThrow(/muitas solicitações/i);
  });

  test("limite de um tipo não consome o do outro", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.demandas.gerarUrlUploadPublico, {});
    }
    // upload_publico estourou, mas abrir_demanda é contador independente
    await expect(
      t.mutation(api.demandas.abrirDemanda, BASE),
    ).resolves.toMatchObject({ protocolo: expect.any(String) });
  });

  test("cron de limpeza remove eventos com mais de um dia", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.demandas.gerarUrlUploadPublico, {});
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    await t.mutation(internal.limite.limparEventosAntigos, {});
    await t.run(async (ctx) => {
      const restantes = await ctx.db.query("limitePublico").collect();
      expect(restantes).toHaveLength(0);
    });
  });
});

describe("validação do anexo em abrirDemanda", () => {
  async function comArquivo(t: ReturnType<typeof convexTest>, bytes: number, contentType: string) {
    const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
    return await t.run(async (ctx) => await ctx.storage.store(blob));
  }

  test("foto dentro do limite e tipo aceito passa normalmente", async () => {
    const t = convexTest(schema, modules);
    const storageId = await comArquivo(t, 1024, "image/jpeg");
    const r = await t.mutation(api.demandas.abrirDemanda, {
      ...BASE,
      anexosAbertura: [storageId],
    });
    expect(r.anexoRecusado).toBe(false);
    await t.run(async (ctx) => {
      const d = await ctx.db.get(r.demandaId);
      expect(d!.anexosAbertura).toEqual([storageId]);
    });
  });

  // O storage do convex-test só guarda size/sha256, não contentType (mesma
  // limitação documentada em configuracao.test.ts) — por isso a recusa por
  // tipo não dá pra exercitar aqui, só a recusa por tamanho. A checagem de
  // órfão usa db.system.get (não storage.getUrl): é o que a própria
  // implementação usa para decidir, e o que configuracao.ts já comprova
  // ficar null após ctx.storage.delete.
  //
  // Descarta em vez de lançar (mesmo motivo de definirLogo): a mutation
  // continua criando a demanda, só sem a foto — e sinaliza isso no retorno.
  test("arquivo maior que 8 MB é descartado, removido do storage, e a demanda segue sem ele", async () => {
    const t = convexTest(schema, modules);
    const storageId = await comArquivo(t, 9 * 1024 * 1024, "image/jpeg");
    const r = await t.mutation(api.demandas.abrirDemanda, {
      ...BASE,
      anexosAbertura: [storageId],
    });
    expect(r.anexoRecusado).toBe(true);
    await t.run(async (ctx) => {
      const d = await ctx.db.get(r.demandaId);
      expect(d!.anexosAbertura).toBeUndefined();
      expect(await ctx.db.system.get(storageId)).toBeNull();
    });
  });

  test("mais de uma foto por solicitação é recusado", async () => {
    const t = convexTest(schema, modules);
    const a = await comArquivo(t, 1024, "image/png");
    const b = await comArquivo(t, 1024, "image/png");
    await expect(
      t.mutation(api.demandas.abrirDemanda, { ...BASE, anexosAbertura: [a, b] }),
    ).rejects.toThrow(/no máximo uma foto/i);
  });
});
